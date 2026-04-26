import path from "path";
import fs from "fs";
import { logger, prisma } from "../config";
import { decryptNullable } from "../config/encryption";
import { frameWithFastlane } from "./frame-screenshots";
import { workerClient } from "./worker-client";
import { postCommitStatus } from "./github";
import { generateScreenshotSublines, type ScreenshotSublines } from "./screenshot-subline-generator";
import { Prisma } from "@prisma/client";

type ScreenshotJobWithApp = Prisma.ScreenshotJobGetPayload<{ include: { app: true } }>;

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
  job: ScreenshotJobWithApp,
  outputDir: string,
  logs: string[],
  log: (msg: string) => void,
): Promise<void> {
  let token: string | undefined;
  let repoFullName: string | undefined;

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

    const decrypted = decryptNullable(userWithToken.githubAccessToken);
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
        log("[config] Warning: could not parse snapshotEnvVars — skipping");
      }
    } else {
      log(
        "[config] Warning: no UI test environment variables configured for this app — if your tests require login, add EMAIL/PASSWORD under App Settings → UI Test Environment",
      );
    }

    const result = await workerClient.snapshot({
      repoUrl: `https://github.com/${repoFullName}.git`,
      accessToken: token,
      branch: job.branch ?? undefined,
      appName: job.app.name,
      bundleId: job.app.bundleId,
      iosDir: job.app.githubIosDir ?? undefined,
      envVars,
    });

    result.logs.forEach(log);

    if (!result.ok) {
      throw new Error(`Worker snapshot failed: ${result.errors.join("; ")}`);
    }

    const screenshotsBase = path.join(process.cwd(), "screenshots");
    const screenshotUrls: string[] = [];
    const detectedLocales: string[] = [];

    for (const [locale, images] of Object.entries(result.screenshots)) {
      const localeDir = locale === "default" ? outputDir : path.join(outputDir, locale);
      await fs.promises.mkdir(localeDir, { recursive: true });
      for (const img of images) {
        const dest = path.join(localeDir, img.filename);
        await fs.promises.writeFile(dest, Buffer.from(img.data, "base64"));
        screenshotUrls.push("/screenshots/" + path.relative(screenshotsBase, dest).replace(/\\/g, "/"));
      }
      if (locale !== "default") detectedLocales.push(locale);
    }
    log(`[snapshot] Saved ${screenshotUrls.length} screenshot${screenshotUrls.length === 1 ? "" : "s"} from worker`);

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

          return Object.keys(descriptions).find((k) => extracted === k || extracted.startsWith(k + "_")) ?? extracted;
        }),
      ),
    ];
    const effectiveDescriptions: Record<string, string> = { ...descriptions };

    for (const key of filenameKeys) {
      if (!effectiveDescriptions[key]) effectiveDescriptions[key] = key.replace(/_/g, " ");
    }
    const hasDescriptions = Object.keys(effectiveDescriptions).length > 0;

    let sublines: ScreenshotSublines = {};
    if (hasDescriptions) {
      log(
        `[framing] Generating AI sublines for ${Object.keys(effectiveDescriptions).length} screen${Object.keys(effectiveDescriptions).length === 1 ? "" : "s"}...`,
      );
      try {
        sublines = await generateScreenshotSublines(
          job.appId,
          effectiveDescriptions,
          detectedLocales.length > 0 ? detectedLocales : ["en-US"],
        );
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

    await autoFrameScreenshots(jobId, job, outputDir, effectiveDescriptions, sublines, frameConfig, log);

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

    if (job.commitSha && token && repoFullName) {
      await postCommitStatus(token, repoFullName, job.commitSha, "failure", "marteso/screenshots", msg.slice(0, 140));
    }
  }
}

async function autoFrameScreenshots(
  jobId: string,
  job: ScreenshotJobWithApp,
  outputDir: string,
  descriptions: Record<string, string>,
  sublines: ScreenshotSublines,
  frameConfig: Record<string, string>,
  log: (msg: string) => void,
): Promise<void> {
  try {
    const screenshotsBase = path.join(process.cwd(), "screenshots");
    const framedDir = path.join(outputDir, "framed");
    const unframedBaseDir = path.join(outputDir, "unframed");
    const outputDirEntries = await fs.promises.readdir(outputDir, { withFileTypes: true }).catch(() => []);
    const subDirs = outputDirEntries
      .filter((e) => e.isDirectory() && e.name !== "framed")
      .map((e) => path.join(outputDir, e.name));
    const sourceDirs = subDirs.length > 0 ? subDirs : [outputDir];
    const framedByLocale: Record<string, string[]> = {};
    const hasDescriptions = Object.keys(descriptions).length > 0;

    for (const srcDir of sourceDirs) {
      const rel = path.relative(outputDir, srcDir);
      const locale = rel === "." ? "default" : path.basename(srcDir);
      const outDir = path.join(framedDir, rel === "." ? "" : rel);
      const unframedOutDir = path.join(unframedBaseDir, rel === "." ? "" : rel);
      const localeSublines = sublines[locale] ?? sublines["en-US"] ?? {};
      let outputPaths: string[];

      const bgOptions = {
        bgColor1: frameConfig.bgColor1,
        bgColor2: frameConfig.bgColor2,
        textColor: frameConfig.textColor,
      };

      if (!hasDescriptions) {
        outputPaths = await frameWithFastlane(
          srcDir,
          outDir,
          {
            subtitle: job.app.name,
            ...bgOptions,
          },
          unframedOutDir,
        );
      } else {
        outputPaths = [];
        const files = (await fs.promises.readdir(srcDir)).filter((f) => /\.(png|jpg|jpeg)$/i.test(f));

        for (const filename of files) {
          const base = filename.replace(/\.[^.]+$/, "");
          const descKey = Object.keys(descriptions).find((k) => base === k || base.startsWith(k + "_"));
          const subtitle = descKey ? (localeSublines[descKey] ?? descriptions[descKey]) : job.app.name;
          const singleDir = path.join(srcDir, ".frametmp_" + base);
          const singleOut = path.join(outDir, base);
          const singleUnframedOut = path.join(unframedOutDir, base);

          await fs.promises.mkdir(singleDir, { recursive: true });
          await fs.promises.copyFile(path.join(srcDir, filename), path.join(singleDir, filename));

          try {
            const paths = await frameWithFastlane(
              singleDir,
              singleOut,
              {
                subtitle,
                ...bgOptions,
              },
              singleUnframedOut,
            );
            outputPaths.push(...paths);
          } finally {
            await fs.promises.rm(singleDir, { recursive: true, force: true });
          }
        }
      }

      const urls = outputPaths.map((p) => "/screenshots/" + path.relative(screenshotsBase, p).replace(/\\/g, "/"));
      framedByLocale[locale] = (framedByLocale[locale] ?? []).concat(urls);
    }

    await prisma.screenshotJob.update({
      where: { id: jobId },
      data: { framedByLocale: framedByLocale as Prisma.InputJsonValue },
    });

    const totalFramed = Object.values(framedByLocale).flat().length;
    log(`[framing] Framing complete: ${totalFramed} image${totalFramed === 1 ? "" : "s"}`);
  } catch (frameErr) {
    const frameMsg = frameErr instanceof Error ? frameErr.message : String(frameErr);
    log(`[framing] Framing failed (non-fatal): ${frameMsg}`);
  }
}
