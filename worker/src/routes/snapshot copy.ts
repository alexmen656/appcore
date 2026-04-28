import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import os from "os";
import { execAsync, resolveRepoWorkDir, findConfigFile } from "./shared";
import { createSnapshotJob, getSnapshotJob, type SnapshotJobResult } from "../log-bus";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const LOG_INTERESTING_RE =
  /Test (case|suite)|Testing (started|failed|passed|completed)|TEST (BUILD|EXECUTE|SUCCEEDED|FAILED)|encountered an error|error:|warning:|^\*\*|fatal|timed out|Compile|Linking|CodeSign|^Run-|FAIL/i;

const UDID_RE = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

function filterXcodebuildOutput(output: string | undefined, maxLines = 200): string[] {
  if (!output) return [];
  const lines = output.split("\n").filter(Boolean);
  const interesting = lines.filter((l) => LOG_INTERESTING_RE.test(l));
  if (interesting.length <= maxLines) return interesting;
  const dropped = interesting.length - maxLines;
  return [`[snapshot] (truncated ${dropped} earlier filtered lines)`, ...interesting.slice(-maxLines)];
}

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

  if (!repoUrl || !accessToken || !appName) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  if (!/^https:\/\/[^\s"'`\\;<>&|$(){}[\]]+$/.test(repoUrl)) {
    res.status(400).json({ error: "Invalid repository URL" });
    return;
  }

  if (branch && !/^[a-zA-Z0-9/_.-]+$/.test(branch)) {
    res.status(400).json({ error: "Invalid branch name" });
    return;
  }

  const runId = String(Date.now());
  const { emit: emitLog, finish } = createSnapshotJob(runId);

  res.json({ ok: true, runId });

  runSnapshot(runId, { repoUrl, accessToken, branch, appName, bundleId: "", iosDir, envVars }, emitLog, finish).catch(
    () => {
      /* errors are captured inside runSnapshot */
    },
  );
});

