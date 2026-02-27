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
import { requireAuth } from "./auth";
import { mcpAuth, createMcpHandler } from "./mcp";

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
app.use("/api/mcp", mcpRouter);
app.post("/mcp", mcpAuth, createMcpHandler());

const webDist = path.join(__dirname, "../../web/dist");
app.use(express.static(webDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(webDist, "index.html"));
});

app.listen(PORT, () => {
  logger.info(`AppCore Web UI running at http://localhost:${PORT}`);
  scheduler.start();
  logger.info("Background scheduler started automatically");
});

function shutdown() {
  logger.info("Shutting down...");
  scheduler.stop();
  prisma.$disconnect().then(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
