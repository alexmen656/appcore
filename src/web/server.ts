import express from "express";
import cors from "cors";
import path from "path";
import { logger, env } from "../config";
import { appsRouter } from "./api/apps";
import { suggestionsRouter } from "./api/suggestions";
import { keywordsRouter } from "./api/keywords";
import { dashboardRouter } from "./api/dashboard";
import { actionsRouter } from "./api/actions";

const app = express();
const PORT = process.env.WEB_PORT ?? 3100;

app.use(cors());
app.use(express.json());

// ─── API Routes ─────────────────────────────────────────────────────────
app.use("/api/dashboard", dashboardRouter);
app.use("/api/apps", appsRouter);
app.use("/api/suggestions", suggestionsRouter);
app.use("/api/keywords", keywordsRouter);
app.use("/api/actions", actionsRouter);

// ─── Serve built frontend in production ─────────────────────────────────
const webDist = path.join(__dirname, "../../web/dist");
app.use(express.static(webDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(webDist, "index.html"));
});

app.listen(PORT, () => {
  logger.info(`AppCore Web UI running at http://localhost:${PORT}`);
});