snapshotRouter.get("/snapshot/:runId/stream", (req: Request, res: Response) => {
  const job = getSnapshotJob(req.params.runId as string);
  if (!job) {
    res.status(404).json({ error: "Unknown runId" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  for (const line of job.logs) send("log", line);

  if (job.result) {
    send("result", job.result);
    res.end();
    return;
  }

  const onLine = (line: string) => send("log", line);
  const onResult = (result: unknown) => {
    send("result", result);
    res.end();
  };

  job.emitter.on("line", onLine);
  job.emitter.once("result", onResult);

  req.on("close", () => {
    job.emitter.off("line", onLine);
    job.emitter.off("result", onResult);
  });
});

async function runSnapshot(
  runId: string,
  params: SnapshotRequest & { bundleId: string },
  emitLog: (line: string) => void,
  finish: (result: SnapshotJobResult) => void,
): Promise<void> {
  const { repoUrl, accessToken, branch, appName, iosDir, envVars } = params;

  const tmpDir = path.join(os.tmpdir(), `worker-snapshot-${runId}`);
  const logs: string[] = [];
  const errors: string[] = [];

  const push = (line: string) => {
    logs.push(line);
    emitLog(line);
  };

  const logsDir = path.join(process.cwd(), "logs", "snapshots");
  const logFile = path.join(logsDir, `snapshot-${runId}.log`);

  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.mkdirSync(logsDir, { recursive: true });
    push(`[repo] Cloning repo${branch ? ` @${branch}` : ""} ...`);

    await execAsync(
      `git clone --depth 1 ${branch ? `--branch ${branch}` : ""} "${repoUrl.replace("https://", `https://x-access-token:${accessToken}@`)}" "${tmpDir}"`,
      {
        timeout: 120_000,
      },
    );

    push(`[repo] Clone complete`);

    const workDir = resolveRepoWorkDir(tmpDir, iosDir, logs);
    let descriptions: Record<string, string> = {};
    let frameConfig: Record<string, string> = {};
    let effectiveDevices = DEFAULT_DEVICES;
    let effectiveLanguages = DEFAULT_LANGUAGES;
    let appearance: "light" | "dark" = "light";
    let scheme = appName;

    const configFile = findConfigFile(workDir);

    if (configFile) {
      try {
        const parsed = JSON.parse(fs.readFileSync(configFile, "utf8"));
        const cfg = parsed._config ?? {};

        if (cfg.scheme) {
          const sanitized = cfg.scheme.replace(/[^a-zA-Z0-9 _.\-]/g, "");
          if (sanitized !== cfg.scheme) {
            push(`[config] Warning: scheme name sanitized from "${cfg.scheme}" to "${sanitized}"`);
          }
          scheme = sanitized;
        }

        if (Array.isArray(cfg.devices) && cfg.devices.length) effectiveDevices = cfg.devices;
        if (Array.isArray(cfg.languages) && cfg.languages.length) effectiveLanguages = cfg.languages;
        if (cfg.appearance === "dark" || cfg.appearance === "light") appearance = cfg.appearance;

        const { bgColor1, bgColor2, textColor } = cfg;
        if (bgColor1 || bgColor2 || textColor) {
          frameConfig = Object.fromEntries(
            Object.entries({ bgColor1, bgColor2, textColor }).filter(([, v]) => v != null),
          ) as Record<string, string>;
        }

        const { _config: _, ...rest } = parsed;
        descriptions = rest;

        const descCount = Object.keys(descriptions).length;

        push(
          [
            `[config] Loaded config.json from ${path.relative(workDir, configFile)}`,
            `  - scheme: ${scheme}`,
            `  - devices: ${effectiveDevices.join(", ")}`,
            `  - languages: ${effectiveLanguages.join(", ")}`,
            `  - appearance: ${appearance}`,
            `  - ${plural(descCount, "description")}`,
          ].join("\n"),
        );
      } catch {
        push(`[config] Warning: could not parse ${path.relative(workDir, configFile)}`);
      }
    } else {
      push(
        `[config] No config.json found - using defaults (scheme: ${scheme}, devices: ${effectiveDevices.join(", ")})`,
      );
    }

    const simInfo = await getIosSimulatorInfo();
    push(`[snapshot] Detected iOS simulator version: ${simInfo?.version ?? "unknown"}`);

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
      push(
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

    push(
      `[snapshot] Running xcodebuild sequentially for ${snapDevices.length} device(s):\n           - ${snapDevices.join("\n           - ")}`,
    );

    for (const udid of snapDevices.filter((d) => UDID_RE.test(d))) {
      try {
        await execAsync(`xcrun simctl bootstatus "${udid}" -b`, { timeout: 120_000 });
        await execAsync(`xcrun simctl ui "${udid}" appearance ${appearance}`);
        await execAsync(`xcrun simctl shutdown "${udid}"`);
      } catch {
        push(`[snapshot] Warning: could not set appearance on ${udid}`);
      }
    }

    const screenshots: Record<string, Array<{ filename: string; data: string }>> = {};

    for (const lang of effectiveLanguages) {
      const [langCode, regionCode] = lang.split("-");
      const localeId = regionCode ? `${langCode}_${regionCode}` : langCode;

      for (const device of snapDevices) {
        const deviceLabel = UDID_RE.test(device) ? device.slice(0, 8) + "…" : device;
        const destination = UDID_RE.test(device)
          ? `-destination 'id=${device}'`
          : `-destination 'platform=iOS Simulator,name=${device}'`;

        const derivedDataPath = path.join(tmpDir, `DerivedData-${device.replace(/[^a-zA-Z0-9]/g, "_")}`);
        const testLogsDir = path.join(derivedDataPath, "Logs", "Test");

        push(`[snapshot] [${deviceLabel}] ${lang} — running UI tests ...`);

        let testFailed = false;
        try {
          const testStart = Date.now();
          const xcodebuildCmd = `xcodebuild ${projectArg} -scheme "${scheme}" ${destination} -derivedDataPath "${derivedDataPath}" -parallel-testing-enabled NO TEST_RUNNER_XCUITESTS_LANGUAGE=${lang} TEST_RUNNER_XCUITESTS_LOCALE=${localeId} build test`;
          push(`[snapshot] Command: ${xcodebuildCmd}`);

          const { stdout } = await execAsync(`${xcodebuildCmd} 2>&1`, {
            cwd: workDir,
            timeout: 1800_000,
            env: { ...process.env, ...(envVars ?? {}) },
            maxBuffer: 10 * 1024 * 1024,
          });
          filterXcodebuildOutput(stdout).forEach(push);
          push(`[snapshot] [${deviceLabel}] ${lang}: finished in ${Math.round((Date.now() - testStart) / 1000)}s`);
        } catch (execErr) {
          const e = execErr as { stdout?: string; stderr?: string; message?: string; code?: number };
          filterXcodebuildOutput(e.stdout).forEach(push);
          filterXcodebuildOutput(e.stderr).forEach(push);
          push(`[snapshot] [${deviceLabel}] ${lang}: tests failed (extracting any captured screenshots anyway)`);
          testFailed = true;
        }

        if (fs.existsSync(testLogsDir)) {
          const xcResults = fs.readdirSync(testLogsDir).filter((n) => n.endsWith(".xcresult"));
          const collected: string[] = [];
          for (const xcName of xcResults) {
            const xcPath = path.join(testLogsDir, xcName);
            const extractDir = path.join(
              tmpDir,
              `attachments-${lang}-${device.replace(/[^a-zA-Z0-9]/g, "_")}-${xcName}`,
            );
            fs.mkdirSync(extractDir, { recursive: true });
            try {
              await execAsync(
                `xcrun xcresulttool export attachments --path "${xcPath}" --output-path "${extractDir}"`,
                {
                  timeout: 120_000,
                  maxBuffer: 10 * 1024 * 1024,
                },
              );
            } catch {
              push(`[snapshot] Warning: xcresulttool export failed for ${xcName}`);
              continue;
            }

            const walk = (dir: string) => {
              for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) walk(full);
                else if (/\.(png|jpg|jpeg)$/i.test(entry.name) && entry.name.startsWith(`${lang}__`)) {
                  const cleanName = entry.name.replace(`${lang}__`, "");
                  (screenshots[lang] ??= []).push({
                    filename: cleanName,
                    data: fs.readFileSync(full).toString("base64"),
                  });
                  collected.push(cleanName);
                }
              }
            };
            walk(extractDir);
          }
          push(
            `[snapshot] [${deviceLabel}] ${lang}: extracted ${plural(collected.length, "screenshot")}${testFailed ? " (some tests failed)" : ""}`,
          );

          for (const xcName of xcResults) {
            fs.rmSync(path.join(testLogsDir, xcName), { recursive: true, force: true });
          }
        } else {
          push(`[snapshot] [${deviceLabel}] ${lang}: no test logs directory at ${testLogsDir}`);
        }
      }
    }

    push("[snapshot] Snapshot completed");
    const totalFiles = Object.values(screenshots).reduce((n, a) => n + a.length, 0);
    push(
      `[snapshot] Total: ${plural(totalFiles, "screenshot")} across ${plural(Object.keys(screenshots).length, "language")}`,
    );

    finish({ ok: true, logs, errors, screenshots, descriptions, config: frameConfig });
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    finish({ ok: false, logs, errors, screenshots: {}, descriptions: {}, config: {} });
  } finally {
    try {
      fs.mkdirSync(logsDir, { recursive: true });
      fs.writeFileSync(logFile, [...logs, ...errors].join("\n"), "utf8");
    } catch {
      /* ignore */
    }
    try {
      const debugDir = "/tmp/last-snapshot-debug";
      fs.rmSync(debugDir, { recursive: true, force: true });
      fs.mkdirSync(debugDir, { recursive: true });

      for (const entry of fs.readdirSync(tmpDir).filter((e) => e.startsWith("DerivedData-"))) {
        const testLogsDir = path.join(tmpDir, entry, "Logs", "Test");
        if (fs.existsSync(testLogsDir)) {
          for (const xcEntry of fs.readdirSync(testLogsDir)) {
            if (xcEntry.endsWith(".xcresult")) {
              fs.cpSync(path.join(testLogsDir, xcEntry), path.join(debugDir, `${entry}-${xcEntry}`), {
                recursive: true,
              });
            }
          }
        }
      }
    } catch {
      /* ignore */
    }
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}
