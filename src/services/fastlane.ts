import fs from "fs";
import path from "path";
import os from "os";
import { randomUUID, createHash } from "crypto";
import sharp from "sharp";
import { spawn, exec } from "child_process";
import { ProxyAgent, request as undiciRequest } from "undici";
import { promisify } from "util";
import { Prisma } from "@prisma/client";
import { logger, prisma } from "../config";
import type { EffectiveSettings } from "../config";
import { env } from "../config/env";
import { AppStoreConnectClient } from "./appstore-connect";

const execAsync = promisify(exec);

async function resolveFastlane(): Promise<string> {
  const bin = env.FASTLANE_PATH;
  await execAsync(`${bin} --version`).catch(() => {
    throw new Error(`Fastlane not found at "${bin}". Override with FASTLANE_PATH env var.`);
  });
  return bin;
}

export interface SubmissionPreview {
  appId: string;
  bundleId: string;
  appName: string;
  versionString: string | null;
  appStoreState: string | null;
  isEditable: boolean;
  locales: {
    locale: string;
    name: string;
    subtitle: string;
    keywords: string;
    description: string;
    whatsNew: string;
    promotionalText: string;
  }[];
}

export interface SubmissionResult {
  ok: boolean;
  jobId: string;
  action: SubmitAction;
  versionString: string | null;
  logs: string[];
  errors: string[];
}

type SubmitAction = "metadata" | "submit_for_review" | "binary";

interface LocaleEntry {
  name: string;
  subtitle: string;
  keywords: string;
  description: string;
  whatsNew: string;
  promotionalText: string;
  supportUrl: string;
  marketingUrl: string;
}

interface ActiveSubmission {
  jobId: string;
  logs: string[];
  errors: string[];
  status: "preparing" | "running" | "completed" | "failed";
  startedAt: Date;
}

const DIMENSION_TO_DISPLAY_TYPE: Record<string, string> = {
  "1320x2868": "APP_IPHONE_67", // 6.9" iPhone 16 Pro Max → uses 6.7" slot
  "2868x1320": "APP_IPHONE_67",
  "1290x2796": "APP_IPHONE_67",
  "2796x1290": "APP_IPHONE_67",
  "1206x2622": "APP_IPHONE_61", // 6.3" iPhone 16 Pro → uses 6.1" slot
  "2622x1206": "APP_IPHONE_61",
  "1284x2778": "APP_IPHONE_65",
  "2778x1284": "APP_IPHONE_65",
  "1242x2688": "APP_IPHONE_65",
  "2688x1242": "APP_IPHONE_65",
  "1179x2556": "APP_IPHONE_61",
  "2556x1179": "APP_IPHONE_61",
  "1170x2532": "APP_IPHONE_61",
  "2532x1170": "APP_IPHONE_61",
  "1125x2436": "APP_IPHONE_58",
  "2436x1125": "APP_IPHONE_58",
  "1242x2208": "APP_IPHONE_55",
  "2208x1242": "APP_IPHONE_55",
  "750x1334": "APP_IPHONE_47",
  "1334x750": "APP_IPHONE_47",
  "2064x2752": "APP_IPAD_PRO_3GEN_129",
  "2752x2064": "APP_IPAD_PRO_3GEN_129",
  "2048x2732": "APP_IPAD_PRO_3GEN_129",
  "2732x2048": "APP_IPAD_PRO_3GEN_129",
  "1668x2388": "APP_IPAD_PRO_3GEN_11",
  "2388x1668": "APP_IPAD_PRO_3GEN_11",
  "1668x2224": "APP_IPAD_105",
  "2224x1668": "APP_IPAD_105",
  "1536x2048": "APP_IPAD_97",
  "2048x1536": "APP_IPAD_97",
};

