import express from "express";
import cors from "cors";
import path from "path";
import { logger, env } from "../config";
import { appsRouter } from "./api/apps";
import { suggestionsRouter } from "./api/suggestions";
import { keywordsRouter } from "./api/keywords";
import { dashboardRouter } from "./api/dashboard";
import { actionsRouter } from "./api/actions";
import { authRouter } from "./api/auth";
import { settingsRouter } from "./api/settings";
import { requireAuth } from "./auth";

const app = express();
const PORT = process.env.WEB_PORT ?? 3100;

app.use(cors());
app.use(express.json());

// ─── Auth Routes (public) ────────────────────────────────────────────────
app.use("/api/auth", authRouter);

// ─── Protected API Routes ────────────────────────────────────────────────
app.use("/api/dashboard", requireAuth, dashboardRouter);
app.use("/api/apps", requireAuth, appsRouter);
app.use("/api/suggestions", requireAuth, suggestionsRouter);
app.use("/api/keywords", requireAuth, keywordsRouter);
app.use("/api/actions", requireAuth, actionsRouter);
app.use("/api/settings", settingsRouter);

// ─── Serve built frontend in production ─────────────────────────────────
const webDist = path.join(__dirname, "../../web/dist");
app.use(express.static(webDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(webDist, "index.html"));
});

app.listen(PORT, () => {
  logger.info(`AppCore Web UI running at http://localhost:${PORT}`);
});
