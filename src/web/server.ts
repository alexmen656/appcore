import express from "express";
import cors from "cors";
import path from "path";
import { logger, prisma } from "../config";
import { appsRouter } from "./api/apps";
import { suggestionsRouter } from "./api/suggestions";
import { keywordsRouter } from "./api/keywords";
import { dashboardRouter } from "./api/dashboard";
import { actionsRouter } from "./api/actions";
import { authRouter } from "./api/auth";
import { settingsRouter } from "./api/settings";
import { ascRouter } from "./api/asc";
import { analyticsRouter } from "./api/analytics";
import { schedulerRouter, scheduler } from "./api/scheduler";
import { mcpRouter } from "./api/mcp";
import { submissionsRouter } from "./api/submissions";
import { githubRouter } from "./api/github";
import { requireAuth } from "./auth";
import { mcpAuth, createMcpHandler } from "./mcp";
import pushRouter from "./api/push";
import { autonomousRouter } from "./api/autonomous";
import { pushService } from "../services/push-notification.js";
import { initScheduler as initASOScheduler } from "../autonomous";
import fs from "fs";

const app = express();
const PORT = process.env.WEB_PORT ?? 3100;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/dashboard", requireAuth, dashboardRouter);
app.use("/api/apps", requireAuth, appsRouter);
app.use("/api/suggestions", requireAuth, suggestionsRouter);
app.use("/api/keywords", requireAuth, keywordsRouter);
app.use("/api/actions", requireAuth, actionsRouter);
app.use("/api/settings", requireAuth, settingsRouter);
app.use("/api/asc", requireAuth, ascRouter);
app.use("/api/analytics", requireAuth, analyticsRouter);
app.use("/api/scheduler", requireAuth, schedulerRouter);
app.use("/api/submissions", requireAuth, submissionsRouter);
app.use("/api/github", githubRouter);
app.use("/api/mcp", mcpRouter);
app.use("/api/push", requireAuth, pushRouter);
app.use("/api/autonomous", requireAuth, autonomousRouter);
app.post("/mcp", mcpAuth, createMcpHandler());

const screenshotsDir = path.join(process.cwd(), "landing_page/screenshots");
app.use("/screenshots", express.static(screenshotsDir));

const landingPage = path.join(process.cwd(), "landing_page/AppCore.html");
app.get("/", (_req, res) => res.sendFile(landingPage));

const HowItWorksPage = path.join(
  process.cwd(),
  "landing_page/how-it-works.html",
);
app.get("/how-it-works", (_req, res) => res.sendFile(HowItWorksPage));

const featuresPage = path.join(process.cwd(), "landing_page/features.html");
app.get("/features", (_req, res) => res.sendFile(featuresPage));

const changelogPage = path.join(process.cwd(), "landing_page/changelog.html");
app.get("/changelog", (_req, res) => res.sendFile(changelogPage));

const blogPage = path.join(process.cwd(), "landing_page/blog.html");
app.get("/blog", (_req, res) => res.sendFile(blogPage));

const pricingPage = path.join(process.cwd(), "landing_page/pricing.html");
app.get("/pricing", (_req, res) => res.sendFile(pricingPage));

const statusPage = path.join(process.cwd(), "landing_page/status.html");
app.get("/status", (_req, res) => res.sendFile(statusPage));

const screenshot = path.join(process.cwd(), "landing_page/screenshot.png");
app.get("/screenshot.png", (_req, res) => res.sendFile(screenshot));

const logo = path.join(process.cwd(), "logo.png");
app.get("/logo.png", (_req, res) => res.sendFile(logo));
app.get("/app/logo.png", (_req, res) => res.sendFile(logo));

const webDist = path.join(__dirname, "../../web/dist");
app.use("/app", express.static(webDist));
app.get("/app/*", (_req, res) => {
  res.sendFile(path.join(webDist, "index.html"));
});

app.listen(PORT, () => {
  logger.info(`AppCore Web UI running at http://localhost:${PORT}`);
  scheduler.start();
  logger.info("Background scheduler started automatically");

  // Start Autonomous ASO cron schedules
  initASOScheduler();
  logger.info("Autonomous ASO scheduler started");

  const apnsKeyId = process.env.APNS_KEY_ID;
  const apnsTeamId = process.env.APNS_TEAM_ID;
  const apnsBundleId = process.env.APNS_BUNDLE_ID || "com.fringelo.AppCore";
  const apnsKeyPath = process.env.APNS_KEY_PATH || "./keys/AuthKey.p8";
  const apnsProduction = process.env.APNS_PRODUCTION === "true";

  if (apnsKeyId && apnsTeamId && fs.existsSync(apnsKeyPath)) {
    pushService.configure({
      keyId: apnsKeyId,
      teamId: apnsTeamId,
      bundleId: apnsBundleId,
      keyPath: apnsKeyPath,
      production: apnsProduction,
    });
    logger.info("APNs push notifications configured");
  } else {
    logger.warn(
      "APNs not configured — set APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_PATH",
    );
  }
});

function shutdown() {
  logger.info("Shutting down...");
  scheduler.stop();
  prisma.$disconnect().then(() => process.exit(0));
}
console.log(require("os").tmpdir());
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