const FILENAME_DISPLAY_TYPE_PATTERNS: [RegExp, string][] = [
  [/iphone[_.\s]6\.9/i, "APP_IPHONE_67"], // 6.9" → 6.7" slot
  [/iphone[_.\s]6\.7/i, "APP_IPHONE_67"],
  [/iphone[_.\s]6\.5/i, "APP_IPHONE_65"],
  [/iphone[_.\s]6\.3/i, "APP_IPHONE_61"], // 6.3" → 6.1" slot
  [/iphone[_.\s]6\.1/i, "APP_IPHONE_61"],
  [/iphone[_.\s]5\.8/i, "APP_IPHONE_58"],
  [/iphone[_.\s]5\.5/i, "APP_IPHONE_55"],
  [/iphone[_.\s]4\.7/i, "APP_IPHONE_47"],
  [/ipad.pro.12\.9/i, "APP_IPAD_PRO_3GEN_129"],
  [/ipad.pro.11/i, "APP_IPAD_PRO_3GEN_11"],
  [/ipad.10\.5/i, "APP_IPAD_105"],
  [/ipad.9\.7/i, "APP_IPAD_97"],
];

const cdnAgent = new ProxyAgent({ uri: "http://192.168.1.200:3128", connectTimeout: 30_000, headersTimeout: 60_000, bodyTimeout: 120_000 });

async function uploadChunk(url: string, method: string, headers: Record<string, string>, data: Buffer): Promise<void> {
  try {
    const { statusCode, body } = await undiciRequest(url, {
      method: method as "PUT" | "POST" | "GET" | "DELETE" | "PATCH" | "HEAD",
      headers: { ...headers, "content-length": String(data.length) },
      body: data,
      dispatcher: cdnAgent,
    });
    await body.dump();
    if (statusCode >= 400) {
      throw new Error(`CDN upload failed: HTTP ${statusCode}`);
    }
  } catch (err: any) {
    const cause = err?.cause?.message ?? err?.cause?.code ?? "";
    throw new Error(`CDN upload failed: ${err?.message ?? err}${cause ? ` (cause: ${cause})` : ""} — URL host: ${new URL(url).hostname}`);
  }
}

async function getDisplayType(imagePath: string): Promise<{ displayType: string | null; width?: number; height?: number }> {
  const { width, height } = await sharp(imagePath).metadata();
  if (width && height) {
    const byDim = DIMENSION_TO_DISPLAY_TYPE[`${width}x${height}`];
    if (byDim) return { displayType: byDim, width, height };
  }
  const filename = path.basename(imagePath);
  for (const [pattern, type] of FILENAME_DISPLAY_TYPE_PATTERNS) {
    if (pattern.test(filename)) return { displayType: type, width, height };
  }
  return { displayType: null, width, height };
}

const FALLBACK_LOCALES = ["en-US", "en-GB"];
const SUBMISSION_TTL_MS = 60 * 60 * 1000;
const activeSubmissions = new Map<string, ActiveSubmission>();
let latestJobId: string | undefined;

export function getActiveSubmission(jobId: string): ActiveSubmission | undefined {
  return activeSubmissions.get(jobId);
}

export function getLatestSubmission(): ActiveSubmission | undefined {
  return latestJobId ? activeSubmissions.get(latestJobId) : undefined;
}

export class FastlaneService {
  private readonly bundleId: string;
  private settings: EffectiveSettings;
  private asc: AppStoreConnectClient;

  constructor(bundleId: string, settings: EffectiveSettings) {
    this.bundleId = bundleId;
    this.settings = settings;

    if (!settings.ascIssuerId || !settings.ascKeyId || !settings.ascPrivateKey) {
      throw new Error("App Store Connect credentials not configured. Set them in Settings.");
    }

    this.asc = new AppStoreConnectClient({
      issuerId: settings.ascIssuerId,
      keyId: settings.ascKeyId,
      privateKey: settings.ascPrivateKey,
    });
  }

