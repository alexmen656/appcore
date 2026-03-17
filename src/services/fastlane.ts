import fs from "fs";
import path from "path";
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

const ASC_TO_FASTLANE_LOCALE: Record<string, string> = {
  "en-US": "en-US",
  "en-GB": "en-GB",
  "en-AU": "en-AU",
  "en-CA": "en-CA",
  "de-DE": "de-DE",
  "fr-FR": "fr-FR",
  "es-ES": "es-ES",
  "es-MX": "es-MX",
  it: "it",
  "pt-BR": "pt-BR",
  "pt-PT": "pt-PT",
  ja: "ja",
  ko: "ko",
  "zh-Hans": "zh-Hans",
  "zh-Hant": "zh-Hant",
  "nl-NL": "nl-NL",
  ru: "ru",
  tr: "tr",
  "ar-SA": "ar-SA",
  th: "th",
  vi: "vi",
  id: "id",
  ms: "ms",
  sv: "sv",
  da: "da",
  fi: "fi",
  nb: "nb",
  pl: "pl",
  cs: "cs",
  sk: "sk",
  uk: "uk",
  el: "el",
  ro: "ro",
  hu: "hu",
  hr: "hr",
  ca: "ca",
  he: "he",
  hi: "hi",
};

function fastlaneLocale(ascLocale: string): string {
  return ASC_TO_FASTLANE_LOCALE[ascLocale] ?? ascLocale;
}

interface ActiveSubmission {
  jobId: string;
  logs: string[];
  errors: string[];
  status: "preparing" | "running" | "completed" | "failed";
  startedAt: Date;
}

const activeSubmissions = new Map<string, ActiveSubmission>();

export function getActiveSubmission(
  jobId: string,
): ActiveSubmission | undefined {
  return activeSubmissions.get(jobId);
}

export function getLatestSubmission(): ActiveSubmission | undefined {
  let latest: ActiveSubmission | undefined;
  for (const sub of activeSubmissions.values()) {
    if (!latest || sub.startedAt > latest.startedAt) latest = sub;
  }
  return latest;
}

export class FastlaneService {
  private settings: EffectiveSettings;
  private asc: AppStoreConnectClient;

  constructor(settings: EffectiveSettings) {
    this.settings = settings;

    if (
      !settings.ascIssuerId ||
      !settings.ascKeyId ||
      !settings.ascPrivateKey
    ) {
      throw new Error(
        "App Store Connect credentials not configured. Set them in Settings.",
      );
    }

    this.asc = new AppStoreConnectClient({
      issuerId: settings.ascIssuerId,
      keyId: settings.ascKeyId,
      privateKey: settings.ascPrivateKey,
    });
  }

  async preview(): Promise<SubmissionPreview> {
    const app = await this.asc.getApp(this.settings.ascBundleId);
    if (!app) throw new Error("App not found in App Store Connect");

    const editable = await this.asc.getEditableVersion(app.id);
    const live = await this.asc.getLiveVersion(app.id);
    const version = editable ?? live;

    const ascLocalizations = await this.asc
      .getAppInfoLocalizations(app.id)
      .catch(() => []);

    const locales =
      ascLocalizations.length > 0
        ? ascLocalizations
            .map((l: any) => l.attributes?.locale ?? l.locale)
            .filter(Boolean)
        : ["en-US"];

    const localeData: SubmissionPreview["locales"] = await Promise.all(
      locales.map(async (locale) => {
        const state = await this.asc.getCurrentASOState(locale);
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
    const job = await prisma.scrapeJob.create({
      data: {
        type: "FASTLANE_SUBMIT",
        status: "RUNNING",
        startedAt: new Date(),
      },
    });

    const submission: ActiveSubmission = {
      jobId: job.id,
      logs: [],
      errors: [],
      status: "preparing",
      startedAt: new Date(),
    };
    activeSubmissions.set(job.id, submission);

    try {
      submission.logs.push("Preparing metadata...");
      const localeData = await this.prepareMetadataLocales(action, overrides);
      submission.logs.push(
        `Metadata prepared for ${Object.keys(localeData).length} locale(s). Delegating to Fastlane worker...`,
      );

      submission.status = "running";

      const screenshots = await this.loadFramedScreenshots();
      if (screenshots) {
        const total = Object.values(screenshots).reduce(
          (n, a) => n + a.length,
          0,
        );
        submission.logs.push(
          `Loaded ${total} framed screenshot(s) across ${Object.keys(screenshots).length} locale(s)`,
        );

        const FALLBACK_PREFERENCE = ["en-US", "en-GB"];
        const fallbackLocale =
          FALLBACK_PREFERENCE.find((l) => screenshots[l]) ??
          Object.keys(screenshots)[0];
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

      const result = await workerClient.deliver({
        locales: localeData,
        apiKey: {
          key_id: this.settings.ascKeyId!,
          issuer_id: this.settings.ascIssuerId!,
          key: this.settings.ascPrivateKey!,
          in_house: false,
        },
        bundleId: this.settings.ascBundleId,
        action,
        screenshots: screenshots ?? undefined,
      });

      submission.logs.push(...result.logs);
      submission.errors.push(...result.errors);

      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: {
          status: submission.errors.length > 0 ? "FAILED" : "COMPLETED",
          completedAt: new Date(),
          result: JSON.stringify({
            action,
            logsCount: submission.logs.length,
            errorsCount: submission.errors.length,
          }),
        },
      });

      submission.status = submission.errors.length > 0 ? "failed" : "completed";

      return {
        ok: submission.errors.length === 0,
        jobId: job.id,
        action,
        versionString: null,
        logs: submission.logs,
        errors: submission.errors,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      submission.errors.push(msg);
      submission.status = "failed";

      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          error: msg,
          completedAt: new Date(),
        },
      });

      return {
        ok: false,
        jobId: job.id,
        action,
        versionString: null,
        logs: submission.logs,
        errors: submission.errors,
      };
    }
  }

