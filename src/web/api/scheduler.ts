import { Router } from "express";
import { logger } from "../../config";
import { Scheduler } from "../../jobs/scheduler";
import { requireAuth } from "../auth";

// Singleton scheduler instance shared with the web server
export const scheduler = new Scheduler();

export const schedulerRouter = Router();
schedulerRouter.use(requireAuth);

// ─── GET /api/scheduler/status ───────────────────────────────────────────────
schedulerRouter.get("/status", (_req, res) => {
  res.json({
    running: scheduler.running,
    jobCount: scheduler.jobCount,
  });
});

// ─── POST /api/scheduler/start ──────────────────────────────────────────────
schedulerRouter.post("/start", (_req, res) => {
  if (scheduler.running) {
    res.json({ ok: true, message: "Scheduler already running" });
    return;
  }
  scheduler.start();
  logger.info("Scheduler started via web API");
  res.json({ ok: true, message: "Scheduler started" });
});

// ─── POST /api/scheduler/stop ───────────────────────────────────────────────
schedulerRouter.post("/stop", (_req, res) => {
  if (!scheduler.running) {
    res.json({ ok: true, message: "Scheduler already stopped" });
    return;
  }
  scheduler.stop();
  logger.info("Scheduler stopped via web API");
  res.json({ ok: true, message: "Scheduler stopped" });
});

// ─── POST /api/scheduler/run-all ────────────────────────────────────────────
schedulerRouter.post("/run-all", async (req, res) => {
  const userId = req.user!.userId;

  res.json({ ok: true, message: "Running all jobs now..." });

  scheduler
    .runAllNow(userId)
    .then(() => logger.info("Run-all completed via web API"))
    .catch((err) => logger.error("Run-all failed via web API", err));
});