  async preview(): Promise<SubmissionPreview> {
    const app = await this.asc.getApp(this.bundleId);
    if (!app) throw new Error("App not found in App Store Connect");

    const [editable, live, infoLocales] = await Promise.all([
      this.asc.getEditableVersion(app.id),
      this.asc.getLiveVersion(app.id),
      this.asc.getAppInfoLocalizations(app.id).catch(() => []),
    ]);

    const version = editable ?? live;
    const versionLocales = version ? await this.asc.getVersionLocalizations(version.id) : [];
    const locales = infoLocales.length > 0 ? infoLocales.map((l) => l.attributes.locale).filter(Boolean) : ["en-US"];

    const localeData: SubmissionPreview["locales"] = locales.map((locale) => {
      const iLoc = infoLocales.find((l) => l.attributes.locale === locale);
      const vLoc = versionLocales.find((l) => l.attributes.locale === locale);

      return {
        locale,
        name: iLoc?.attributes.name ?? "",
        subtitle: iLoc?.attributes.subtitle ?? "",
        keywords: vLoc?.attributes.keywords ?? "",
        description: vLoc?.attributes.description ?? "",
        whatsNew: vLoc?.attributes.whatsNew ?? "",
        promotionalText: vLoc?.attributes.promotionalText ?? "",
      };
    });

    return {
      appId: app.id,
      bundleId: app.attributes.bundleId,
      appName: app.attributes.name,
      versionString: version?.attributes.versionString ?? null,
      appStoreState: version?.attributes.appStoreState ?? null,
      isEditable: !!editable,
      locales: localeData,
    };
  }

  async submit(
    action: SubmitAction,
    overrides?: Record<
      string,
      {
        name?: string;
        subtitle?: string;
        keywords?: string;
        description?: string;
        whatsNew?: string;
        promotionalText?: string;
      }
    >,
  ): Promise<SubmissionResult> {
    const jobId = randomUUID();
    const submission: ActiveSubmission = {
      jobId,
      logs: [],
      errors: [],
      status: "preparing",
      startedAt: new Date(),
    };

    activeSubmissions.set(jobId, submission);
    latestJobId = jobId;

    let versionString: string | null = null;
    try {
      let localeData: Record<string, LocaleEntry> = {};

      if (action !== "binary") {
        submission.logs.push("Preparing metadata...");
        const prepared = await this.prepareMetadataLocales(action, overrides);
        localeData = prepared.localeData;
        versionString = prepared.versionString;

        submission.logs.push(
          `Metadata prepared for ${Object.keys(localeData).length} locale(s). Running fastlane deliver...`,
        );
      }

      submission.status = "running";
      const result = await this.runDeliver({
        localeData,
        action,
        onLog: (line) => submission.logs.push(line),
        onError: (line) => submission.errors.push(line),
      });

      const newLogs = result.logs.filter((l) => !submission.logs.includes(l));
      const newErrors = result.errors.filter((e) => !submission.errors.includes(e));
      submission.logs.push(...newLogs);
      submission.errors.push(...newErrors);
      submission.status = submission.errors.length > 0 ? "failed" : "completed";
      setTimeout(() => activeSubmissions.delete(jobId), SUBMISSION_TTL_MS);

      return {
        ok: submission.errors.length === 0,
        jobId,
        action,
        versionString,
        logs: submission.logs,
        errors: submission.errors,
      };
    } catch (err) {
      const axiosErr = err as any;
      const cause = axiosErr?.cause?.message ?? axiosErr?.cause?.code ?? "";
      const code = axiosErr?.code ?? "";
      const status = axiosErr?.response?.status ?? "";
      const msg = `${err instanceof Error ? err.message : String(err)}${code ? ` [${code}]` : ""}${status ? ` HTTP ${status}` : ""}${cause ? ` (cause: ${cause})` : ""}`;

      submission.errors.push(msg);
      logger.error("[Fastlane] deliver failed:", { message: msg, code, status, cause });
      submission.status = "failed";
      setTimeout(() => activeSubmissions.delete(jobId), SUBMISSION_TTL_MS);

      return {
        ok: false,
        jobId,
        action,
        versionString,
        logs: submission.logs,
        errors: submission.errors,
      };
    }
  }