  private async loadFramedScreenshots(): Promise<Record<
    string,
    Array<{ filename: string; data: string }>
  > | null> {
    try {
      const app = await prisma.app.findFirst({
        where: { bundleId: this.settings.ascBundleId },
        select: { id: true },
      });
      if (!app) return null;

      const job = await (prisma as any).screenshotJob.findFirst({
        where: {
          appId: app.id,
          status: "COMPLETED",
          framedByLocale: { not: null },
        },
        orderBy: { completedAt: "desc" },
        select: { framedByLocale: true },
      });
      if (!job?.framedByLocale) return null;

      const framedByLocale = job.framedByLocale as Record<string, string[]>;
      const screenshots: Record<
        string,
        Array<{ filename: string; data: string }>
      > = {};
      const cwd = process.cwd();

      for (const [locale, urls] of Object.entries(framedByLocale)) {
        if (locale === "default") continue; // deliver needs named locales
        const images: Array<{ filename: string; data: string }> = [];
        for (const url of urls) {
          const filePath = path.join(cwd, url);
          if (!fs.existsSync(filePath)) continue;
          images.push({
            filename: path.basename(filePath),
            data: fs.readFileSync(filePath).toString("base64"),
          });
        }
        if (images.length > 0) screenshots[locale] = images;
      }

      return Object.keys(screenshots).length > 0 ? screenshots : null;
    } catch (err) {
      logger.warn("[Fastlane] Could not load framed screenshots:", err);
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
  ): Promise<
    Record<
      string,
      {
        name: string;
        subtitle: string;
        keywords: string;
        description: string;
        whatsNew: string;
        promotionalText: string;
        supportUrl: string;
        marketingUrl: string;
      }
    >
  > {
    const app = await this.asc.getApp(this.settings.ascBundleId);
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
    for (const ai of appInfoLocalizations) allLocales.add(ai.attributes.locale);

    logger.info(
      `[Fastlane] Preparing metadata for ${allLocales.size} locale(s): ${[...allLocales].join(", ")}`,
    );

    const localeData = new Map<
      string,
      {
        name: string;
        subtitle: string;
        keywords: string;
        description: string;
        whatsNew: string;
        promotionalText: string;
        supportUrl: string;
        marketingUrl: string;
      }
    >();

    for (const locale of allLocales) {
      const vl = versionLocalizations.find(
        (v) => v.attributes.locale === locale,
      );
      const ai = appInfoLocalizations.find(
        (a) => a.attributes.locale === locale,
      );
      const ov = overrides?.[locale];
      localeData.set(locale, {
        name: ov?.name ?? ai?.attributes.name ?? "",
        subtitle: ov?.subtitle ?? ai?.attributes.subtitle ?? "",
        keywords: ov?.keywords ?? vl?.attributes.keywords ?? "",
        description: ov?.description ?? vl?.attributes.description ?? "",
        whatsNew: ov?.whatsNew ?? vl?.attributes.whatsNew ?? "",
        promotionalText:
          ov?.promotionalText ?? vl?.attributes.promotionalText ?? "",
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
          logger.info(
            `[Fastlane] locale "${locale}" missing whatsNew - using "${primaryLocale}" as fallback`,
          );
          data.whatsNew = primary.whatsNew;
        }
        if (!data.supportUrl && primary?.supportUrl) {
          logger.info(
            `[Fastlane] locale "${locale}" missing supportUrl - using "${primaryLocale}" as fallback`,
          );
          data.supportUrl = primary.supportUrl;
        }
        if (!data.description && primary?.description) {
          logger.info(
            `[Fastlane] locale "${locale}" missing description - using "${primaryLocale}" as fallback`,
          );
          data.description = primary.description;
        }
      }
    }

    const result: Record<
      string,
      typeof localeData extends Map<string, infer V> ? V : never
    > = {};
    for (const [locale, data] of localeData) {
      result[fastlaneLocale(locale)] = data;
    }
    return result;
  }
}
