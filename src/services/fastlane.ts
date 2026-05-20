import fs from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { spawn, exec } from "child_process";
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

const FALLBACK_LOCALES = ["en-US", "en-GB"];

interface ActiveSubmission {
  jobId: string;
  logs: string[];
  errors: string[];
  status: "preparing" | "running" | "completed" | "failed";
  startedAt: Date;
}

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

    const editable = await this.asc.getEditableVersion(app.id);
    const live = await this.asc.getLiveVersion(app.id);
    const version = editable ?? live;
    const localizations = await this.asc.getAppInfoLocalizations(app.id).catch(() => []);
    const locales =
      localizations.length > 0 ? localizations.map((l) => l.attributes.locale).filter(Boolean) : ["en-US"];

    const localeData: SubmissionPreview["locales"] = await Promise.all(
      locales.map(async (locale) => {
        const state = await this.asc.getCurrentASOState(locale, this.bundleId);
        return {
          locale,
          name: state?.title ?? "",
          subtitle: state?.subtitle ?? "",
          keywords: state?.keywords ?? "",
          description: state?.description ?? "",
          whatsNew: state?.whatsNew ?? "",
          promotionalText: state?.promotionalText ?? "",
        };
      }),
    );

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
      const result = await this.runDeliver({ localeData, action });

      submission.logs.push(...result.logs);
      submission.errors.push(...result.errors);
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

  private async runDeliver(opts: {
    localeData: Record<string, LocaleEntry>;
    action: SubmitAction;
  }): Promise<{ logs: string[]; errors: string[] }> {
    const { localeData, action } = opts;
    const logs: string[] = [];
    const errors: string[] = [];

    const tmpDir = path.join(os.tmpdir(), `deliver-${Date.now()}`);
    const metadataRoot = path.join(tmpDir, "metadata");

    try {
      fs.mkdirSync(tmpDir, { recursive: true });

      if (action !== "binary") {
        logs.push("Writing metadata files...");
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
        logs.push(`Metadata written for ${Object.keys(localeData).length} locale(s)`);
      }

      const screenshotPaths = await this.loadFramedScreenshotPaths();
      const hasScreenshots = !!screenshotPaths && Object.keys(screenshotPaths).length > 0;

      if (hasScreenshots) {
        let totalScreenshots = 0;
        const screenshotFallback =
          FALLBACK_LOCALES.find((l) => screenshotPaths![l]) ?? Object.keys(screenshotPaths!)[0];
        const fallbackImages = screenshotFallback ? screenshotPaths![screenshotFallback] : undefined;

        if (screenshotFallback) {
          const localesWithoutScreenshots = Object.keys(localeData).filter((l) => !screenshotPaths![l]);
          if (localesWithoutScreenshots.length > 0) {
            logs.push(
              `[Screenshots] ${localesWithoutScreenshots.length} locale(s) will use "${screenshotFallback}" as fallback`,
            );
          }
        }

        for (const locale of Object.keys(localeData)) {
          const images = screenshotPaths![locale] ?? fallbackImages;
          if (!images || images.length === 0) continue;
          const localeDir = path.join(tmpDir, "screenshots", locale);

          fs.mkdirSync(localeDir, { recursive: true });
          for (const img of images) {
            fs.copyFileSync(img.absPath, path.join(localeDir, img.filename));
            totalScreenshots++;
          }
        }
        logs.push(
          `Screenshots copied: ${totalScreenshots} image(s) across ${Object.keys(localeData).length} locale(s)`,
        );
      }

      const ipaPath = await this.loadLatestIpaPath();
      if (ipaPath) {
        logs.push("Latest build IPA found, will be uploaded.");
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
      logs.push("API key file written");

      const fastlanePath = await resolveFastlane();
      logs.push(`Using fastlane at: ${fastlanePath}`);

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

      if (hasScreenshots) {
        args.push("--screenshots_path", path.join(tmpDir, "screenshots"), "--overwrite_screenshots");
      } else {
        args.push("--skip_screenshots");
      }

      if (action === "binary") {
        args.push("--skip_metadata", "--skip_app_version_update", "--submit_for_review", "false");
      } else if (action === "metadata") {
        args.push("--skip_app_version_update", "--submit_for_review", "false");
      } else if (action === "submit_for_review") {
        args.push("--submit_for_review");
      }

      logs.push(`Running: fastlane deliver (screenshots: ${hasScreenshots ? "yes" : "skipped"})`);

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
          if (line) logs.push(line);
        });

        proc.stderr?.on("data", (data: Buffer) => {
          const line = data.toString().trim();
          if (line) logs.push(`[stderr] ${line}`);
        });

        proc.on("close", (code) => {
          clearTimeout(hardTimeout);

          if (code === 0) {
            logs.push("Fastlane deliver completed successfully.");
            resolve();
          } else {
            const errMsg = `Fastlane deliver exited with code ${code}`;
            errors.push(errMsg);
            logs.push(errMsg);
            reject(new Error(errMsg));
          }
        });

        proc.on("error", (err) => {
          clearTimeout(hardTimeout);
          errors.push(err.message);
          reject(err);
        });
      });

      return { logs, errors };
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
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

    const editable = await this.asc.getEditableVersion(app.id);
    const live = await this.asc.getLiveVersion(app.id);
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
