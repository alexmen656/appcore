import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import os from "os";
import { execAsync, resolveRepoWorkDir } from "./shared";

async function getIosSimulatorInfo(): Promise<{
  version: string;
  devices: Array<{ name: string; udid: string }>;
} | null> {
  try {
    const { stdout } = await execAsync("xcrun simctl list --json");
    const data = JSON.parse(stdout) as {
      runtimes: Array<{
        platform: string;
        version: string;
        isAvailable: boolean;
        identifier: string;
      }>;
      devices: Record<
        string,
        Array<{ name: string; udid: string; isAvailable: boolean }>
      >;
    };

    const runtime = data.runtimes
      .filter((r) => r.platform === "iOS" && r.isAvailable)
      .sort((a, b) =>
        b.version.localeCompare(a.version, undefined, { numeric: true }),
      )[0];

    if (!runtime) return null;

    const devices = (data.devices[runtime.identifier] ?? [])
      .filter((d) => d.isAvailable)
      .map((d) => ({ name: d.name, udid: d.udid }));

    return { version: runtime.version, devices };
  } catch {
    return null;
  }
}

function resolveSimulatorUdid(
  requested: string,
  available: Array<{ name: string; udid: string }>,
): string | null {
  const lower = requested.toLowerCase();
  const exact = available.find((d) => d.name === requested);
  if (exact) return exact.udid;
  const ci = available.find((d) => d.name.toLowerCase() === lower);
  if (ci) return ci.udid;
  const stripped = requested
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .toLowerCase();
  if (stripped && stripped !== lower) {
    const baseMatch = available.find((d) =>
      d.name.toLowerCase().startsWith(stripped),
    );
    if (baseMatch) return baseMatch.udid;
  }
  const words = lower.split(/\s+/).filter((w) => !w.startsWith("("));
  const wordMatch = available.find((d) =>
    words.every((w) => d.name.toLowerCase().includes(w)),
  );
  if (wordMatch) return wordMatch.udid;
  return null;
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
}

const DEFAULT_LANGUAGES = ["en-US"];
const DEFAULT_DEVICES = [
  "iPhone 16 Pro Max",
  "iPhone 16",
  "iPhone SE (3rd generation)",
  "iPad Pro 13-inch (M4)",
];

function findConfigFile(dir: string): string | null {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "fastlane") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findConfigFile(full);
      if (found) return found;
    } else if (entry.name === "config.json") {
      return full;
    }
  }
  return null;
}

