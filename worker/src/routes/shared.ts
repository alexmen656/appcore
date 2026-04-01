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
    if (entry.isDirectory()) { const found = findConfigFile(full); if (found) return found; }
    else if (entry.name === "config.json") return full;
  }
  return null;
}

export const BUILDS_BASE_DIR = path.join(
  os.homedir(),
  "appcore",
  "appcore-builds",
);

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
  logs.push("[signing] Cert and profile written to temp dir");

  let profileUuid = "";
  try {
    const { stdout } = await execAsync(
      `security cms -D -i "${profilePath}" 2>/dev/null | plutil -extract UUID raw -`,
    );
    profileUuid = stdout.trim();
    logs.push(`[signing] Profile UUID: ${profileUuid}`);
  } catch {
    profileUuid = `appcore-${Date.now()}`;
    logs.push(
      `[signing] Could not extract UUID — using fallback: ${profileUuid}`,
    );
  }

  fs.mkdirSync(profilesDir, { recursive: true });

  const destProfile = path.join(profilesDir, `${profileUuid}.mobileprovision`);
  fs.copyFileSync(profilePath, destProfile);

  logs.push(`[signing] Profile installed → ${destProfile}`);
  logs.push(`[signing] Creating keychain: ${keychainName}`);

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
  logs.push("[signing] Keychain added to search list");

  await execAsync(
    `security import "${p12Path}" -k "${keychainName}" -P "${creds.p12Password}" -T /usr/bin/codesign -T /usr/bin/security -f pkcs12`,
  );
  await execAsync(
    `security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "${keychainPassword}" "${keychainName}"`,
  );
  logs.push("[signing] .p12 imported successfully");

  const cleanup = async () => {
    try {
      await execAsync(`security delete-keychain "${keychainName}"`);
      logs.push("[signing] Temporary keychain deleted");
    } catch {
      /* ignore */
    }
    try {
      fs.rmSync(destProfile, { force: true });
      logs.push("[signing] Installed profile removed");
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
): Promise<string | undefined> {
  logs.push(
    `[gym] Starting build — scheme: ${gymScheme ?? appName}, export: ${exportMethod}`,
  );

  let signingCleanup: (() => Promise<void>) | undefined;
  let installedProfileUuid: string | undefined;
  if (signingCreds) {
    logs.push("[gym] Installing signing credentials ...");
    const { cleanup, profileUuid } = await installSigningCreds(signingCreds, logs);
    signingCleanup = cleanup;
    installedProfileUuid = profileUuid;
    logs.push("[gym] Signing credentials installed");
  } else {
    logs.push(
      "[gym] No signing credentials provided — build may fail at code-signing step",
    );
  }

  const fastlaneDir = path.join(repoDir, "fastlane");
  fs.mkdirSync(fastlaneDir, { recursive: true });

  const gymfilePath = path.join(fastlaneDir, "Gymfile");
  if (!fs.existsSync(gymfilePath)) {
    logs.push("[gym] No Gymfile found — creating default Gymfile");
    const scheme = gymScheme ?? appName;
    const gymfileLines = [
      `# Auto-generated by AppCore Worker`,
      `scheme("${scheme}")`,
      `export_method("${exportMethod}")`,
      `clean(false)`,
      `output_directory("./build")`,
      `output_name("${bundleId}")`,
    ];
    if (installedProfileUuid) {
      const xcargs = [
        `CODE_SIGN_STYLE=Manual`,
        `CODE_SIGN_IDENTITY=\\"iPhone Distribution\\"`,
        `PROVISIONING_PROFILE_SPECIFIER=${installedProfileUuid}`,
        signingCreds?.teamId ? `DEVELOPMENT_TEAM=${signingCreds.teamId}` : "",
      ].filter(Boolean).join(" ");
      gymfileLines.push(`xcargs("${xcargs}")`);
      gymfileLines.push(
        `export_options({`,
        `  method: "${exportMethod}",`,
        `  signingStyle: "manual",`,
        `  provisioningProfiles: {`,
        `    "${bundleId}" => "${installedProfileUuid}"`,
        `  }`,
        `})`,
      );
    } else {
      gymfileLines.push(
        `export_options({`,
        `  method: "${exportMethod}",`,
        `  signingStyle: "automatic"`,
        `})`,
      );
    }
    fs.writeFileSync(gymfilePath, gymfileLines.join("\n"));
    logs.push(`[gym] Gymfile written:\n${gymfileLines.join("\n")}`);
  } else {
    logs.push("[gym] Using existing Gymfile");
    logs.push(
      `[gym] Gymfile contents:\n${fs.readFileSync(gymfilePath, "utf8")}`,
    );
  }

  const buildDir = path.join(repoDir, "build");
  fs.mkdirSync(buildDir, { recursive: true });

  logs.push(`[gym] Running fastlane gym ...`);
  const gymStart = Date.now();
  try {
    const { stdout } = await execAsync(`${fastlanePath} gym 2>&1`, {
      cwd: repoDir,
      timeout: 900_000,
      env: { ...process.env, FASTLANE_DISABLE_COLORS: "1" },
      maxBuffer: 10 * 1024 * 1024,
    });
    if (stdout) logs.push(...stdout.split("\n").filter(Boolean));
    logs.push(
      `[gym] fastlane gym finished in ${Math.round((Date.now() - gymStart) / 1000)}s`,
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
      `[gym] FAILED after ${Math.round((Date.now() - gymStart) / 1000)}s — exit code: ${gymErr.code ?? "unknown"}`,
    );
    await signingCleanup?.();
    throw new Error(
      `fastlane gym exited with code ${gymErr.code ?? "unknown"}.`,
    );
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

  const ipaFile = findIpa(buildDir) ?? findIpa(repoDir);
  if (!ipaFile) {
    await signingCleanup?.();
    throw new Error("gym completed but no .ipa file was found");
  }
  logs.push(`[gym] IPA found at: ${ipaFile}`);

  const buildsDir = path.join(BUILDS_BASE_DIR, bundleId);
  const historyDir = path.join(buildsDir, "history");
  fs.mkdirSync(buildsDir, { recursive: true });
  fs.mkdirSync(historyDir, { recursive: true });
  const destIpa = path.join(buildsDir, "latest.ipa");
  const destIpa2 = path.join(historyDir, `${Date.now()}.ipa`);
  fs.copyFileSync(ipaFile, destIpa);
  fs.copyFileSync(ipaFile, destIpa2);
  const ipaSize = fs.statSync(destIpa).size;
  fs.writeFileSync(
    path.join(buildsDir, "latest.json"),
    JSON.stringify(
      {
        builtAt: new Date().toISOString(),
        originalFilename: path.basename(ipaFile),
        bundleId,
        exportMethod,
        sizeBytes: ipaSize,
      },
      null,
      2,
    ),
  );

  logs.push(
    `[gym] IPA saved → ${destIpa} (${(ipaSize / 1024 / 1024).toFixed(1)} MB)`,
  );
  await signingCleanup?.();
  return destIpa;
}
