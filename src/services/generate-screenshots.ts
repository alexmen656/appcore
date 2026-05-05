import path from "path";
import fs from "fs";
import { logger, prisma, getTeamSettings } from "../config";
import { decryptNullable } from "../config/encryption";
import { frameWithFastlane } from "./frame-screenshots";
import { workerClient } from "./worker-client";
import { postCommitStatus } from "./github";
import { generateScreenshotSublines, type ScreenshotSublines } from "./screenshot-subline-generator";
import { AppStoreConnectClient } from "./appstore-connect";
import { Prisma } from "@prisma/client";
import { createJobLogEmitter } from "./log-bus";

const GITHUB_STATUS_DESC_MAX_LEN = 140;
const VALID_LOCALE_RE = /^[a-zA-Z]{2,8}(?:-[a-zA-Z]{2,8})?$/;

type ScreenshotJobWithApp = Prisma.ScreenshotJobGetPayload<{ include: { app: true } }>;

type VersionLocale = {
  locale: string;
  name?: string;
  subtitle?: string;
};

const EDITABLE_VERSION_STATES = new Set([
  "PREPARE_FOR_SUBMISSION",
  "DEVELOPER_REJECTED",
  "REJECTED",
  "METADATA_REJECTED",
  "WAITING_FOR_REVIEW",
  "WAITING_FOR_EXPORT_COMPLIANCE",
  "PENDING_DEVELOPER_RELEASE",
  "IN_REVIEW",
]);

export async function runScreenshotGeneration(jobId: string): Promise<void> {
  const job = await prisma.screenshotJob.findUnique({
    where: { id: jobId },
    include: { app: true },
  });
  if (!job) throw new Error(`Screenshot job ${jobId} not found`);

  const logs: string[] = [];
  const { emit: emitLog, finish: finishLog } = createJobLogEmitter(jobId);
  const log = (msg: string) => {
    logs.push(msg);
    emitLog(msg);
    logger.info(`[screenshots:${jobId}] ${msg}`);
  };

  await prisma.screenshotJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  try {
    await runWorkerScreenshotGeneration(jobId, job, path.join(process.cwd(), "screenshots", jobId), logs, log);
  } finally {
    finishLog();
  }
}

