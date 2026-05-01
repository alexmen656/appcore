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
  private readonly artifactsDir: string;
  private readonly logs: string[] = [];
  private readonly errors: string[] = [];
  private readonly xcresultLogs: Array<{ filename: string; sizeBytes: number }> = [];

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
    this.artifactsDir = path.join(this.logsDir, runId);
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
    this.sweepOldArtifacts();
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
    let concurrency = 2;

    const configFile = findConfigFile(workDir);

    if (configFile) {
      ({ descriptions, frameConfig, effectiveDevices, effectiveLanguages, appearance, scheme, concurrency } =
        this.loadConfig(configFile, workDir, scheme, effectiveDevices, effectiveLanguages));
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

    const effectiveConcurrency = Math.max(1, Math.min(concurrency, snapDevices.length));
    this.push(
      `[snapshot] Running xcodebuild for ${snapDevices.length} device(s) (concurrency: ${effectiveConcurrency}):\n           - ${snapDevices.join("\n           - ")}`,
    );

    await this.bootSimulators(snapDevices, appearance);

    const screenshots = await this.captureScreenshots(
      effectiveLanguages,
      snapDevices,
      scheme,
      projectArg,
      workDir,
      envVars,
      effectiveConcurrency,
    );

    this.push("[snapshot] Snapshot completed");
    const totalFiles = Object.values(screenshots).reduce((n, a) => n + a.length, 0);
    this.push(
      `[snapshot] Total: ${plural(totalFiles, "screenshot")} across ${plural(Object.keys(screenshots).length, "language")}`,
    );

    this.finish({
      ok: true,
      logs: this.logs,
      errors: this.errors,
      screenshots,
      descriptions,
      config: frameConfig,
      xcresultLogs: this.xcresultLogs,
    });
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
    concurrency: number;
  } {
    let descriptions: Record<string, string> = {};
    let frameConfig: Record<string, string> = {};
    let effectiveDevices = defaultDevices;
    let effectiveLanguages = defaultLanguages;
    let appearance: "light" | "dark" = "light";
    let scheme = defaultScheme;
    let concurrency = 1;

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
      if (Number.isFinite(cfg.concurrency) && cfg.concurrency >= 1) {
        concurrency = Math.floor(cfg.concurrency);
      }

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
          `  - concurrency: ${concurrency}`,
          `  - ${plural(descCount, "description")}`,
        ].join("\n"),
      );
    } catch {
      this.push(`[config] Warning: could not parse ${path.relative(workDir, configFile)}`);
    }

    return { descriptions, frameConfig, effectiveDevices, effectiveLanguages, appearance, scheme, concurrency };
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
    concurrency: number,
  ): Promise<Record<string, Array<{ filename: string; data: string }>>> {
    const screenshots: Record<string, Array<{ filename: string; data: string }>> = {};

    const runDeviceLanguages = async (device: string): Promise<void> => {
      for (const lang of effectiveLanguages) {
        const [langCode, regionCode] = lang.split("-");
        const localeId = regionCode ? `${langCode}_${regionCode}` : langCode;

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
    };

    const queue = [...snapDevices];
    const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
      while (queue.length > 0) {
        const device = queue.shift();
        if (device === undefined) return;
        await runDeviceLanguages(device);
      }
    });
    await Promise.all(workers);

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
    const langBase = lang.split("-")[0];
    const langPrefix = `${langBase}__`;
    const deviceTag = (UDID_RE.test(device) ? device.slice(0, 8) : device).replace(/[^a-zA-Z0-9]/g, "_");

    for (const xcName of xcResults) {
      const xcPath = path.join(testLogsDir, xcName);
      let nameMap: Map<string, string>;

      try {
        nameMap = await this.buildAttachmentNameMap(xcPath);
      } catch (e) {
        this.push(`[snapshot] Warning: could not parse xcresult JSON for ${xcName}: ${e}`);
        continue;
      }

      this.push(
        `[snapshot] [${deviceLabel}] ${lang}: attachment names: ${[...nameMap.values()].join(", ") || "(none)"}`,
      );

      const relevant = [...nameMap.entries()].filter(([, name]) => name.startsWith(langPrefix));
      this.push(`[snapshot] [${deviceLabel}] ${lang}: exporting ${relevant.length} screenshot(s)`);

      for (const [payloadId, attName] of relevant) {
        const baseName = attName.slice(langPrefix.length);
        const cleanName = `${baseName}__${deviceTag}.png`;
        const outPath = path.join(this.tmpDir, `snap-${this.runId}-${cleanName}.png`);
        try {
          await execAsync(
            `xcrun xcresulttool export --legacy --path "${xcPath}" --output-path "${outPath}" --type file --id "${payloadId}"`,
            { timeout: 30_000 },
          );
          if (fs.existsSync(outPath)) {
            (screenshots[lang] ??= []).push({
              filename: cleanName,
              data: fs.readFileSync(outPath).toString("base64"),
            });
            collected.push(cleanName);
            fs.unlinkSync(outPath);
          } else {
            this.push(`[snapshot] Warning: export produced no file for "${attName}"`);
          }
        } catch (e) {
          this.push(`[snapshot] Warning: could not export "${attName}": ${e}`);
        }
      }
    }

    this.push(
      `[snapshot] [${deviceLabel}] ${lang}: extracted ${plural(collected.length, "screenshot")}${testFailed ? " (some tests failed)" : ""}`,
    );

    for (const xcName of xcResults) {
      const xcPath = path.join(testLogsDir, xcName);
      await this.archiveXcresult(xcPath, xcName, device, lang, deviceLabel);
      fs.rmSync(xcPath, { recursive: true, force: true });
    }
  }

  private async archiveXcresult(
    xcPath: string,
    xcName: string,
    device: string,
    lang: string,
    deviceLabel: string,
  ): Promise<void> {
    const tag = (UDID_RE.test(device) ? device.slice(0, 8) : device).replace(/[^a-zA-Z0-9._-]/g, "_");
    const safeLang = lang.replace(/[^a-zA-Z0-9._-]/g, "_");
    const safeXcName = xcName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const zipName = `${tag}-${safeLang}-${safeXcName}.zip`;
    fs.mkdirSync(this.artifactsDir, { recursive: true });
    const zipPath = path.join(this.artifactsDir, zipName);
    try {
      await execAsync(`zip -rq "${zipPath}" "${path.basename(xcPath)}"`, {
        cwd: path.dirname(xcPath),
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
      });
      if (fs.existsSync(zipPath)) {
        const sizeBytes = fs.statSync(zipPath).size;
        this.xcresultLogs.push({ filename: zipName, sizeBytes });
        this.push(
          `[snapshot] [${deviceLabel}] ${lang}: archived xcresult → ${zipName} (${Math.round(sizeBytes / 1024)} KB)`,
        );
      }
    } catch (e) {
      this.push(`[snapshot] Warning: could not zip xcresult ${xcName}: ${e}`);
    }
  }

  private async buildAttachmentNameMap(xcPath: string): Promise<Map<string, string>> {
    const map = new Map<string, string>();

    const getJson = async (id?: string): Promise<unknown> => {
      const idArg = id ? ` --id "${id}"` : "";
      const opts = { timeout: 60_000, maxBuffer: 50 * 1024 * 1024 };
      for (const flags of ["--legacy ", ""]) {
        try {
          const { stdout } = await execAsync(
            `xcrun xcresulttool get ${flags}--path "${xcPath}" --format json${idArg}`,
            opts,
          );
          return JSON.parse(stdout);
        } catch {
          // try next variant
        }
      }
      throw new Error("xcresulttool get failed for all flag variants");
    };

    const extractAttachments = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        node.forEach(extractAttachments);
        return;
      }
      const obj = node as Record<string, unknown>;

      const typeName = (obj._type as any)?._name;
      if (typeName === "ActionTestAttachment" || (typeof obj.payloadRef === "object" && obj.payloadRef !== null)) {
        const rawName = obj.name;
        const name = typeof rawName === "string" ? rawName : (rawName as any)?._value;
        const ref = obj.payloadRef as any;
        const payloadId: string | undefined = typeof ref?.id === "string" ? ref.id : ref?.id?._value;
        if (typeof name === "string" && typeof payloadId === "string" && name.length > 0) {
          map.set(payloadId.replace(/\.(png|jpg|jpeg)$/i, ""), name);
        }
      }

      for (const val of Object.values(obj)) {
        if (!val || typeof val !== "object") continue;
        const v = val as any;
        if (Array.isArray(v)) {
          v.forEach(extractAttachments);
          continue;
        }
        if (Array.isArray(v._values)) {
          v._values.forEach(extractAttachments);
          continue;
        }
        extractAttachments(val);
      }
    };

    const collectRefIds = (root: unknown, key: string): string[] => {
      const ids: string[] = [];
      const walk = (n: unknown): void => {
        if (!n || typeof n !== "object") return;
        if (Array.isArray(n)) {
          n.forEach(walk);
          return;
        }
        const o = n as Record<string, unknown>;
        if (key in o) {
          const ref = o[key] as any;
          const id = typeof ref?.id === "string" ? ref.id : ref?.id?._value;
          if (typeof id === "string") ids.push(id);
        }
        for (const val of Object.values(o)) {
          if (!val || typeof val !== "object") continue;
          const v = val as any;
          if (Array.isArray(v)) {
            v.forEach(walk);
            continue;
          }
          if (Array.isArray(v._values)) {
            v._values.forEach(walk);
            continue;
          }
          walk(val);
        }
      };
      walk(root);
      return [...new Set(ids)];
    };

    const root = await getJson();
    extractAttachments(root);

    for (const refId of collectRefIds(root, "testsRef")) {
      let sub: unknown;
      try {
        sub = await getJson(refId);
      } catch {
        continue;
      }
      extractAttachments(sub);
      for (const summaryId of collectRefIds(sub, "summaryRef")) {
        try {
          extractAttachments(await getJson(summaryId));
        } catch {
          /* ignore */
        }
      }
    }

    return map;
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

  private sweepOldArtifacts(): void {
    const ttlMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    try {
      for (const entry of fs.readdirSync(this.logsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const dir = path.join(this.logsDir, entry.name);
        try {
          if (now - fs.statSync(dir).mtimeMs > ttlMs) {
            fs.rmSync(dir, { recursive: true, force: true });
          }
        } catch {
          /* ignore individual failures */
        }
      }
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
