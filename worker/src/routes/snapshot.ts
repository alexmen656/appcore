import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import os from "os";
import { execAsync, resolveRepoWorkDir, findConfigFile } from "./shared";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

async function getIosSimulatorInfo(): Promise<{
  version: string;
  devices: Array<{ name: string; udid: string }>;
} | null> {
  try {
    const { stdout } = await execAsync("xcrun simctl list --json");
    const data = JSON.parse(stdout) as any;
    const runtime = data.runtimes
      .filter((r: any) => r.platform === "iOS" && r.isAvailable)
      .sort((a: any, b: any) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0];

    if (!runtime) return null;

    const devices = (data.devices[runtime.identifier] ?? [])
      .filter((d: any) => d.isAvailable)
      .map((d: any) => ({ name: d.name, udid: d.udid }));
    return { version: runtime.version, devices };
  } catch {
    return null;
  }
}

function resolveSimulatorUdid(requested: string, available: Array<{ name: string; udid: string }>): string | null {
  const lower = requested.toLowerCase();
  const find = (pred: (d: { name: string }) => boolean) => available.find(pred)?.udid ?? null;

  const stripped = requested
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .toLowerCase();
  return (
    find((d) => d.name === requested) ??
    find((d) => d.name.toLowerCase() === lower) ??
    (stripped && stripped !== lower ? find((d) => d.name.toLowerCase().startsWith(stripped)) : null) ??
    find((d) =>
      lower
        .split(/\s+/)
        .filter((w) => !w.startsWith("("))
        .every((w) => d.name.toLowerCase().includes(w)),
    )
  );
}

export const snapshotRouter = Router();

interface SnapshotRequest {
  repoUrl: string;
  accessToken: string;
  branch?: string;
  appName: string;
  bundleId: string;
  iosDir?: string;
  exportMethod?: string;
  envVars?: Record<string, string>;
}

const DEFAULT_LANGUAGES = ["en-US"];
const DEFAULT_DEVICES = [
  "iPhone 16 Pro Max",
  "iPhone 16",
  "iPhone SE (3rd generation)",
  "iPad Pro (12.9-inch) (4th generation)",
];