async function runWorkerScreenshotGeneration(
  jobId: string,
  job: ScreenshotJobWithApp,
  outputDir: string,
  logs: string[],
  log: (msg: string) => void,
): Promise<void> {
  let token: string | undefined;
  let repoFullName: string | undefined;

  try {
    if (!job.app.teamId) {
      throw new Error("App has no team");
    }

    const teamSettings = await getTeamSettings(job.app.teamId);

    if (!teamSettings?.githubAccessToken) {
      throw new Error("No GitHub access token available");
    }
    if (!job.app.githubRepoFullName) {
      throw new Error("No GitHub repo linked to this app");
    }

    const decrypted = decryptNullable(teamSettings.githubAccessToken);
    if (!decrypted) throw new Error("Failed to decrypt GitHub access token");
    token = decrypted;
    repoFullName = job.app.githubRepoFullName;

    if (job.commitSha) {
      await postCommitStatus(
        decrypted,
        job.app.githubRepoFullName,
        job.commitSha,
        "pending",
        "marteso/screenshots",
        "Screenshot generation in progress…",
      );
    }

    log("Delegating screenshot generation to worker...");

    let envVars: Record<string, string> | undefined;
    if (job.app.snapshotEnvVars) {
      try {
        const decryptedVars = decryptNullable(job.app.snapshotEnvVars);
        if (!decryptedVars) throw new Error("Failed to decrypt snapshotEnvVars");
        const parsed: Array<{ key: string; value: string }> = JSON.parse(decryptedVars);
        envVars = Object.fromEntries(parsed.map(({ key, value }) => [key, value]));
        log(`[config] Loaded ${parsed.length} UI test environment variable(s)`);
      } catch {
        log("[config] Warning: could not parse snapshotEnvVars - skipping");
      }
    } else {
      log(
        "[config] Warning: no UI test environment variables configured for this app - if your tests require login, add EMAIL/PASSWORD under App Settings → UI Test Environment",
      );
    }

    const result = await workerClient.snapshot(
      {
        repoUrl: `https://github.com/${repoFullName}.git`,
        accessToken: token,
        branch: job.branch ?? undefined,
        appName: job.app.name,
        bundleId: job.app.bundleId,
        iosDir: job.app.githubIosDir ?? undefined,
        envVars,
      },
      log,
    );

    if (!result.ok) {
      throw new Error(`Worker snapshot failed: ${result.errors.join("; ")}`);
    }

    const screenshotUrls: string[] = [];
    const detectedLocales: string[] = [];

    for (const [locale, images] of Object.entries(result.screenshots)) {
      if (!VALID_LOCALE_RE.test(locale)) {
        log(`[snapshot] Skipping invalid locale: ${locale}`);
        continue;
      }

      await fs.promises.mkdir(path.join(outputDir, "raw", locale), { recursive: true });

      for (const img of images) {
        const safeFilename = path.basename(img.filename);
        if (!safeFilename || !/^[a-zA-Z0-9_\-. ]+$/.test(safeFilename)) {
          log(`[snapshot] Skipping suspicious filename: ${img.filename}`);
          continue;
        }
        await fs.promises.writeFile(path.join(outputDir, "raw", locale, safeFilename), Buffer.from(img.data, "base64"));
        screenshotUrls.push(`/screenshots/${jobId}/raw/${locale}/${safeFilename}`);
      }

      detectedLocales.push(locale);
    }
    log(
      `[snapshot] Saved ${screenshotUrls.length} screenshot${screenshotUrls.length === 1 ? "" : "s"} from worker: ${screenshotUrls.join(", ")} (outputDir=${outputDir})`,
    );

    if (result.xcresultLogs && result.xcresultLogs.length > 0) {
      const logsDir = path.join(outputDir, "logs");
      await fs.promises.mkdir(logsDir, { recursive: true });
      let saved = 0;
      for (const archive of result.xcresultLogs) {
        const safeFilename = path.basename(archive.filename);
        if (!safeFilename || !/^[a-zA-Z0-9_\-. ]+$/.test(safeFilename)) {
          log(`[snapshot] Skipping suspicious xcresult filename: ${archive.filename}`);
          continue;
        }
        if (!archive.data) {
          log(`[snapshot] Skipping xcresult ${safeFilename}: no data (download failed)`);
          continue;
        }
        await fs.promises.writeFile(path.join(logsDir, safeFilename), Buffer.from(archive.data, "base64"));
        saved += 1;
      }
      log(`[snapshot] Saved ${saved} xcresult archive(s) to ${logsDir}`);
    }

    const descriptions = result.descriptions ?? {};
    const frameConfig = result.config ?? {};
    const filenameKeys = [
      ...new Set(
        Object.values(result.screenshots)
          .flat()
          .map(({ filename }) => {
            const base =
              filename.replace(/\.[^.]+$/, "").match(/^(.+?)(?:_[a-z]{2}(?:-[A-Z]{2})?_)/)?.[1] ??
              filename.replace(/\.[^.]+$/, "");
            return Object.keys(descriptions).find((k) => base === k || base.startsWith(k + "_")) ?? base;
          }),
      ),
    ];
    const effectiveDescriptions: Record<string, string> = { ...descriptions };

    for (const key of filenameKeys) {
      if (!effectiveDescriptions[key]) effectiveDescriptions[key] = key.replace(/_/g, " ");
    }

    const hasDescriptions = Object.keys(effectiveDescriptions).length > 0;
    let sublines: ScreenshotSublines = {};

    const targetVersionLocales = await resolveLatestVersionLocales(job, log);
    const targetLocales =
      targetVersionLocales.length > 0
        ? targetVersionLocales.map((loc) => loc.locale)
        : detectedLocales.length > 0
          ? detectedLocales
          : ["en-US"];
    const versionLocaleMap = Object.fromEntries(targetVersionLocales.map((loc) => [loc.locale, loc]));

    log(`[framing] Target locales: ${targetLocales.join(", ")}`);

    if (hasDescriptions && screenshotUrls.length > 0) {
      log(
        `[framing] Generating AI sublines for ${Object.keys(effectiveDescriptions).length} screen${Object.keys(effectiveDescriptions).length === 1 ? "" : "s"}...`,
      );
      try {
        sublines = await generateScreenshotSublines(job.appId, effectiveDescriptions, targetLocales);
        log(
          `[framing] AI sublines generated for ${Object.keys(sublines).length} locale${Object.keys(sublines).length === 1 ? "" : "s"}`,
        );
      } catch (sublineErr) {
        const sublineMsg = sublineErr instanceof Error ? sublineErr.message : String(sublineErr);
        log(`[framing] Subline generation failed (non-fatal): ${sublineMsg}`);
      }
    }

    await prisma.screenshotJob.update({
      where: { id: jobId },
      data: {
        screenshotUrls,
        ...(hasDescriptions && {
          screenshotDescriptions: effectiveDescriptions as Prisma.InputJsonValue,
          screenshotSublines: sublines as Prisma.InputJsonValue,
        }),
      },
    });

    await frameScreenshots(
      jobId,
      job,
      outputDir,
      effectiveDescriptions,
      hasDescriptions,
      sublines,
      frameConfig,
      targetLocales,
      versionLocaleMap,
      log,
    );

    await prisma.screenshotJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        logs: JSON.stringify(logs),
      },
    });

    if (job.commitSha && token && repoFullName) {
      await postCommitStatus(
        token,
        repoFullName,
        job.commitSha,
        "success",
        "marteso/screenshots",
        "Screenshots generated successfully",
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`ERROR: ${msg}`);

    await prisma.screenshotJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        error: msg,
        completedAt: new Date(),
        logs: JSON.stringify(logs),
      },
    });

    if (job.commitSha && token && repoFullName) {
      await postCommitStatus(
        token,
        repoFullName,
        job.commitSha,
        "failure",
        "marteso/screenshots",
        msg.slice(0, GITHUB_STATUS_DESC_MAX_LEN),
      );
    }
  }
}

