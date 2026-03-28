import path from "path";
import fs from "fs";
import { logger, prisma } from "../../config";
import { decryptNullable } from "../../config/encryption";
import { frameWithFastlane } from "../../services/frame-screenshots";
import { workerClient } from "../../services/worker-client";
import {
  generateScreenshotSublines,
  type ScreenshotSublines,
} from "../../services/screenshot-subline-generator";

export async function runScreenshotGeneration(jobId: string): Promise<void> {
  const job = await prisma.screenshotJob.findUnique({
    where: { id: jobId },
    include: { app: true },
  });
  if (!job) throw new Error(`Screenshot job ${jobId} not found`);

  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(msg);
    logger.info(`[screenshots:${jobId}] ${msg}`);
  };

  await prisma.screenshotJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  const outputDir = path.join(process.cwd(), "screenshots", jobId);
  await runScreenshotGenerationViaWorker(jobId, job, outputDir, logs, log);
}

async function runScreenshotGenerationViaWorker(
  jobId: string,
  job: any,
  outputDir: string,
  logs: string[],
  log: (msg: string) => void,
): Promise<void> {
  try {
    const userWithToken = await prisma.teamSettings.findFirst({
      where: { githubAccessToken: { not: null } },
    });
    if (!userWithToken?.githubAccessToken) {
      throw new Error("No GitHub access token available");
    }
    if (!job.app.githubRepoFullName) {
      throw new Error("No GitHub repo linked to this app");
    }

    log("Delegating screenshot generation to Fastlane worker...");

    const repoUrl = `https://github.com/${job.app.githubRepoFullName}.git`;
    const result = await workerClient.snapshot({
      repoUrl,
      accessToken: decryptNullable(userWithToken.githubAccessToken)!,
      branch: job.branch ?? undefined,
      appName: job.app.name,
      bundleId: job.app.bundleId,
      iosDir: job.app.githubIosDir ?? undefined,
    });

    logs.push(...result.logs);

    if (!result.ok) {
      throw new Error(`Worker snapshot failed: ${result.errors.join("; ")}`);
    }

    if (result.ipaBuilt && result.ipaPath) {
      log(`Binary build succeeded — IPA stored on worker: ${result.ipaPath}`);
    } else {
      log(
        "Binary build was skipped or failed (non-fatal, screenshots continue)",
      );
    }

    const screenshotUrls: string[] = [];
    const detectedLocales: string[] = [];

    for (const [locale, images] of Object.entries(result.screenshots)) {
      const localeDir =
        locale === "default" ? outputDir : path.join(outputDir, locale);
      fs.mkdirSync(localeDir, { recursive: true });
      for (const img of images) {
        const dest = path.join(localeDir, img.filename);
        fs.writeFileSync(dest, Buffer.from(img.data, "base64"));
        screenshotUrls.push(dest);
      }
      if (locale !== "default") detectedLocales.push(locale);
    }
    log(
      `Saved ${screenshotUrls.length} screenshot(s) from worker to ${outputDir}`,
    );

    const descriptions = result.descriptions ?? {};
    const frameConfig = result.config ?? {};
    const allFilenames = Object.values(result.screenshots)
      .flat()
      .map((i) => i.filename);
    const filenameKeys = [
      ...new Set(
        allFilenames.map((f) => {
          const base = f.replace(/\.[^.]+$/, "");
          const match = base.match(/^(.+?)(?:_[a-z]{2}-[A-Z]{2}_|_[a-z]{2}_)/);
          const extracted = match ? match[1] : base;

          return (
            Object.keys(descriptions).find(
              (k) => extracted === k || extracted.startsWith(k + "_"),
            ) ?? extracted
          );
        }),
      ),
    ];
    const effectiveDescriptions: Record<string, string> = { ...descriptions };
    for (const key of filenameKeys) {
      if (!effectiveDescriptions[key])
        effectiveDescriptions[key] = key.replace(/_/g, " ");
    }
    const hasDescriptions = Object.keys(effectiveDescriptions).length > 0;

    let sublines: ScreenshotSublines = {};
    if (hasDescriptions) {
      log(
        `Generating AI sublines for ${Object.keys(effectiveDescriptions).length} screen(s)...`,
      );
      try {
        sublines = await generateScreenshotSublines(
          job.appId,
          effectiveDescriptions,
          detectedLocales.length > 0 ? detectedLocales : ["en-US"],
        );
        log(
          `AI sublines generated for ${Object.keys(sublines).length} locale(s)`,
        );
      } catch (sublineErr: any) {
        log(`Subline generation failed (non-fatal): ${sublineErr.message}`);
      }
    }

    await prisma.screenshotJob.update({
      where: { id: jobId },
      data: {
        screenshotUrls,
        ...(hasDescriptions && {
          screenshotDescriptions: effectiveDescriptions,
          screenshotSublines: sublines,
        }),
      } as any,
    });

    await autoFrameScreenshots(
      jobId,
      job,
      outputDir,
      effectiveDescriptions,
      sublines,
      frameConfig,
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    logs.push(`ERROR: ${msg}`);

    await prisma.screenshotJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        error: msg,
        completedAt: new Date(),
        logs: JSON.stringify(logs),
      },
    });
  }
}

