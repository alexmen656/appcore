import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

export const execAsync = promisify(exec);

export function findConfigFile(dir: string): string | null {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "fastlane") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findConfigFile(full);
      if (found) return found;
    } else if (entry.name === "config.json") return full;
  }
  return null;
}

export interface SigningCreds {
  p12Base64: string;
  p12Password: string;
  profileBase64: string;
  teamId?: string;
}

export function resolveRepoWorkDir(
  repoDir: string,
  iosDir: string | undefined,
  logs: string[],
): string {
  const raw = iosDir?.trim();
  if (!raw) return repoDir;

  const normalized = raw.replace(/^\/+|\/+$/g, "");
  if (!normalized || normalized === ".") return repoDir;

  const workDir = path.resolve(repoDir, normalized);
  const relative = path.relative(repoDir, workDir);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Invalid iosDir path: ${iosDir}`);
  }
  if (!fs.existsSync(workDir) || !fs.statSync(workDir).isDirectory()) {
    throw new Error(`Configured iosDir not found in repo: ${normalized}`);
  }

  logs.push(`[repo] Using iOS subdirectory: ${normalized}`);
  return workDir;
}

export async function installSigningCreds(
  creds: SigningCreds,
  logs: string[],
): Promise<{ cleanup: () => Promise<void>; profileUuid: string }> {
  const tmpSignDir = path.join(os.tmpdir(), `signing-${Date.now()}`);
  fs.mkdirSync(tmpSignDir, { recursive: true });

  const p12Path = path.join(tmpSignDir, "cert.p12");
  const profilePath = path.join(tmpSignDir, "app.mobileprovision");
  const keychainName = `appcore-build-${Date.now()}.keychain`;
  const keychainPassword = `kc-${Date.now()}`;
  const profilesDir = path.join(
    os.homedir(),
    "Library",
    "MobileDevice",
    "Provisioning Profiles",
  );

  fs.writeFileSync(p12Path, Buffer.from(creds.p12Base64, "base64"));
  fs.writeFileSync(profilePath, Buffer.from(creds.profileBase64, "base64"));

  let profileUuid = "";
  try {
    const { stdout } = await execAsync(
      `security cms -D -i "${profilePath}" 2>/dev/null | plutil -extract UUID raw -`,
    );
    profileUuid = stdout.trim();
  } catch {
    profileUuid = `appcore-${Date.now()}`;
  }

  fs.mkdirSync(profilesDir, { recursive: true });

  const destProfile = path.join(profilesDir, `${profileUuid}.mobileprovision`);
  fs.copyFileSync(profilePath, destProfile);

  await execAsync(
    `security create-keychain -p "${keychainPassword}" "${keychainName}"`,
  );
  await execAsync(
    `security set-keychain-settings -lut 21600 "${keychainName}"`,
  );
  await execAsync(
    `security unlock-keychain -p "${keychainPassword}" "${keychainName}"`,
  );

  const { stdout: currentList } = await execAsync(
    "security list-keychains -d user",
  );

  const existing = currentList
    .trim()
    .split("\n")
    .map((k) => k.trim().replace(/"/g, ""));

  await execAsync(
    `security list-keychains -d user -s "${keychainName}" ${existing.map((k) => `"${k}"`).join(" ")}`,
  );

  await execAsync(
    `security import "${p12Path}" -k "${keychainName}" -P "${creds.p12Password}" -T /usr/bin/codesign -T /usr/bin/security -f pkcs12`,
  );
  await execAsync(
    `security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "${keychainPassword}" "${keychainName}"`,
  );

  const cleanup = async () => {
    try {
      await execAsync(`security delete-keychain "${keychainName}"`);
      console.log("Temporary keychain deleted");
    } catch {
      /* ignore */
    }
    try {
      fs.rmSync(destProfile, { force: true });
      logs.push("[signing] Signing credentials removed");
    } catch {
      /* ignore */
    }
    try {
      fs.rmSync(tmpSignDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    try {
      await execAsync(
        `security list-keychains -d user -s ${existing.map((k) => `"${k}"`).join(" ")}`,
      );
    } catch {
      /* ignore */
    }
  };

  return { cleanup, profileUuid };
}

export async function buildWithGym(
  repoDir: string,
  appName: string,
  bundleId: string,
  gymScheme: string | undefined,
  exportMethod: string,
  fastlanePath: string,
  logs: string[],
  signingCreds?: SigningCreds,
): Promise<{ ipaBase64: string; originalFilename: string; sizeBytes: number }> {
  logs.push("[build] Starting build"); //— scheme: ${gymScheme ?? appName}, export: ${exportMethod}`,

  let signingCleanup: (() => Promise<void>) | undefined;
  let installedProfileUuid: string | undefined;
  if (signingCreds) {
    logs.push("[build] Installing signing credentials ...");
    const { cleanup, profileUuid } = await installSigningCreds(
      signingCreds,
      logs,
    );
    signingCleanup = cleanup;
    installedProfileUuid = profileUuid;
    logs.push("[build] Signing credentials installed successfully");
  } else {
    logs.push(
      "[build] No signing credentials provided — build may fail at code-signing step",
    );
  }

  const fastlaneDir = path.join(repoDir, "fastlane");
  fs.mkdirSync(fastlaneDir, { recursive: true });

  const gymfile = [
    `scheme("${gymScheme ?? appName}")`,
    `export_method("${exportMethod}")`,
    `clean(false)`,
    `output_directory("./build")`,
    `output_name("${bundleId}")`,
  ];

  if (installedProfileUuid) {
    if (signingCreds?.teamId) {
      gymfile.push(`xcargs("DEVELOPMENT_TEAM=${signingCreds.teamId}")`);
    }
    gymfile.push(
      `export_options({`,
      `  method: "${exportMethod}",`,
      `  signingStyle: "manual",`,
      `  provisioningProfiles: {`,
      `    "${bundleId}" => "${installedProfileUuid}"`,
      `  }`,
      `})`,
    );
  } else {
    gymfile.push(
      `export_options({`,
      `  method: "${exportMethod}",`,
      `  signingStyle: "automatic"`,
      `})`,
    );
  }
  fs.writeFileSync(path.join(fastlaneDir, "Gymfile"), gymfile.join("\n"));

  const buildDir = path.join(repoDir, "build");
  fs.mkdirSync(buildDir, { recursive: true });

  const buildNumber = Math.floor(Date.now() / 1000);
  try {
    await execAsync(`agvtool new-version -all ${buildNumber} 2>&1`, {
      cwd: repoDir,
      timeout: 30_000,
    });
    logs.push(`[build] Build number set to ${buildNumber}`);
  } catch {
    logs.push("[build] Warning: agvtool failed — build number unchanged");
  }

  logs.push(`[build] Building ...`);
  const gymStart = Date.now();
  try {
    if (installedProfileUuid) {
      const updateSigningArgs = [
        `run`,
        `update_code_signing_settings`,
        `use_automatic_signing:false`,
        `'code_sign_identity:iPhone Distribution'`,
        `profile_uuid:${installedProfileUuid}`,
        signingCreds?.teamId ? `team_id:${signingCreds.teamId}` : ``,
      ]
        .filter(Boolean)
        .join(` `);
      await execAsync(`${fastlanePath} ${updateSigningArgs} 2>&1`, {
        cwd: repoDir,
        timeout: 60_000,
        env: { ...process.env, FASTLANE_DISABLE_COLORS: "1" },
        maxBuffer: 10 * 1024 * 1024,
      });
    }

    await execAsync(`${fastlanePath} gym 2>&1`, {
      cwd: repoDir,
      timeout: 900_000,
      env: { ...process.env, FASTLANE_DISABLE_COLORS: "1" },
      maxBuffer: 10 * 1024 * 1024,
    });

    logs.push(
      `[build] Build finished in ${Math.round((Date.now() - gymStart) / 1000)}s`,
    );
  } catch (gymErr: any) {
    if (gymErr.stdout) logs.push(...gymErr.stdout.split("\n").filter(Boolean));
    if (gymErr.stderr)
      logs.push(
        ...gymErr.stderr
          .split("\n")
          .filter(Boolean)
          .map((l: string) => `[stderr] ${l}`),
      );
    logs.push(
      `[build] FAILED after ${Math.round((Date.now() - gymStart) / 1000)}s — exit code: ${gymErr.code ?? "unknown"}`,
    );
    await signingCleanup?.();
    throw new Error(`build exited with code ${gymErr.code ?? "unknown"}.`);
  }

  const findIpa = (dir: string): string | undefined => {
    if (!fs.existsSync(dir)) return undefined;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.endsWith(".ipa")) return full;
      if (entry.isDirectory()) {
        const nested = findIpa(full);
        if (nested) return nested;
      }
    }
    return undefined;
  };

  const ipa = findIpa(buildDir) ?? findIpa(repoDir);
  if (!ipa) {
    await signingCleanup?.();
    throw new Error("gym completed but no .ipa file was found");
  }

  const ipaBuffer = fs.readFileSync(ipa);
  const ipaBase64 = ipaBuffer.toString("base64");
  const ipaSize = ipaBuffer.length;

  logs.push(`[build] Binary ready (${(ipaSize / 1024 / 1024).toFixed(1)} MB)`);
  await signingCleanup?.();
  return {
    ipaBase64,
    originalFilename: path.basename(ipa),
    sizeBytes: ipaSize,
  };
}