function compareVersionStrings(a: string, b: string): number {
  const aParts = a
    .split(/[^\d]+/)
    .filter(Boolean)
    .map(Number);
  const bParts = b
    .split(/[^\d]+/)
    .filter(Boolean)
    .map(Number);
  const len = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < len; i += 1) {
    const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
    if (diff !== 0) return diff;
  }

  return a.localeCompare(b);
}

function uniqueValidLocales(locales: VersionLocale[]): VersionLocale[] {
  const seen = new Set<string>();
  const result: VersionLocale[] = [];

  for (const loc of locales) {
    if (!VALID_LOCALE_RE.test(loc.locale) || seen.has(loc.locale)) continue;
    seen.add(loc.locale);
    result.push(loc);
  }

  return result;
}

async function resolveLatestVersionLocales(
  job: ScreenshotJobWithApp,
  log: (msg: string) => void,
): Promise<VersionLocale[]> {
  const versions = await prisma.appStoreVersion.findMany({
    where: { bundleId: job.app.bundleId },
    include: { localizations: true },
  });

  const ranked = versions
    .filter((v) => v.localizations.length > 0)
    .sort((a, b) => {
      const versionDiff = compareVersionStrings(b.versionString, a.versionString);
      if (versionDiff !== 0) return versionDiff;

      const stateDiff =
        Number(EDITABLE_VERSION_STATES.has(b.appStoreState)) - Number(EDITABLE_VERSION_STATES.has(a.appStoreState));
      if (stateDiff !== 0) return stateDiff;

      return b.syncedAt.getTime() - a.syncedAt.getTime();
    });

  const cached = ranked[0];
  if (cached) {
    const locales = uniqueValidLocales(
      cached.localizations.map((loc) => ({
        locale: loc.locale,
        name: loc.name,
        subtitle: loc.subtitle,
      })),
    );

    log(`[framing] Using ${locales.length} locale(s) from App Store version ${cached.versionString}`);
    return locales;
  }

  if (!job.app.teamId || !job.app.trackId) {
    log("[framing] No cached App Store version locales found - using captured screenshot locales");
    return [];
  }

  const teamSettings = await getTeamSettings(job.app.teamId);
  const privateKey = decryptNullable(teamSettings?.ascPrivateKey);
  
  if (!teamSettings?.ascIssuerId || !teamSettings.ascKeyId || !privateKey) {
    log("[framing] No ASC credentials available for version locale refresh - using captured screenshot locales");
    return [];
  }

  try {
    const asc = new AppStoreConnectClient({
      issuerId: teamSettings.ascIssuerId,
      keyId: teamSettings.ascKeyId,
      privateKey,
    });
    const ascAppId = String(job.app.trackId);
    const versionsFromAsc = await asc.listVersions(ascAppId);
    const latestVersion = versionsFromAsc.sort((a, b) =>
      compareVersionStrings(b.attributes.versionString, a.attributes.versionString),
    )[0];

    if (!latestVersion) {
      log("[framing] ASC returned no versions - using captured screenshot locales");
      return [];
    }

    const [versionLocalizations, appInfoLocalizations] = await Promise.all([
      asc.getVersionLocalizations(latestVersion.id),
      asc.getAppInfoLocalizations(ascAppId).catch(() => []),
    ]);

    const locales = uniqueValidLocales(
      versionLocalizations.map((loc) => {
        const appInfo = new Map(appInfoLocalizations.map((loc) => [loc.attributes.locale, loc])).get(
          loc.attributes.locale,
        );
        return {
          locale: loc.attributes.locale,
          name: appInfo?.attributes.name,
          subtitle: appInfo?.attributes.subtitle,
        };
      }),
    );

    log(`[framing] Refreshed ${locales.length} locale(s) from ASC version ${latestVersion.attributes.versionString}`);
    return locales;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`[framing] Could not refresh version locales from ASC - using captured screenshot locales: ${msg}`);
    return [];
  }
}

