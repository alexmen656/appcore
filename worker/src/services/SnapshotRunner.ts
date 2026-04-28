import fs from "fs";
import path from "path";
import os from "os";
import { execAsync, resolveRepoWorkDir, findConfigFile } from "../routes/shared";
import { type SnapshotJobResult } from "../log-bus";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const LOG_INTERESTING_RE =
  /Test (case|suite)|Testing (started|failed|passed|completed)|TEST (BUILD|EXECUTE|SUCCEEDED|FAILED)|encountered an error|error:|warning:|^\*\*|fatal|timed out|Compile|Linking|CodeSign|^Run-|FAIL/i;

const UDID_RE = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

const DEFAULT_LANGUAGES = ["en-US"];
const DEFAULT_DEVICES = [
  "iPhone 16 Pro Max",
  "iPhone 16",
  "iPhone SE (3rd generation)",
  "iPad Pro (12.9-inch) (4th generation)",
];

export interface SnapshotParams {
  repoUrl: string;
  accessToken: string;
  branch?: string;
  appName: string;
  iosDir?: string;
  envVars?: Record<string, string>;
}

export class SnapshotRunner {
  private readonly runId: string;
  private readonly params: SnapshotParams;
  private readonly emitLog: (line: string) => void;
  private readonly finish: (result: SnapshotJobResult) => void;

  private readonly tmpDir: string;
  private readonly logsDir: string;
  private readonly logFile: string;
  private readonly logs: string[] = [];
  private readonly errors: string[] = [];

  constructor(
    runId: string,
    params: SnapshotParams,
    emitLog: (line: string) => void,
    finish: (result: SnapshotJobResult) => void,
  ) {
    this.runId = runId;
    this.params = params;
    this.emitLog = emitLog;
    this.finish = finish;

    this.tmpDir = path.join(os.tmpdir(), `worker-snapshot-${runId}`);
    this.logsDir = path.join(process.cwd(), "logs", "snapshots");
    this.logFile = path.join(this.logsDir, `snapshot-${runId}.log`);
  }

  async run(): Promise<void> {
    try {
      await this.execute();
    } finally {
      this.writeLogs();
      this.copyDebugArtifacts();
      this.cleanup();
    }
  }

  // ---------------------------------------------------------------------------
  // Core execution
  // ---------------------------------------------------------------------------

  private async execute(): Promise<void> {
    const { repoUrl, accessToken, branch, appName, iosDir, envVars } = this.params;

    fs.mkdirSync(this.tmpDir, { recursive: true });
    fs.mkdirSync(this.logsDir, { recursive: true });
    this.push(`[repo] Cloning repo${branch ? ` @${branch}` : ""} ...`);

    await execAsync(
      `git clone --depth 1 ${branch ? `--branch ${branch}` : ""} "${repoUrl.replace("https://", `https://x-access-token:${accessToken}@`)}" "${this.tmpDir}"`,
      { timeout: 120_000 },
    );

    this.push(`[repo] Clone complete`);

    const workDir = resolveRepoWorkDir(this.tmpDir, iosDir, this.logs);

    let descriptions: Record<string, string> = {};
    let frameConfig: Record<string, string> = {};
    let effectiveDevices = DEFAULT_DEVICES;
    let effectiveLanguages = DEFAULT_LANGUAGES;
    let appearance: "light" | "dark" = "light";
    let scheme = appName;

    const configFile = findConfigFile(workDir);

    if (configFile) {
      ({ descriptions, frameConfig, effectiveDevices, effectiveLanguages, appearance, scheme } = this.loadConfig(
        configFile,
        workDir,
        scheme,
        effectiveDevices,
        effectiveLanguages,
      ));
    } else {
      this.push(
        `[config] No config.json found - using defaults (scheme: ${scheme}, devices: ${effectiveDevices.join(", ")})`,
      );
    }

    const simInfo = await SnapshotRunner.getIosSimulatorInfo();
    this.push(`[snapshot] Detected iOS simulator version: ${simInfo?.version ?? "unknown"}`);

    const snapDevices = await this.resolveSnapDevices(effectiveDevices, simInfo);
    const entries = fs.readdirSync(workDir);
    const wsFile = entries.find((f) => f.endsWith(".xcworkspace"));
    const projFile = entries.find((f) => f.endsWith(".xcodeproj"));
    const projectArg = wsFile
      ? `-workspace "${wsFile}"`
      : projFile
        ? `-project "${projFile}"`
        : `-project "${scheme}.xcodeproj"`;

    this.push(
      `[snapshot] Running xcodebuild sequentially for ${snapDevices.length} device(s):\n           - ${snapDevices.join("\n           - ")}`,
    );

    await this.bootSimulators(snapDevices, appearance);

    const screenshots = await this.captureScreenshots(
      effectiveLanguages,
      snapDevices,
      scheme,
      projectArg,
      workDir,
      envVars,
    );

    this.push("[snapshot] Snapshot completed");
    const totalFiles = Object.values(screenshots).reduce((n, a) => n + a.length, 0);
    this.push(
      `[snapshot] Total: ${plural(totalFiles, "screenshot")} across ${plural(Object.keys(screenshots).length, "language")}`,
    );

    this.finish({ ok: true, logs: this.logs, errors: this.errors, screenshots, descriptions, config: frameConfig });
  }