snapshotRouter.post("/snapshot", async (req: Request, res: Response) => {
  const { repoUrl, accessToken, branch, appName, iosDir, envVars } = req.body as SnapshotRequest;

  if (!repoUrl || !accessToken) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  if (branch && !/^[a-zA-Z0-9/_.-]+$/.test(branch)) {
    res.status(400).json({ error: "Invalid branch name" });
    return;
  }

  const tmpDir = path.join(os.tmpdir(), `worker-snapshot-${Date.now()}`);
  const logs: string[] = [];
  const errors: string[] = [];

  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    const cloneUrl = repoUrl.replace("https://", `https://x-access-token:${accessToken}@`);
    logs.push(`[repo] Cloning repo${branch ? ` @${branch}` : ""} ...`);

    await execAsync(`git clone --depth 1 ${branch ? `--branch ${branch}` : ""} "${cloneUrl}" "${tmpDir}"`, {
      timeout: 120_000,
    });
    logs.push(`[repo] Clone complete`);

    const workDir = resolveRepoWorkDir(tmpDir, iosDir, logs);
    let descriptions: Record<string, string> = {};
    let frameConfig: Record<string, string> = {};
    let scheme = appName;
    let effectiveDevices = DEFAULT_DEVICES;
    let effectiveLanguages = DEFAULT_LANGUAGES;
    let appearance: "light" | "dark" = "light";

    const configFile = findConfigFile(workDir);
    if (configFile) {
      try {
        const parsed = JSON.parse(fs.readFileSync(configFile, "utf8"));
        const cfg = parsed._config ?? {};

        if (cfg.scheme) {
          const sanitized = cfg.scheme.replace(/[^a-zA-Z0-9 _.\-]/g, "");
          if (sanitized !== cfg.scheme) {
            logs.push(`[config] Warning: scheme name sanitized from "${cfg.scheme}" to "${sanitized}"`);
          }
          scheme = sanitized;
        }

        if (Array.isArray(cfg.devices) && cfg.devices.length) effectiveDevices = cfg.devices;
        if (Array.isArray(cfg.languages) && cfg.languages.length) effectiveLanguages = cfg.languages;
        if (cfg.appearance === "dark" || cfg.appearance === "light") appearance = cfg.appearance;

        const { bgColor1, bgColor2, textColor } = cfg;
        if (bgColor1 || bgColor2 || textColor) frameConfig = { bgColor1, bgColor2, textColor };

        const { _config: _, ...rest } = parsed;
        descriptions = rest;

        const descCount = Object.keys(descriptions).length;

        logs.push(
          `[config] Loaded config.json from ${path.relative(workDir, configFile)}
            - scheme: ${scheme}
            - devices: ${effectiveDevices.join(", ")}
            - languages: ${effectiveLanguages.join(", ")}
            - appearance: ${appearance}
            - ${plural(descCount, "description")}`,
        );
      } catch {
        logs.push(`[config] Warning: could not parse ${path.relative(workDir, configFile)}`);
      }
    } else {
      logs.push(
        `[config] No config.json found — using defaults (scheme: ${scheme}, devices: ${effectiveDevices.join(", ")})`,
      );
    }

    const simInfo = await getIosSimulatorInfo();
    logs.push(`[snapshot] Detected iOS simulator version: ${simInfo?.version ?? "unknown — will let fastlane pick"}`);

    const snapDevices: string[] = [];
    for (const d of effectiveDevices) {
      if (!simInfo) {
        snapDevices.push(d);
        continue;
      }

      const udid = resolveSimulatorUdid(d, simInfo.devices);
      if (!udid) {
        snapDevices.push(d);
        continue;
      }

      const matched = simInfo.devices.find((s) => s.udid === udid) ?? { name: d };
      logs.push(
        matched.name !== d
          ? `[snapshot] Device "${d}" → "${matched.name}" (${udid})`
          : `[snapshot] Device "${d}" → ${udid}`,
      );
      snapDevices.push(udid);
    }

    const entries = fs.readdirSync(workDir);
    const wsFile = entries.find((f) => f.endsWith(".xcworkspace"));
    const projFile = entries.find((f) => f.endsWith(".xcodeproj"));
    const projectArg = wsFile
      ? `-workspace "${wsFile}"`
      : projFile
        ? `-project "${projFile}"`
        : `-project "${scheme}.xcodeproj"`;

    const fastlaneCacheBase = path.join(os.homedir(), "Library", "Caches", "tools.fastlane");
    const fastlaneCacheDir = path.join(fastlaneCacheBase, "screenshots");
    const screenshotsDir = path.join(workDir, "fastlane", "screenshots");
    const destinations = snapDevices
      .map((d) => (d.includes("-") ? `-destination 'id=${d}'` : `-destination 'platform=iOS Simulator,name=${d}'`))
      .join(" ");

    logs.push(`[snapshot] Running xcodebuild with destinations:\n           - ${snapDevices.join("\n           - ")}`);

    for (const udid of snapDevices.filter((d) => d.includes("-"))) {
      try {
        await execAsync(`xcrun simctl boot "${udid}" 2>/dev/null || true`);
        await execAsync(`xcrun simctl ui "${udid}" appearance ${appearance}`);
        await execAsync(`xcrun simctl shutdown "${udid}" 2>/dev/null || true`);
      } catch {
        logs.push(`[snapshot] Warning: could not set appearance on ${udid}`);
      }
    }
    if (snapDevices.some((d) => d.includes("-"))) {
      logs.push(`[snapshot] Simulator appearance set to ${appearance}`);
    }

    for (const lang of effectiveLanguages) {
      fs.rmSync(fastlaneCacheDir, { recursive: true, force: true });
      fs.mkdirSync(fastlaneCacheDir, { recursive: true });

      const [langCode, regionCode] = lang.split("-");
      const localeId = regionCode ? `${langCode}_${regionCode}` : langCode;

      fs.writeFileSync(path.join(fastlaneCacheBase, "language.txt"), lang, "utf8");
      fs.writeFileSync(path.join(fastlaneCacheBase, "locale.txt"), localeId, "utf8");

      if (envVars && Object.keys(envVars).length > 0) {
        fs.writeFileSync(path.join(fastlaneCacheBase, "snapshot-env.json"), JSON.stringify(envVars), "utf8");
        logs.push(`[snapshot] Wrote snapshot-env.json with keys: ${Object.keys(envVars).join(", ")}`);
      } else {
        logs.push(
          `[snapshot] Warning: no envVars provided — snapshot-env.json not written; UI tests requiring login credentials will fail`,
        );
      }
      logs.push(`[snapshot] Language: ${lang} (locale: ${localeId}) — building and running UI tests ...`);

      try {
        const hostHome = os.homedir();
        const xcodebuildCmd = `xcodebuild ${projectArg} -scheme "${scheme}" ${destinations} FASTLANE_SNAPSHOT=YES FASTLANE_LANGUAGE=${lang} TEST_RUNNER_SIMULATOR_HOST_HOME="${hostHome}" build test`;
        logs.push(`[snapshot] Command: ${xcodebuildCmd}`);

        const { stdout } = await execAsync(`${xcodebuildCmd} 2>&1`, {
          cwd: workDir,
          timeout: 900_000,
          env: { ...process.env, ...(envVars ?? {}) },
          maxBuffer: 10 * 1024 * 1024,
        });
        if (stdout) logs.push(...stdout.split("\n").filter(Boolean));
      } catch (execErr) {
        const e = execErr as { stdout?: string; stderr?: string; message?: string; code?: number };
        if (e.stdout) logs.push(...e.stdout.split("\n").filter(Boolean));
        if (e.stderr) logs.push(...e.stderr.split("\n").filter(Boolean));
        throw new Error(`xcodebuild failed for language ${lang}: ${e.message ?? String(execErr)}`);
      }

      if (fs.existsSync(fastlaneCacheDir)) {
        const langDir = path.join(screenshotsDir, lang);
        fs.mkdirSync(langDir, { recursive: true });

        const images = fs.readdirSync(fastlaneCacheDir).filter((f) => /\.(png|jpg|jpeg)$/i.test(f));
        for (const file of images) fs.copyFileSync(path.join(fastlaneCacheDir, file), path.join(langDir, file));
        logs.push(`[snapshot] ${lang}: copied ${plural(images.length, "screenshot")}`);
      }
    }

    logs.push("[snapshot] Snapshot completed");

    const screenshots: Record<string, Array<{ filename: string; data: string }>> = {};
    if (fs.existsSync(screenshotsDir)) {
      const collectImages = (dir: string, locale: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) collectImages(full, entry.name);
          else if (/\.(png|jpg|jpeg)$/i.test(entry.name))
            (screenshots[locale] ??= []).push({
              filename: entry.name,
              data: fs.readFileSync(full).toString("base64"),
            });
        }
      };

      collectImages(screenshotsDir, "default");
      const totalFiles = Object.values(screenshots).reduce((n, a) => n + a.length, 0);
      logs.push(
        `[snapshot] Collected ${plural(totalFiles, "screenshot")} across ${plural(Object.keys(screenshots).length, "locale")}`,
      );
    } else {
      logs.push("No screenshots directory found after run");
    }

    res.json({
      ok: true,
      logs,
      errors,
      screenshots,
      descriptions,
      config: frameConfig,
    });
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    res.json({ ok: false, logs, errors, screenshots: {} });
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});
