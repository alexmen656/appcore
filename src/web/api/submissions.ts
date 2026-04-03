import { Router } from "express";
import fs from "fs";
import path from "path";
import os from "os";
import { logger, getEffectiveSettings } from "../../config";
import { requireAuth } from "../auth";
import { pushService } from "../../services/push-notification.js";

const BUILDS_BASE_DIR = path.join(os.homedir(), "appcore", "builds");

export const submissionsRouter = Router();
submissionsRouter.use(requireAuth);

submissionsRouter.get("/preview", async (req, res) => {
  try {
    const settings = await getEffectiveSettings(req.user!.userId);
    const bundleId = (req.query.bundleId as string) || settings.ascBundleId;
    const effectiveSettings = { ...settings, ascBundleId: bundleId };

    const { FastlaneService } = await import("../../services/fastlane");
    const fl = new FastlaneService(effectiveSettings);
    const preview = await fl.preview();

    res.json(preview);
  } catch (err) {
    logger.error("Submission preview failed", err);
    res
      .status(500)
      .json({ error: String(err instanceof Error ? err.message : err) });
  }
});

submissionsRouter.post("/metadata", async (req, res) => {
  try {
    const settings = await getEffectiveSettings(req.user!.userId);
    const bundleId = req.body.bundleId || settings.ascBundleId;
    const effectiveSettings = { ...settings, ascBundleId: bundleId };
    const overrides = req.body.overrides ?? undefined;

    const { FastlaneService } = await import("../../services/fastlane");
    const fl = new FastlaneService(effectiveSettings);

    res.json({
      ok: true,
      message:
        "Fastlane metadata submission started. Check status for progress.",
    });

    fl.submit("metadata", overrides)
      .then(async (result) => {
        if (result.ok) {
          logger.info(
            `Fastlane metadata submit completed (job ${result.jobId})`,
          );
          await pushService.notifySubmissionUpdate(
            bundleId || "App",
            "",
            "METADATA_SUBMITTED",
          );
        } else {
          logger.error(
            `Fastlane metadata submit failed (job ${result.jobId})`,
            result.errors,
          );
          await pushService.notifySubmissionUpdate(
            bundleId || "App",
            "",
            "METADATA_FAILED",
          );
        }
      })
      .catch((err) => logger.error("Fastlane metadata submit error", err));
  } catch (err) {
    res
      .status(500)
      .json({ error: String(err instanceof Error ? err.message : err) });
  }
});

submissionsRouter.post("/review", async (req, res) => {
  try {
    const settings = await getEffectiveSettings(req.user!.userId);
    const bundleId = req.body.bundleId || settings.ascBundleId;
    const effectiveSettings = { ...settings, ascBundleId: bundleId };

    const { FastlaneService } = await import("../../services/fastlane");
    const fl = new FastlaneService(effectiveSettings);

    res.json({
      ok: true,
      message: "Submit for review started.",
    });

    fl.submit("submit_for_review")
      .then(async (result) => {
        if (result.ok) {
          logger.info(
            `Fastlane submit-for-review completed (job ${result.jobId})`,
          );
          await pushService.notifySubmissionUpdate(
            bundleId || "App",
            "",
            "SUBMITTED_FOR_REVIEW",
          );
        } else {
          logger.error(
            `Fastlane submit-for-review failed (job ${result.jobId})`,
            result.errors,
          );
          await pushService.notifySubmissionUpdate(
            bundleId || "App",
            "",
            "SUBMISSION_FAILED",
          );
        }
      })
      .catch((err) => logger.error("Fastlane submit-for-review error", err));
  } catch (err) {
    res
      .status(500)
      .json({ error: String(err instanceof Error ? err.message : err) });
  }
});

submissionsRouter.get("/status", async (_req, res) => {
  try {
    const { getLatestSubmission, getActiveSubmission } =
      await import("../../services/fastlane");
    const jobId = _req.query.jobId as string | undefined;

    const submission = jobId
      ? getActiveSubmission(jobId)
      : getLatestSubmission();

    if (!submission) {
      res.json({ active: false, logs: [], errors: [], status: "idle" });
      return;
    }

    res.json({
      active:
        submission.status === "preparing" || submission.status === "running",
      jobId: submission.jobId,
      status: submission.status,
      logs: submission.logs.slice(-100),
      errors: submission.errors,
      startedAt: submission.startedAt,
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: String(err instanceof Error ? err.message : err) });
  }
});

submissionsRouter.get("/build-info", async (req, res) => {
  try {
    const settings = await getEffectiveSettings(req.user!.userId);
    const bundleId = (req.query.bundleId as string) || settings.ascBundleId;
    if (!bundleId) {
      res.json({ build: null });
      return;
    }
    const jsonPath = path.join(BUILDS_BASE_DIR, bundleId, "latest.json");
    if (!fs.existsSync(jsonPath)) {
      res.json({ build: null });
      return;
    }
    const build = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

    let iconUrl: string | null = null;
    try {
      const { default: axios } = await import("axios");
      const { data } = await axios.get(
        `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(bundleId)}&limit=1`,
        { timeout: 5000 },
      );
      const result = data.results?.[0];
      if (result?.artworkUrl100) {
        iconUrl = (result.artworkUrl100 as string).replace(
          "100x100bb",
          "200x200bb",
        );
      }
    } catch {
      // icon is optional
    }

    res.json({ build: { ...build, iconUrl } });
  } catch (err) {
    logger.error("build-info failed", err);
    res
      .status(500)
      .json({ error: String(err instanceof Error ? err.message : err) });
  }
});
