import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { logger, prisma } from "../config";
import type { EffectiveSettings } from "../config";
import { AppStoreConnectClient } from "./appstore-connect";
import { workerClient } from "./worker-client";

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
  action: "metadata" | "submit_for_review";
  versionString: string | null;
  logs: string[];
  errors: string[];
}

type SubmitAction = "metadata" | "submit_for_review";

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

const SCREENSHOT_FALLBACK_LOCALES = ["en-US", "en-GB"];

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
      submission.logs.push("Preparing metadata...");
      const prepared = await this.prepareMetadataLocales(action, overrides);
      const localeData = prepared.localeData;
      versionString = prepared.versionString;

      submission.logs.push(
        `Metadata prepared for ${Object.keys(localeData).length} locale(s). Delegating to Fastlane worker...`,
      );

      submission.status = "running";

      const screenshots = await this.loadFramedScreenshots();

      if (screenshots) {
        submission.logs.push(
          `Loaded ${Object.values(screenshots).reduce((n, a) => n + a.length, 0)} framed screenshot(s) across ${Object.keys(screenshots).length} locale(s)`,
        );

        const fallbackLocale = SCREENSHOT_FALLBACK_LOCALES.find((l) => screenshots[l]) ?? Object.keys(screenshots)[0];
        if (fallbackLocale) {
          for (const locale of Object.keys(localeData)) {
            if (!screenshots[locale]) {
              screenshots[locale] = screenshots[fallbackLocale];
              submission.logs.push(
                `[Screenshots] No screenshots for "${locale}" — using "${fallbackLocale}" as fallback`,
              );
            }
          }
        }
      }

      const ipaBase64 = await this.loadLatestIpa();
      if (ipaBase64) {
        submission.logs.push("Latest build IPA loaded, will be uploaded alongside metadata.");
      }

      const result = await workerClient.deliver({
        locales: localeData,
        apiKey: {
          key_id: this.settings.ascKeyId!,
          issuer_id: this.settings.ascIssuerId!,
          key: this.settings.ascPrivateKey!,
          in_house: false,
        },
        bundleId: this.bundleId,
        action,
        screenshots: screenshots ?? undefined,
        ipa: ipaBase64 ?? undefined,
      });

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
      const msg = err instanceof Error ? err.message : String(err);
      submission.errors.push(msg);
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

  private async loadFramedScreenshots(): Promise<Record<string, Array<{ filename: string; data: string }>> | null> {
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
      const screenshots: Record<string, Array<{ filename: string; data: string }>> = {};

      for (const [locale, urls] of Object.entries(framedByLocale)) {
        if (locale === "default") continue;
        const images: Array<{ filename: string; data: string }> = [];

        for (const url of urls) {
          const filePath = path.isAbsolute(url) ? url : path.join(process.cwd(), url);
          try {
            const data = await fs.promises.readFile(filePath);
            images.push({ filename: path.basename(filePath), data: data.toString("base64") });
          } catch {
            // file not accessible, skip
          }
        }
        if (images.length > 0) screenshots[locale] = images;
      }

      return Object.keys(screenshots).length > 0 ? screenshots : null;
    } catch (err) {
      logger.warn("[Fastlane] Could not load framed screenshots:", err);
      return null;
    }
  }

  private async loadLatestIpa(): Promise<string | null> {
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

      const ipaPath = buildJob.ipaPath;

      try {
        const buffer = await fs.promises.readFile(ipaPath);
        return buffer.toString("base64");
      } catch {
        return null;
      }
    } catch (err) {
      logger.warn("[Fastlane] Could not load latest IPA:", err);
      return null;
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
