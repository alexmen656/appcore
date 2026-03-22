import express from "express";
import cors from "cors";
import path from "path";
import http from "http";
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
import { oauthRouter } from "./api/oauth";
import { submissionsRouter } from "./api/submissions";
import { githubRouter } from "./api/github";
import { requireAuth } from "./auth";
import { mcpAuth, createMcpHandler } from "./mcp";
import pushRouter from "./api/push";
import { autonomousRouter } from "./api/autonomous";
import { teamRouter } from "./api/team";
import { pushService } from "../services/push-notification.js";
import { initScheduler as initASOScheduler } from "../autonomous";
import fs from "fs";

const app = express();
const PORT = process.env.WEB_PORT ?? 3100;

app.set("trust proxy", 1);
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
app.use("/api/team", teamRouter);
app.use("/", oauthRouter);

app.get("/.well-known/oauth-protected-resource", (req, res) => {
  const base = `${req.protocol}://${req.get("host")}`;
  res.json({
    resource: `${base}/mcp`,
    authorization_servers: [base],
  });
});

app.get("/.well-known/oauth-authorization-server", (req, res) => {
  const base = `${req.protocol}://${req.get("host")}`;
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["client_secret_post"],
  });
});
app.post("/mcp", mcpAuth, createMcpHandler());

const screenshotsDir = path.join(process.cwd(), "screenshots");
app.use("/screenshots", express.static(screenshotsDir));

const landingDist = path.join(process.cwd(), "landing/dist");
const landingPublic = path.join(process.cwd(), "landing/public");
const ASTRO_PORT = 4321;

app.get("/app/logo.png", (_req, res) =>
  res.sendFile(path.join(landingPublic, "logo.png")),
);

if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/app")) {
      return next();
    }
    const proxyReq = http.request(
      {
        hostname: "localhost",
        port: ASTRO_PORT,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `localhost:${ASTRO_PORT}` },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );
    req.pipe(proxyReq);
    proxyReq.on("error", () => {
      res
        .status(502)
        .send("Astro dev server not running — cd landing && npm run dev");
    });
  });
} else {
  app.use(express.static(landingDist));
}

const webDist = path.join(__dirname, "../../web/dist");
app.use("/app", express.static(webDist));
app.get("/app/*", (_req, res) => {
  res.sendFile(path.join(webDist, "index.html"));
});

app.listen(PORT, () => {
  logger.info(`Marteso Web UI running at http://localhost:${PORT}`);
  scheduler.start();
  logger.info("Background scheduler started automatically");

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