snapshotRouter.post("/snapshot", async (req: Request, res: Response) => {
  const body = req.body as SnapshotRequest;
  const { repoUrl, accessToken, branch, appName, bundleId, iosDir } = body;

  if (!repoUrl || !accessToken) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const tmpDir = path.join(os.tmpdir(), `worker-snapshot-${Date.now()}`);
  const logs: string[] = [];
  const errors: string[] = [];

  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    const cloneUrl = repoUrl.replace(
      "https://",
      `https://x-access-token:${accessToken}@`,
    );

    const branchArg = branch ? `--branch ${branch}` : "";
    logs.push(`Cloning repo ${branch ? ` @${branch}` : ""} ...`);

    await execAsync(
      `git clone --depth 1 ${branchArg} "${cloneUrl}" "${tmpDir}"`,
      { timeout: 120_000 },
    );

    logs.push("Clone complete");

    const workDir = resolveRepoWorkDir(tmpDir, iosDir, logs);
    let descriptions: Record<string, string> = {};
    let frameConfig: Record<string, string> = {};
    let scheme = appName;
    let effectiveDevices = DEFAULT_DEVICES;
    let effectiveLanguages = DEFAULT_LANGUAGES;

    const configFile = findConfigFile(workDir);
    if (configFile) {
      try {
        const parsed = JSON.parse(fs.readFileSync(configFile, "utf8"));
        const cfg = parsed._config ?? {};

        if (cfg.scheme) scheme = cfg.scheme;
        if (Array.isArray(cfg.devices) && cfg.devices.length)
          effectiveDevices = cfg.devices;
        if (Array.isArray(cfg.languages) && cfg.languages.length)
          effectiveLanguages = cfg.languages;
        if (cfg.bgColor1 || cfg.bgColor2 || cfg.textColor) {
          frameConfig = {
            bgColor1: cfg.bgColor1,
            bgColor2: cfg.bgColor2,
            textColor: cfg.textColor,
          };
        }

        const { _config: _, ...rest } = parsed;
        descriptions = rest;

        logs.push(
          `Loaded config.json from ${path.relative(workDir, configFile)} — scheme: ${scheme}, devices: ${effectiveDevices.join(", ")}, languages: ${effectiveLanguages.join(", ")}, ${Object.keys(descriptions).length} description(s)`,
        );
      } catch {
        logs.push(
          `Warning: could not parse ${path.relative(workDir, configFile)}`,
        );
      }
    } else {
      logs.push(
        `No config.json found — using defaults (scheme: ${scheme}, devices: ${effectiveDevices.join(", ")})`,
      );
    }

    const simInfo = await getIosSimulatorInfo();

    logs.push(
      `[snapshot] Detected iOS simulator version: ${simInfo?.version ?? "unknown — will let fastlane pick"}`,
    );

    const snapDevices = effectiveDevices.map((d) => {
      if (simInfo) {
        const udid = resolveSimulatorUdid(d, simInfo.devices);
        if (udid) {
          const matched = simInfo.devices.find((s) => s.udid === udid)!;
          if (matched.name !== d)
            logs.push(`[snapshot] Device "${d}" → "${matched.name}" (${udid})`);
          else logs.push(`[snapshot] Device "${d}" → ${udid}`);
          return udid;
        }
      }
      return d;
    });

    const wsFile = fs
      .readdirSync(workDir)
      .find((f) => f.endsWith(".xcworkspace"));
    const projFile = fs
      .readdirSync(workDir)
      .find((f) => f.endsWith(".xcodeproj"));
    const projectArg = wsFile
      ? `-workspace "${wsFile}"`
      : projFile
        ? `-project "${projFile}"`
        : `-project "${scheme}.xcodeproj"`;

    const fastlaneCacheDir = path.join(
      os.homedir(),
      "Library",
      "Caches",
      "tools.fastlane",
      "screenshots",
    );
    const screenshotsDir = path.join(workDir, "fastlane", "screenshots");

    const destinations = snapDevices
      .map((d) =>
        d.includes("-")
          ? `-destination 'id=${d}'`
          : `-destination 'platform=iOS Simulator,name=${d}'`,
      )
      .join(" ");

    logs.push(
      `[snapshot] Running xcodebuild directly with destinations: ${snapDevices.join(", ")}`,
    );

    for (const lang of effectiveLanguages) {
      fs.rmSync(fastlaneCacheDir, { recursive: true, force: true });
      fs.mkdirSync(fastlaneCacheDir, { recursive: true });

      logs.push(
        `[snapshot] Language: ${lang} — building and running UI tests ...`,
      );
      try {
        const { stdout } = await execAsync(
          `set -o pipefail && xcodebuild ${projectArg} -scheme "${scheme}" ${destinations} FASTLANE_SNAPSHOT=YES FASTLANE_LANGUAGE=${lang} build test 2>&1 | xcpretty --no-color || true`,
          {
            cwd: workDir,
            timeout: 900_000,
            env: { ...process.env },
            maxBuffer: 10 * 1024 * 1024,
          },
        );
        if (stdout) logs.push(...stdout.split("\n").filter(Boolean));
      } catch (execErr: any) {
        if (execErr.stdout)
          logs.push(...execErr.stdout.split("\n").filter(Boolean));
        if (execErr.stderr)
          logs.push(...execErr.stderr.split("\n").filter(Boolean));
        throw new Error(
          `xcodebuild failed for language ${lang}: ${execErr.message}`,
        );
      }

      if (fs.existsSync(fastlaneCacheDir)) {
        const langDir = path.join(screenshotsDir, lang);
        fs.mkdirSync(langDir, { recursive: true });
        let copied = 0;
        for (const file of fs.readdirSync(fastlaneCacheDir)) {
          if (/\.(png|jpg|jpeg)$/i.test(file)) {
            fs.copyFileSync(
              path.join(fastlaneCacheDir, file),
              path.join(langDir, file),
            );
            copied++;
          }
        }
        logs.push(`[snapshot] ${lang}: copied ${copied} screenshot(s)`);
      }
    }

    logs.push("fastlane snapshot completed");

    const screenshots: Record<
      string,
      Array<{ filename: string; data: string }>
    > = {};

    if (fs.existsSync(screenshotsDir)) {
      const collectImages = (dir: string, locale: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            collectImages(full, entry.name);
          } else if (/\.(png|jpg|jpeg)$/i.test(entry.name)) {
            if (!screenshots[locale]) screenshots[locale] = [];
            const data = fs.readFileSync(full).toString("base64");
            screenshots[locale].push({ filename: entry.name, data });
          }
        }
      };

      collectImages(screenshotsDir, "default");

      const totalFiles = Object.values(screenshots).reduce(
        (n, a) => n + a.length,
        0,
      );

      logs.push(
        `Collected ${totalFiles} screenshot(s) across ${Object.keys(screenshots).length} locale(s)`,
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
  } catch (err: any) {
    errors.push(err.message);
    res.json({ ok: false, logs, errors, screenshots: {} });
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});