async function autoFrameScreenshots(
  jobId: string,
  job: any,
  outputDir: string,
  descriptions: Record<string, string>,
  sublines: ScreenshotSublines,
  frameConfig: Record<string, string>,
  log: (msg: string) => void,
): Promise<void> {
  try {
    const screenshotsBase = path.join(process.cwd(), "screenshots");
    const framedDir = path.join(outputDir, "framed");
    const subDirs = fs.existsSync(outputDir)
      ? fs
          .readdirSync(outputDir, { withFileTypes: true })
          .filter((e) => e.isDirectory() && e.name !== "framed")
          .map((e) => path.join(outputDir, e.name))
      : [];
    const sourceDirs = subDirs.length > 0 ? subDirs : [outputDir];
    const framedByLocale: Record<string, string[]> = {};

    const hasDescriptions = Object.keys(descriptions).length > 0;

    for (const srcDir of sourceDirs) {
      const rel = path.relative(outputDir, srcDir);
      const locale = rel === "." ? "default" : path.basename(srcDir);
      const outDir = path.join(framedDir, rel === "." ? "" : rel);
      const localeSublines = sublines[locale] ?? sublines["en-US"] ?? {};
      let outputPaths: string[];

      const bgOptions = {
        bgColor1: frameConfig.bgColor1,
        bgColor2: frameConfig.bgColor2,
        textColor: frameConfig.textColor,
      };

      if (!hasDescriptions) {
        outputPaths = await frameWithFastlane(srcDir, outDir, {
          subtitle: job.app.name,
          ...bgOptions,
        });
      } else {
        outputPaths = [];
        const files = fs
          .readdirSync(srcDir)
          .filter((f) => /\.(png|jpg|jpeg)$/i.test(f));

        for (const filename of files) {
          const base = filename.replace(/\.[^.]+$/, "");
          const descKey = Object.keys(descriptions).find(
            (k) => base === k || base.startsWith(k + "_"),
          );

          const subtitle = descKey
            ? (localeSublines[descKey] ?? descriptions[descKey])
            : job.app.name;

          const singleDir = path.join(srcDir, ".frametmp_" + base);
          const singleOut = path.join(outDir, base);
          fs.mkdirSync(singleDir, { recursive: true });
          fs.copyFileSync(
            path.join(srcDir, filename),
            path.join(singleDir, filename),
          );
          try {
            const paths = await frameWithFastlane(singleDir, singleOut, {
              subtitle,
              ...bgOptions,
            });
            outputPaths.push(...paths);
          } finally {
            fs.rmSync(singleDir, { recursive: true, force: true });
          }
        }
      }

      const urls = outputPaths.map(
        (p) =>
          "/screenshots/" +
          path.relative(screenshotsBase, p).replace(/\\/g, "/"),
      );
      framedByLocale[locale] = (framedByLocale[locale] ?? []).concat(urls);
    }

    await prisma.screenshotJob.update({
      where: { id: jobId },
      data: { framedByLocale: framedByLocale } as any,
    });
    log(
      `Auto-framing complete: ${Object.values(framedByLocale).flat().length} image(s)`,
    );
  } catch (frameErr: any) {
    log(`Auto-framing failed (non-fatal): ${frameErr.message}`);
  }
}