  private async loadFramedScreenshotPaths(): Promise<Record<
    string,
    Array<{ filename: string; absPath: string }>
  > | null> {
    try {
      const app = await prisma.app.findFirst({
        where: { bundleId: this.bundleId },
        select: { id: true },
      });
      if (!app) return null;

      const job = await prisma.screenshotJob.findFirst({
        where: {
          appId: app.id,
          status: "COMPLETED",
          framedByLocale: { not: Prisma.AnyNull },
        },
        orderBy: { completedAt: "desc" },
        select: { framedByLocale: true },
      });
      if (!job?.framedByLocale) return null;

      const framedByLocale = job.framedByLocale as Record<string, string[]>;
      const screenshots: Record<string, Array<{ filename: string; absPath: string }>> = {};

      for (const [locale, urls] of Object.entries(framedByLocale)) {
        const images: Array<{ filename: string; absPath: string }> = [];
        for (const url of urls) {
          const absPath = path.join(process.cwd(), url);
          if (fs.existsSync(absPath)) {
            images.push({ filename: path.basename(absPath), absPath });
          }
        }
        if (images.length > 0) screenshots[locale] = images;
      }

      return Object.keys(screenshots).length > 0 ? screenshots : null;
    } catch (err) {
      logger.warn("[Fastlane] Could not load framed screenshot paths:", err);
      return null;
    }
  }

  private async loadLatestIpaPath(): Promise<string | null> {
    try {
      const app = await prisma.app.findFirst({
        where: { bundleId: this.bundleId },
        select: { id: true },
      });
      if (!app) return null;

      const buildJob = await prisma.buildJob.findFirst({
        where: { appId: app.id, status: "COMPLETED", ipaPath: { not: null } },
        orderBy: { completedAt: "desc" },
        select: { ipaPath: true },
      });
      if (!buildJob?.ipaPath) return null;

      return fs.existsSync(buildJob.ipaPath) ? buildJob.ipaPath : null;
    } catch (err) {
      logger.warn("[Fastlane] Could not load latest IPA path:", err);
      return null;
    }
  }

