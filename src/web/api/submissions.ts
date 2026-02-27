import { Router } from "express";
import { logger, getEffectiveSettings } from "../../config";
import { requireAuth } from "../auth";

export const submissionsRouter = Router();
submissionsRouter.use(requireAuth);

// ─── Preview: gather current metadata across all locales ──────────────────────

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
    res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

// ─── Submit metadata via Fastlane deliver ─────────────────────────────────────

submissionsRouter.post("/metadata", async (req, res) => {
  try {
    const settings = await getEffectiveSettings(req.user!.userId);
    const bundleId = req.body.bundleId || settings.ascBundleId;
    const effectiveSettings = { ...settings, ascBundleId: bundleId };
    const overrides = req.body.overrides ?? undefined;

    const { FastlaneService } = await import("../../services/fastlane");
    const fl = new FastlaneService(effectiveSettings);

    // Respond immediately, then run in background
    res.json({
      ok: true,
      message: "Fastlane metadata submission started. Check status for progress.",
    });

    fl.submit("metadata", overrides)
      .then((result) => {
        if (result.ok) {
          logger.info(`Fastlane metadata submit completed (job ${result.jobId})`);
        } else {
          logger.error(`Fastlane metadata submit failed (job ${result.jobId})`, result.errors);
        }
      })
      .catch((err) => logger.error("Fastlane metadata submit error", err));
  } catch (err) {
    res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

// ─── Submit for review via Fastlane ───────────────────────────────────────────

submissionsRouter.post("/review", async (req, res) => {
  try {
    const settings = await getEffectiveSettings(req.user!.userId);
    const bundleId = req.body.bundleId || settings.ascBundleId;
    const effectiveSettings = { ...settings, ascBundleId: bundleId };

    const { FastlaneService } = await import("../../services/fastlane");
    const fl = new FastlaneService(effectiveSettings);

    // Try Fastlane first, fall back to API
    res.json({
      ok: true,
      message: "Submit for review started.",
    });

    fl.submit("submit_for_review")
      .then((result) => {
        if (result.ok) {
          logger.info(`Fastlane submit-for-review completed (job ${result.jobId})`);
        } else {
          logger.error(`Fastlane submit-for-review failed (job ${result.jobId})`, result.errors);
        }
      })
      .catch((err) => logger.error("Fastlane submit-for-review error", err));
  } catch (err) {
    res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

// ─── Submit for review via ASC API (no Fastlane required) ─────────────────────

submissionsRouter.post("/review-api", async (req, res) => {
  try {
    const settings = await getEffectiveSettings(req.user!.userId);
    const bundleId = req.body.bundleId || settings.ascBundleId;
    const effectiveSettings = { ...settings, ascBundleId: bundleId };

    const { FastlaneService } = await import("../../services/fastlane");
    const fl = new FastlaneService(effectiveSettings);
    const result = await fl.submitForReviewViaAPI();

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

// ─── Status of latest / specific submission ───────────────────────────────────

submissionsRouter.get("/status", async (_req, res) => {
  try {
    const { getLatestSubmission, getActiveSubmission } = await import("../../services/fastlane");
    const jobId = _req.query.jobId as string | undefined;

    const submission = jobId ? getActiveSubmission(jobId) : getLatestSubmission();

    if (!submission) {
      res.json({ active: false, logs: [], errors: [], status: "idle" });
      return;
    }

    res.json({
      active: submission.status === "preparing" || submission.status === "running",
      jobId: submission.jobId,
      status: submission.status,
      logs: submission.logs.slice(-100), // last 100 lines
      errors: submission.errors,
      startedAt: submission.startedAt,
    });
  } catch (err) {
    res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
  }
});
