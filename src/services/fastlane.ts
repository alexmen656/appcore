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

    const locales = this.settings.asoLocales;
    const localeData: SubmissionPreview["locales"] = [];

    for (const locale of locales) {
      const state = await this.asc.getCurrentASOState(locale);
      localeData.push({
        locale,
        name: state?.title ?? "",
        subtitle: state?.subtitle ?? "",
        keywords: state?.keywords ?? "",
        description: state?.description ?? "",
        whatsNew: state?.whatsNew ?? "",
        promotionalText: state?.promotionalText ?? "",
      });
    }

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
        `Metadata prepared for ${Object.keys(localeData).length} locale(s)\n
         Delegating to Fastlane worker...`,
      );

      submission.status = "running";

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

  async submitForReviewViaAPI(): Promise<{ ok: boolean; message: string }> {
    const app = await this.asc.getApp(this.settings.ascBundleId);
    if (!app) throw new Error("App not found in App Store Connect");

    const version = await this.asc.getEditableVersion(app.id);
    if (!version) {
      throw new Error(
        "No editable version found. Create a new version first or wait until the current review resolves.",
      );
    }

    const state = version.attributes.appStoreState;
    if (state !== "PREPARE_FOR_SUBMISSION") {
      throw new Error(
        `Version ${version.attributes.versionString} is in state "${state}" and cannot be submitted for review. ` +
          `Only versions in PREPARE_FOR_SUBMISSION state can be submitted.`,
      );
    }

    try {
      await this.asc.submitForReview(version.id);

      logger.info(
        `Submitted version ${version.attributes.versionString} for review via ASC API`,
      );
      return {
        ok: true,
        message: `Version ${version.attributes.versionString} submitted for App Review successfully.`,
      };
    } catch (err: any) {
      const detail = err?.response?.data?.errors?.[0]?.detail ?? err.message;
      throw new Error(`Submit for review failed: ${detail}`);
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