  private async uploadScreenshotsViaASC(
    screenshotPaths: Record<string, Array<{ filename: string; absPath: string }>>,
    locales: string[],
    onLog: (line: string) => void,
  ): Promise<void> {
    const app = await this.asc.getApp(this.bundleId);
    if (!app) throw new Error("App not found in App Store Connect");

    const editable = await this.asc.getEditableVersion(app.id);
    if (!editable) throw new Error("No editable version found for screenshot upload");

    const versionLocales = await this.asc.getVersionLocalizations(editable.id);
    const localeToLocId = Object.fromEntries(versionLocales.map((l) => [l.attributes.locale, l.id]));
    const fallbackLocale = FALLBACK_LOCALES.find((l) => screenshotPaths[l]) ?? Object.keys(screenshotPaths)[0];
    const fallbackImages = fallbackLocale ? screenshotPaths[fallbackLocale] : undefined;

    for (const locale of locales) {
      const localizationId = localeToLocId[locale];
      if (!localizationId) {
        onLog(`[Screenshots] No localization found for ${locale}, skipping`);
        continue;
      }

      const images = screenshotPaths[locale] ?? fallbackImages;
      if (!images || images.length === 0) continue;

      const isFallback = !screenshotPaths[locale];
      onLog(
        `[Screenshots] ${locale}: ${images.length} image(s)${isFallback ? ` (fallback from ${fallbackLocale})` : ""}`,
      );

      const existingSets = await this.asc.listScreenshotSets(localizationId);
      await Promise.all(existingSets.map((s) => this.asc.deleteScreenshotSet(s.id)));

      if (existingSets.length > 0) {
        onLog(`[Screenshots] ${locale}: removed ${existingSets.length} existing set(s)`);
      }

      onLog(`[Screenshots] ${locale}: detecting display types...`);
      const byDisplayType = new Map<string, Array<{ filename: string; absPath: string }>>();
      for (const img of images) {
        const { displayType, width, height } = await getDisplayType(img.absPath);

        if (!displayType) {
          onLog(`[Screenshots] Cannot determine display type for ${img.filename} (${width}x${height}), skipping`);
          continue;
        }

        onLog(`[Screenshots] ${locale}: ${img.filename} → ${displayType}`);
        if (!byDisplayType.has(displayType)) byDisplayType.set(displayType, []);
        byDisplayType.get(displayType)!.push(img);
      }

      for (const [displayType, imgs] of byDisplayType) {
        onLog(`[Screenshots] ${locale}: creating set for ${displayType} (${imgs.length} image(s))...`);
        const set = await this.asc.createScreenshotSet(localizationId, displayType);
        onLog(`[Screenshots] ${locale}: set created (${set.id})`);

        for (const img of imgs) {
          const fileData = fs.readFileSync(img.absPath);
          const md5 = createHash("md5").update(fileData).digest("hex");

          onLog(`[Screenshots] ${locale}: reserving slot for ${img.filename} (${fileData.length} bytes)...`);
          const reserved = await this.asc.reserveScreenshot(set.id, img.filename, fileData.length);
          onLog(`[Screenshots] ${locale}: uploading ${reserved.attributes.uploadOperations.length} chunk(s)...`);

          for (let i = 0; i < reserved.attributes.uploadOperations.length; i++) {
            const op = reserved.attributes.uploadOperations[i];
            const chunk = Buffer.from(fileData.subarray(op.offset, op.offset + op.length));
            const headers = Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value]));
            onLog(`[Screenshots] ${locale}: chunk ${i + 1}/${reserved.attributes.uploadOperations.length} → ${op.method} (${chunk.length} bytes)`);
            await uploadChunk(op.url, op.method, headers, chunk);
          }

          onLog(`[Screenshots] ${locale}: committing ${img.filename}...`);
          await this.asc.commitScreenshot(reserved.id, md5);
          onLog(`[Screenshots] ${locale}: done ${img.filename} (${displayType})`);
        }
      }
    }

    onLog("[Screenshots] All screenshots uploaded successfully");
  }

  private async runDeliver(opts: {
    localeData: Record<string, LocaleEntry>;
    action: SubmitAction;
    onLog?: (line: string) => void;
    onError?: (line: string) => void;
  }): Promise<{ logs: string[]; errors: string[] }> {
    const { localeData, action, onLog, onError } = opts;
    const logs: string[] = [];
    const errors: string[] = [];

    const pushLog = (line: string) => {
      logs.push(line);
      onLog?.(line);
    };

    const pushError = (line: string) => {
      errors.push(line);
      onError?.(line);
    };

    const tmpDir = path.join(os.tmpdir(), `deliver-${Date.now()}`);
    const metadataRoot = path.join(tmpDir, "metadata");

    try {
      fs.mkdirSync(tmpDir, { recursive: true });

      if (action !== "binary") {
        pushLog("Writing metadata files...");
        for (const [locale, data] of Object.entries(localeData)) {
          const localeDir = path.join(metadataRoot, locale);
          fs.mkdirSync(localeDir, { recursive: true });

          for (const [file, content] of Object.entries({
            "name.txt": data.name,
            "subtitle.txt": data.subtitle,
            "keywords.txt": data.keywords,
            "description.txt": data.description,
            "release_notes.txt": data.whatsNew,
            "promotional_text.txt": data.promotionalText,
            "support_url.txt": data.supportUrl,
            "marketing_url.txt": data.marketingUrl,
          }))
            fs.writeFileSync(path.join(localeDir, file), content);
        }

        fs.mkdirSync(metadataRoot, { recursive: true });
        fs.writeFileSync(path.join(metadataRoot, "copyright.txt"), `© ${new Date().getFullYear()} Fringelo Group`);
        pushLog(`Metadata written for ${Object.keys(localeData).length} locale(s)`);
      }

      if (action !== "binary") {
        const screenshotPaths = await this.loadFramedScreenshotPaths();
        if (screenshotPaths && Object.keys(screenshotPaths).length > 0) {
          pushLog("Uploading screenshots via App Store Connect API...");
          try {
            await this.uploadScreenshotsViaASC(screenshotPaths, Object.keys(localeData), pushLog);
          } catch (ssErr: any) {
            const msg = ssErr instanceof Error ? ssErr.message : String(ssErr);
            pushLog(`[Screenshots] Upload failed (non-fatal): ${msg}`);
            pushLog("[Screenshots] Continuing with metadata/binary upload. To fix: add Oracle Cloud egress rule for 17.0.0.0/8 HTTPS.");
          }
        } else {
          pushLog("No framed screenshots found, skipping screenshot upload.");
        }
      }

      const ipaPath = await this.loadLatestIpaPath();
      if (ipaPath) {
        pushLog("Latest build IPA found, will be uploaded.");
      } else if (action === "binary") {
        throw new Error("No IPA found. Build the app first before uploading the binary.");
      }

      fs.writeFileSync(
        path.join(tmpDir, "api_key.json"),
        JSON.stringify(
          {
            key_id: this.settings.ascKeyId!,
            issuer_id: this.settings.ascIssuerId!,
            key: this.settings.ascPrivateKey!,
            in_house: false,
          },
          null,
          2,
        ),
      );
      pushLog("API key file written");

      const fastlanePath = await resolveFastlane();
      pushLog(`Using fastlane at: ${fastlanePath}`);

      const args = [
        "--api_key_path",
        path.join(tmpDir, "api_key.json"),
        "--app_identifier",
        this.bundleId,
        "--force",
        "--precheck_include_in_app_purchases",
        "false",
      ];

      if (action !== "binary") args.push("--metadata_path", metadataRoot);
      if (ipaPath) args.push("--ipa", ipaPath);
      else args.push("--skip_binary_upload");

      args.push("--skip_screenshots");

      if (action === "binary") {
        args.push("--skip_metadata", "--skip_app_version_update", "--submit_for_review", "false");
      } else if (action === "metadata") {
        args.push("--skip_app_version_update", "--submit_for_review", "false");
      } else if (action === "submit_for_review") {
        args.push("--submit_for_review");
      }

      pushLog("Running: fastlane deliver");

      await new Promise<void>((resolve, reject) => {
        const parts = fastlanePath.split(" ");
        const cmd = parts[0];
        const cmdArgs = [...parts.slice(1), "deliver", ...args];

        const proc = spawn(cmd, cmdArgs, {
          cwd: tmpDir,
          env: {
            ...process.env,
            FASTLANE_DISABLE_COLORS: "1",
            LANG: "en_US.UTF-8",
            LC_ALL: "en_US.UTF-8",
            RUBYOPT: "-EUTF-8",
          },
          stdio: ["pipe", "pipe", "pipe"],
        });

        const hardTimeout = setTimeout(
          () => {
            proc.kill();
            reject(new Error("fastlane deliver timed out after 30 minutes"));
          },
          30 * 60 * 1000,
        );

        proc.stdout?.on("data", (data: Buffer) => {
          const line = data.toString().trim();
          if (line) pushLog(line);
        });

        proc.stderr?.on("data", (data: Buffer) => {
          const line = data.toString().trim();
          if (line) pushLog(`[stderr] ${line}`);
        });

        proc.on("close", (code) => {
          clearTimeout(hardTimeout);

          if (code === 0) {
            pushLog("Fastlane deliver completed successfully.");
            resolve();
          } else {
            const errMsg = `Fastlane deliver exited with code ${code}`;
            pushError(errMsg);
            pushLog(errMsg);
            reject(new Error(errMsg));
          }
        });

        proc.on("error", (err) => {
          clearTimeout(hardTimeout);
          pushError(err.message);
          reject(err);
        });
      });

      return { logs, errors };
    } catch (err: any) {
      const cause = err?.cause?.message ?? err?.cause?.code ?? "";
      pushError(`${err instanceof Error ? err.message : String(err)}${cause ? ` — cause: ${cause}` : ""}`);
      return { logs, errors };
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }

  private async prepareMetadataLocales(
    action: SubmitAction,
    overrides?: Record<
      string,
      {
        name?: string;
        subtitle?: string;
        keywords?: string;
        description?: string;
        whatsNew?: string;
        promotionalText?: string;
      }
    >,
  ): Promise<{ localeData: Record<string, LocaleEntry>; versionString: string | null }> {
    const app = await this.asc.getApp(this.bundleId);
    if (!app) throw new Error("App not found in App Store Connect");

    const [editable, live] = await Promise.all([this.asc.getEditableVersion(app.id), this.asc.getLiveVersion(app.id)]);
    const version = editable ?? live;
    if (!version) throw new Error("No App Store version found");

    const [versionLocalizations, appInfoLocalizations] = await Promise.all([
      this.asc.getVersionLocalizations(version.id),
      this.asc.getAppInfoLocalizations(app.id),
    ]);

    const allLocales = new Set<string>();
    for (const vl of versionLocalizations) allLocales.add(vl.attributes.locale);

    logger.info(`[Fastlane] Preparing metadata for ${allLocales.size} locale(s): ${[...allLocales].join(", ")}`);

    const localeData = new Map<string, LocaleEntry>();

    for (const locale of allLocales) {
      const vl = versionLocalizations.find((v) => v.attributes.locale === locale);
      const ai = appInfoLocalizations.find((a) => a.attributes.locale === locale);
      const ov = overrides?.[locale];

      localeData.set(locale, {
        name: ov?.name ?? ai?.attributes.name ?? "",
        subtitle: ov?.subtitle ?? ai?.attributes.subtitle ?? "",
        keywords: ov?.keywords ?? vl?.attributes.keywords ?? "",
        description: ov?.description ?? vl?.attributes.description ?? "",
        whatsNew: ov?.whatsNew ?? vl?.attributes.whatsNew ?? "",
        promotionalText: ov?.promotionalText ?? vl?.attributes.promotionalText ?? "",
        supportUrl: vl?.attributes.supportUrl ?? "",
        marketingUrl: vl?.attributes.marketingUrl ?? "",
      });
    }

    if (action === "submit_for_review") {
      const primaryLocale =
        [...localeData.entries()].find(([l]) => l === "en-US")?.[0] ??
        [...localeData.entries()].find(([, v]) => v.whatsNew)?.[0] ??
        [...localeData.keys()][0];

      const primary = primaryLocale ? localeData.get(primaryLocale) : undefined;

      for (const [locale, data] of localeData) {
        if (!data.whatsNew && primary?.whatsNew) {
          logger.info(`[Fastlane] locale "${locale}" missing whatsNew - using "${primaryLocale}" as fallback`);
          data.whatsNew = primary.whatsNew;
        }
        if (!data.supportUrl && primary?.supportUrl) {
          logger.info(`[Fastlane] locale "${locale}" missing supportUrl - using "${primaryLocale}" as fallback`);
          data.supportUrl = primary.supportUrl;
        }
        if (!data.description && primary?.description) {
          logger.info(`[Fastlane] locale "${locale}" missing description - using "${primaryLocale}" as fallback`);
          data.description = primary.description;
        }
      }
    }

    return {
      localeData: Object.fromEntries(localeData) as Record<string, LocaleEntry>,
      versionString: version.attributes.versionString ?? null,
    };
  }
}