function pickSourceLocale(targetLocale: string, sourceLocales: string[]): string | null {
  if (sourceLocales.includes(targetLocale)) return targetLocale;
  if (sourceLocales.includes("en-US")) return "en-US";
  if (sourceLocales.includes("en")) return "en";

  return sourceLocales.find((locale) => locale.toLowerCase().startsWith("en-")) ?? sourceLocales[0] ?? null;
}

async function frameScreenshots(
  jobId: string,
  job: ScreenshotJobWithApp,
  outputDir: string,
  descriptions: Record<string, string>,
  hasDescriptions: boolean,
  sublines: ScreenshotSublines,
  frameConfig: Record<string, string>,
  targetLocales: string[],
  versionLocales: Record<string, VersionLocale>,
  log: (msg: string) => void,
): Promise<void> {
  try {
    const rawEntries = await fs.promises.readdir(path.join(outputDir, "raw"), { withFileTypes: true }).catch(() => []);
    const sourceLocaleDirs = new Map(
      rawEntries.filter((e) => e.isDirectory()).map((e) => [e.name, path.join(outputDir, "raw", e.name)]),
    );
    const sourceLocales = [...sourceLocaleDirs.keys()];
    const framedByLocale: Record<string, string[]> = {};

    for (const locale of targetLocales) {
      const sourceLocale = pickSourceLocale(locale, sourceLocales);
      if (!sourceLocale) {
        log(`[framing] ${locale}: no raw screenshots available`);
        continue;
      }

      const srcDir = sourceLocaleDirs.get(sourceLocale);
      if (!srcDir) continue;

      if (sourceLocale !== locale) {
        log(`[framing] ${locale}: using ${sourceLocale} screenshots with localized text`);
      }

      const localeSublines = sublines[locale] ?? sublines["en-US"] ?? {};
      let outputPaths: string[];
      const versionLocale = versionLocales[locale];
      const defaultSubtitle = versionLocale?.subtitle || versionLocale?.name || job.app.currentSubtitle || job.app.name;

      const bgOptions = {
        bgColor1: frameConfig.bgColor1,
        bgColor2: frameConfig.bgColor2,
        textColor: frameConfig.textColor,
      };

      if (!hasDescriptions) {
        outputPaths = await frameWithFastlane(
          srcDir,
          path.join(outputDir, "framed", locale),
          {
            subtitle: defaultSubtitle,
            ...bgOptions,
          },
          path.join(outputDir, "unframed", locale),
        );
      } else {
        outputPaths = [];
        const allEntries = await fs.promises.readdir(srcDir);
        const files = allEntries.filter((f) => /\.(png|jpg|jpeg)$/i.test(f));
        log(`[framing] srcDir=${srcDir} all=${allEntries.join(", ") || "(none)"} png=${files.join(", ") || "(none)"}`);

        for (const filename of files) {
          const base = filename.replace(/\.[^.]+$/, "");
          const descKey = Object.keys(descriptions).find((k) => base === k || base.startsWith(k + "_"));
          const subtitle = descKey ? (localeSublines[descKey] ?? descriptions[descKey]) : defaultSubtitle;
          const singleDir = path.join(srcDir, ".frametmp_" + base);

          await fs.promises.mkdir(singleDir, { recursive: true });
          await fs.promises.copyFile(path.join(srcDir, filename), path.join(singleDir, filename));

          try {
            const paths = await frameWithFastlane(
              singleDir,
              path.join(outputDir, "framed", locale),
              {
                subtitle,
                ...bgOptions,
              },
              path.join(outputDir, "unframed", locale),
            );
            log(`[framing] ${filename} → ${paths.length} path(s)`);
            outputPaths.push(...paths);
          } finally {
            await fs.promises.rm(singleDir, { recursive: true, force: true });
          }
        }
      }

      const urls = outputPaths.map(
        (p) => "/screenshots/" + path.relative(path.join(process.cwd(), "screenshots"), p).replace(/\\/g, "/"),
      );
      framedByLocale[locale] = (framedByLocale[locale] ?? []).concat(urls);
    }

    await prisma.screenshotJob.update({
      where: { id: jobId },
      data: { framedByLocale: framedByLocale as Prisma.InputJsonValue },
    });

    log(`[framing] Framing complete: ${Object.values(framedByLocale).flat().length} image(s)`);
  } catch (frameErr) {
    const frameMsg = frameErr instanceof Error ? frameErr.message : String(frameErr);
    const stack = frameErr instanceof Error ? frameErr.stack : undefined;
    log(`[framing] Framing failed (non-fatal): ${frameMsg}`);
    if (stack) log(`[framing] Stack: ${stack.split("\n").slice(0, 4).join(" | ")}`);
  }
}