  // ---------------------------------------------------------------------------
  // Config loading
  // ---------------------------------------------------------------------------

  private loadConfig(
    configFile: string,
    workDir: string,
    defaultScheme: string,
    defaultDevices: string[],
    defaultLanguages: string[],
  ): {
    descriptions: Record<string, string>;
    frameConfig: Record<string, string>;
    effectiveDevices: string[];
    effectiveLanguages: string[];
    appearance: "light" | "dark";
    scheme: string;
  } {
    let descriptions: Record<string, string> = {};
    let frameConfig: Record<string, string> = {};
    let effectiveDevices = defaultDevices;
    let effectiveLanguages = defaultLanguages;
    let appearance: "light" | "dark" = "light";
    let scheme = defaultScheme;

    try {
      const parsed = JSON.parse(fs.readFileSync(configFile, "utf8"));
      const cfg = parsed._config ?? {};

      if (cfg.scheme) {
        const sanitized = cfg.scheme.replace(/[^a-zA-Z0-9 _.\-]/g, "");
        if (sanitized !== cfg.scheme) {
          this.push(`[config] Warning: scheme name sanitized from "${cfg.scheme}" to "${sanitized}"`);
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

      this.push(
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
      this.push(`[config] Warning: could not parse ${path.relative(workDir, configFile)}`);
    }

    return { descriptions, frameConfig, effectiveDevices, effectiveLanguages, appearance, scheme };
  }

  // ---------------------------------------------------------------------------
  // Simulator helpers
  // ---------------------------------------------------------------------------

  private async resolveSnapDevices(
    effectiveDevices: string[],
    simInfo: { version: string; devices: Array<{ name: string; udid: string }> } | null,
  ): Promise<string[]> {
    const snapDevices: string[] = [];

    for (const d of effectiveDevices) {
      if (!simInfo) {
        snapDevices.push(d);
        continue;
      }

      const udid = SnapshotRunner.resolveSimulatorUdid(d, simInfo.devices);
      if (!udid) {
        snapDevices.push(d);
        continue;
      }

      const matched = simInfo.devices.find((s) => s.udid === udid) ?? { name: d };
      this.push(
        matched.name !== d
          ? `[snapshot] Device "${d}" → "${matched.name}" (${udid})`
          : `[snapshot] Device "${d}" → ${udid}`,
      );
      snapDevices.push(udid);
    }

    return snapDevices;
  }

  private async bootSimulators(snapDevices: string[], appearance: "light" | "dark"): Promise<void> {
    for (const udid of snapDevices.filter((d) => UDID_RE.test(d))) {
      try {
        await execAsync(`xcrun simctl bootstatus "${udid}" -b`, { timeout: 120_000 });
        await execAsync(`xcrun simctl ui "${udid}" appearance ${appearance}`);
        await execAsync(`xcrun simctl shutdown "${udid}"`);
      } catch {
        this.push(`[snapshot] Warning: could not set appearance on ${udid}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Screenshot capture
  // ---------------------------------------------------------------------------

  private async captureScreenshots(
    effectiveLanguages: string[],
    snapDevices: string[],
    scheme: string,
    projectArg: string,
    workDir: string,
    envVars: Record<string, string> | undefined,
  ): Promise<Record<string, Array<{ filename: string; data: string }>>> {
    const screenshots: Record<string, Array<{ filename: string; data: string }>> = {};

    for (const lang of effectiveLanguages) {
      const [langCode, regionCode] = lang.split("-");
      const localeId = regionCode ? `${langCode}_${regionCode}` : langCode;

      for (const device of snapDevices) {
        const deviceLabel = UDID_RE.test(device) ? device.slice(0, 8) + "…" : device;
        const destination = UDID_RE.test(device)
          ? `-destination 'id=${device}'`
          : `-destination 'platform=iOS Simulator,name=${device}'`;

        const derivedDataPath = path.join(this.tmpDir, `DerivedData-${device.replace(/[^a-zA-Z0-9]/g, "_")}`);
        const testLogsDir = path.join(derivedDataPath, "Logs", "Test");

        this.push(`[snapshot] [${deviceLabel}] ${lang} — running UI tests ...`);

        if (UDID_RE.test(device)) {
          try {
            await execAsync(`xcrun simctl shutdown "${device}"`, { timeout: 30_000 });
          } catch {
            // already shut down
          }
        }

        const testFailed = await this.runXcodebuild(
          scheme,
          projectArg,
          destination,
          derivedDataPath,
          workDir,
          lang,
          localeId,
          deviceLabel,
          envVars,
        );

        if (UDID_RE.test(device)) {
          try {
            await execAsync(`xcrun simctl shutdown "${device}"`, { timeout: 30_000 });
          } catch {
            // ignore
          }
        }

        if (fs.existsSync(testLogsDir)) {
          await this.extractScreenshots(testLogsDir, lang, device, screenshots, testFailed, deviceLabel);
        } else {
          this.push(`[snapshot] [${deviceLabel}] ${lang}: no test logs directory at ${testLogsDir}`);
        }
      }
    }

    return screenshots;
  }

  private async runXcodebuild(
    scheme: string,
    projectArg: string,
    destination: string,
    derivedDataPath: string,
    workDir: string,
    lang: string,
    localeId: string,
    deviceLabel: string,
    envVars: Record<string, string> | undefined,
  ): Promise<boolean> {
    try {
      const testStart = Date.now();
      const xcodebuildCmd = `xcodebuild ${projectArg} -scheme "${scheme}" ${destination} -derivedDataPath "${derivedDataPath}" -parallel-testing-enabled NO TEST_RUNNER_XCUITESTS_LANGUAGE=${lang} TEST_RUNNER_XCUITESTS_LOCALE=${localeId} build test`;
      this.push(`[snapshot] Command: ${xcodebuildCmd}`);

      const { stdout } = await execAsync(`${xcodebuildCmd} 2>&1`, {
        cwd: workDir,
        timeout: 1800_000,
        env: { ...process.env, ...(envVars ?? {}) },
        maxBuffer: 10 * 1024 * 1024,
      });
      SnapshotRunner.filterXcodebuildOutput(stdout).forEach((l) => this.push(l));
      this.push(`[snapshot] [${deviceLabel}] ${lang}: finished in ${Math.round((Date.now() - testStart) / 1000)}s`);
      return false;
    } catch (execErr) {
      const e = execErr as { stdout?: string; stderr?: string; message?: string; code?: number };
      SnapshotRunner.filterXcodebuildOutput(e.stdout).forEach((l) => this.push(l));
      SnapshotRunner.filterXcodebuildOutput(e.stderr).forEach((l) => this.push(l));
      this.push(`[snapshot] [${deviceLabel}] ${lang}: tests failed (extracting any captured screenshots anyway)`);
      return true;
    }
  }

  private async extractScreenshots(
    testLogsDir: string,
    lang: string,
    device: string,
    screenshots: Record<string, Array<{ filename: string; data: string }>>,
    testFailed: boolean,
    deviceLabel: string,
  ): Promise<void> {
    const xcResults = fs.readdirSync(testLogsDir).filter((n) => n.endsWith(".xcresult"));
    const collected: string[] = [];

    for (const xcName of xcResults) {
      const xcPath = path.join(testLogsDir, xcName);
      const extractDir = path.join(
        this.tmpDir,
        `attachments-${lang}-${device.replace(/[^a-zA-Z0-9]/g, "_")}-${xcName}`,
      );
      fs.mkdirSync(extractDir, { recursive: true });

      try {
        await execAsync(`xcrun xcresulttool export attachments --path "${xcPath}" --output-path "${extractDir}"`, {
          timeout: 120_000,
          maxBuffer: 10 * 1024 * 1024,
        });
      } catch {
        this.push(`[snapshot] Warning: xcresulttool export failed for ${xcName}`);
        continue;
      }

      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (/\.(png|jpg|jpeg)$/i.test(entry.name)) {
            const cleanName = entry.name
              .replace(new RegExp(`^${lang}__`, "i"), "")
              .replace(new RegExp(`^${lang}_`, "i"), "");
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

    this.push(
      `[snapshot] [${deviceLabel}] ${lang}: extracted ${plural(collected.length, "screenshot")}${testFailed ? " (some tests failed)" : ""}`,
    );

    for (const xcName of xcResults) {
      fs.rmSync(path.join(testLogsDir, xcName), { recursive: true, force: true });
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup & logging
  // ---------------------------------------------------------------------------

  private push(line: string): void {
    this.logs.push(line);
    this.emitLog(line);
  }

  private writeLogs(): void {
    try {
      fs.mkdirSync(this.logsDir, { recursive: true });
      fs.writeFileSync(this.logFile, [...this.logs, ...this.errors].join("\n"), "utf8");
    } catch {
      /* ignore */
    }
  }

  private copyDebugArtifacts(): void {
    try {
      const debugDir = "/tmp/last-snapshot-debug";
      fs.rmSync(debugDir, { recursive: true, force: true });
      fs.mkdirSync(debugDir, { recursive: true });

      for (const entry of fs.readdirSync(this.tmpDir).filter((e) => e.startsWith("DerivedData-"))) {
        const testLogsDir = path.join(this.tmpDir, entry, "Logs", "Test");
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
  }

  private cleanup(): void {
    try {
      fs.rmSync(this.tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  // ---------------------------------------------------------------------------
  // Static helpers
  // ---------------------------------------------------------------------------

  static filterXcodebuildOutput(output: string | undefined, maxLines = 200): string[] {
    if (!output) return [];
    const lines = output.split("\n").filter(Boolean);
    const interesting = lines.filter((l) => LOG_INTERESTING_RE.test(l));
    if (interesting.length <= maxLines) return interesting;
    const dropped = interesting.length - maxLines;
    return [`[snapshot] (truncated ${dropped} earlier filtered lines)`, ...interesting.slice(-maxLines)];
  }

  static async getIosSimulatorInfo(): Promise<{
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

  static resolveSimulatorUdid(requested: string, available: Array<{ name: string; udid: string }>): string | null {
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
}
