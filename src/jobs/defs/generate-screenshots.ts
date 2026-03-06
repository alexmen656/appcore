import path from "path";
import fs from "fs";
import { logger, prisma } from "../../config";
import { frameWithFastlane } from "../../services/frame-screenshots";
import { workerClient } from "../../services/worker-client";

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
    const userWithToken = await prisma.userSettings.findFirst({
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
      accessToken: userWithToken.githubAccessToken,
      branch: job.branch ?? undefined,
      appName: job.app.name,
      bundleId: job.app.bundleId,
    });

    logs.push(...result.logs);

    if (!result.ok) {
      throw new Error(`Worker snapshot failed: ${result.errors.join("; ")}`);
    }

    const screenshotUrls: string[] = [];
    for (const [locale, images] of Object.entries(result.screenshots)) {
      const localeDir =
        locale === "default" ? outputDir : path.join(outputDir, locale);
      fs.mkdirSync(localeDir, { recursive: true });
      for (const img of images) {
        const dest = path.join(localeDir, img.filename);
        fs.writeFileSync(dest, Buffer.from(img.data, "base64"));
        screenshotUrls.push(dest);
      }
    }
    log(
      `Saved ${screenshotUrls.length} screenshot(s) from worker to ${outputDir}`,
    );

    await prisma.screenshotJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        logs: JSON.stringify(logs),
        screenshotUrls,
      },
    });

    await autoFrameScreenshots(jobId, job, outputDir, log);
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

    for (const srcDir of sourceDirs) {
      const rel = path.relative(outputDir, srcDir);
      const locale = path.basename(srcDir);
      const outDir = path.join(framedDir, rel === "." ? "" : rel);
      const outputPaths = await frameWithFastlane(srcDir, outDir, {
        subtitle: job.app.name,
      });
      const urls = outputPaths.map(
        (p) =>
          "/screenshots/" +
          path.relative(screenshotsBase, p).replace(/\\/g, "/"),
      );
      const key = rel === "." ? "default" : locale;
      framedByLocale[key] = (framedByLocale[key] ?? []).concat(urls);
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
