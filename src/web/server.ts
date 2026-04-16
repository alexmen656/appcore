import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import http from "http";
import { env, logger, prisma } from "../config";
import { appsRouter } from "./api/apps";
import { suggestionsRouter } from "./api/suggestions";
import { keywordsRouter } from "./api/keywords";
import { dashboardRouter } from "./api/dashboard";
import { actionsRouter } from "./api/actions";
import { authRouter } from "./api/auth";
import { settingsRouter } from "./api/settings";
import { ascRouter } from "./api/asc";
import { analyticsRouter } from "./api/analytics";
import { bossRouter } from "./api/boss";
import { bossScheduler } from "../jobs/boss";
import { mcpRouter } from "./api/mcp";
import { oauthRouter } from "./api/oauth";
import { submissionsRouter } from "./api/submissions";
import { githubRouter } from "./api/github";
import { requireAuth } from "./auth";
import { mcpAuth, createMcpHandler } from "./mcp";
import pushRouter from "./api/push";
import { autonomousRouter } from "./api/autonomous";
import { teamRouter } from "./api/team";
import { searchRouter } from "./api/search";
import { adminRouter } from "./api/admin";
import { notificationService } from "../services/notifications/notification.js";
import { initScheduler as initASOScheduler } from "../autonomous";
import fs from "fs";

const app = express();
const PORT = process.env.WEB_PORT ?? 3100;

app.set("trust proxy", 1);
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
  }),
);
const allowedOrigins = env.CORS_ORIGIN
  ? env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:5174"];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin))
        return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
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
app.use("/api/boss", requireAuth, bossRouter);
app.use("/api/submissions", requireAuth, submissionsRouter);
app.use("/api/github", githubRouter);
app.use("/api/mcp", mcpRouter);
app.use("/api/push", requireAuth, pushRouter);
app.use("/api/autonomous", requireAuth, autonomousRouter);
app.use("/api/team", teamRouter);
app.use("/api/search", requireAuth, searchRouter);
app.use("/api/admin", adminRouter);
app.use("/oauth", oauthRouter);

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
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
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
const DOCS_PORT = 3030;
const ADMIN_PORT = 5174;

const docsDist = path.join(process.cwd(), "docs/build");
if (process.env.NODE_ENV === "production") {
  app.use("/docs", express.static(docsDist));
  app.get("/docs/*", (_req, res) =>
    res.sendFile(path.join(docsDist, "index.html")),
  );
} else {
  app.use("/docs", (req, res) => {
    const proxyReq = http.request(
      {
        hostname: "localhost",
        port: DOCS_PORT,
        path: "/docs" + req.url,
        method: req.method,
        headers: { ...req.headers, host: `localhost:${DOCS_PORT}` },
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
        .send(
          "Docs dev server not running — cd docs-site && npm start -- --port 3030",
        );
    });
  });
}

app.get("/app/logo.svg", (_req, res) =>
  res.sendFile(path.join(landingPublic, "logo.svg")),
);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(landingDist));
} else {
  app.use((req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/app") ||
      req.path.startsWith("/admin")
    ) {
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
}

const adminDist = path.join(__dirname, "../../admin/dist");
if (process.env.NODE_ENV === "production") {
  app.use("/admin", express.static(adminDist));
  app.get("/admin/*", (_req, res) => {
    res.sendFile(path.join(adminDist, "index.html"));
  });
} else {
  app.use("/admin", (req, res) => {
    const proxyReq = http.request(
      {
        hostname: "localhost",
        port: ADMIN_PORT,
        path: "/admin" + req.url,
        method: req.method,
        headers: { ...req.headers, host: `localhost:${ADMIN_PORT}` },
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
        .send("Admin dev server not running — cd admin && npm run dev");
    });
  });
}

const webDist = path.join(__dirname, "../../web/dist");
app.use("/app", express.static(webDist));
app.get("/app/*", (_req, res) => {
  res.sendFile(path.join(webDist, "index.html"));
});

app.listen(PORT, async () => {
  logger.info(`Marteso Web UI running at http://localhost:${PORT}`);

  await bossScheduler.start();
  logger.info("pg-boss scheduler started");

  initASOScheduler();
  logger.info("Autonomous ASO scheduler started");

  if (env.APNS_KEY_ID && env.APNS_TEAM_ID && fs.existsSync(env.APNS_KEY_PATH)) {
    notificationService.configure({
      keyId: env.APNS_KEY_ID,
      teamId: env.APNS_TEAM_ID,
      bundleId: env.APNS_BUNDLE_ID,
      keyPath: env.APNS_KEY_PATH,
      apnsHost: env.APNS_HOST,
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
  bossScheduler.stop().finally(() => {
    prisma.$disconnect().then(() => process.exit(0));
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
