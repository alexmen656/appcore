import type { Job } from "pg-boss";
import { logger, getEffectiveSettingsForTeam } from "../../config";
import { prisma } from "../../config/database";
import { AppStoreConnectClient } from "../../services/appstore-connect";
import { AIAnalyzer } from "../../services/ai-analyzer";
import * as tracker from "../translation-tracker";

export const QUEUE_NAME = "translate-localization";

export interface TranslateLocalizationData {
  teamId: string;
  bundleId: string;
  versionId: string;
  sourceLocale: string;
  targetLocale: string;
  appInfoLocalizationId?: string | null;
  versionLocalizationId?: string | null;
  sourceFields: Partial<
    Record<"name" | "subtitle" | "keywords" | "description" | "promotionalText" | "whatsNew", string>
  >;
  extraFields?: Partial<Record<"privacyPolicyUrl" | "supportUrl" | "marketingUrl", string>>;
}

const APP_INFO_FIELDS = new Set(["name", "subtitle", "privacyPolicyUrl"]);

export async function handler([job]: Job<TranslateLocalizationData>[]): Promise<void> {
  const {
    data: {
      teamId,
      bundleId,
      versionId,
      sourceLocale,
      targetLocale,
      appInfoLocalizationId,
      versionLocalizationId,
      sourceFields,
      extraFields,
    },
    id,
  } = job;

  logger.info(`[BOSS] Starting "${QUEUE_NAME}" job ${id} — ${bundleId} ${sourceLocale} → ${targetLocale}`);

  tracker.add(versionId, targetLocale);

  try {
    const settings = await getEffectiveSettingsForTeam(teamId);
    if (!settings.ascIssuerId || !settings.ascKeyId || !settings.ascPrivateKey) {
      logger.warn(`[BOSS] ASC credentials missing for team ${teamId}, aborting translation`);
      return;
    }

    const analyzer = new AIAnalyzer(bundleId, settings);
    const translated = await analyzer.translateLocalization(sourceLocale, targetLocale, sourceFields);

    const merged: Record<string, string> = { ...translated };
    if (extraFields?.privacyPolicyUrl) merged.privacyPolicyUrl = extraFields.privacyPolicyUrl;
    if (extraFields?.supportUrl) merged.supportUrl = extraFields.supportUrl;
    if (extraFields?.marketingUrl) merged.marketingUrl = extraFields.marketingUrl;

    const asc = new AppStoreConnectClient({
      issuerId: settings.ascIssuerId,
      keyId: settings.ascKeyId,
      privateKey: settings.ascPrivateKey,
    });

    const appInfoUpdates: Record<string, string> = {};
    const versionUpdates: Record<string, string> = {};
    for (const [field, value] of Object.entries(merged)) {
      if (!value || !value.trim()) continue;
      if (APP_INFO_FIELDS.has(field)) appInfoUpdates[field] = value;
      else versionUpdates[field] = value;
    }

    if (appInfoLocalizationId && Object.keys(appInfoUpdates).length > 0) {
      try {
        await asc.updateAppInfoLocalization(appInfoLocalizationId, appInfoUpdates);
      } catch (err) {
        logger.error(`[BOSS] ${QUEUE_NAME} failed to update app info ${appInfoLocalizationId}`, {
          error: err instanceof Error ? err.message : err,
        });
      }
    }

    if (versionLocalizationId && Object.keys(versionUpdates).length > 0) {
      try {
        await asc.updateVersionLocalization(versionLocalizationId, versionUpdates);
      } catch (err) {
        logger.error(`[BOSS] ${QUEUE_NAME} failed to update version loc ${versionLocalizationId}`, {
          error: err instanceof Error ? err.message : err,
        });
      }
    }

    await prisma.appStoreVersion.update({ where: { id: versionId }, data: { syncedAt: new Date(0) } }).catch(() => {});

    logger.info(`[BOSS] "${QUEUE_NAME}" job ${id} completed (${targetLocale})`);
  } finally {
    tracker.remove(versionId, targetLocale);
  }
}
