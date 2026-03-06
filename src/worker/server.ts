/**
 * Fastlane Worker Server
 *
 * Standalone Express server that runs on the Mac Mini at home.
 * Receives Fastlane tasks from the main AppCore server over WireGuard VPN.
 *
 * Start with: npm run worker
 * Env vars:
 *   FASTLANE_WORKER_SECRET - Shared secret for authentication (required)
 *   FASTLANE_WORKER_PORT   - Port to listen on (default: 3200)
 */
import express from "express";
import { workerAuth } from "./auth";
import { workerRouter } from "./routes";

const app = express();
const PORT = process.env.FASTLANE_WORKER_PORT ?? 3200;

// Allow large payloads (screenshots as base64)
app.use(express.json({ limit: "500mb" }));

// Health check is unauthenticated (for monitoring)
app.get("/health", async (_req, res) => {
  const { findFastlane } = await import("./fastlane-utils");
  try {
    const fp = await findFastlane();
    res.json({ ok: true, fastlane: fp });
  } catch {
    res.json({ ok: false, error: "Fastlane not found" });
  }
});

// All /worker/* routes require authentication
app.use("/worker", workerAuth, workerRouter);

app.listen(PORT, () => {
  console.log(`🔧 Fastlane Worker running on port ${PORT}`);
  console.log(`   Endpoints:`);
  console.log(`     GET  /health           - Health check (no auth)`);
  console.log(`     GET  /worker/health    - Detailed health (auth required)`);
  console.log(`     POST /worker/deliver   - Run fastlane deliver`);
  console.log(`     POST /worker/snapshot  - Run fastlane snapshot`);
  console.log(`     POST /worker/frameit   - Run fastlane frameit`);

  if (!process.env.FASTLANE_WORKER_SECRET) {
    console.error("⚠️  WARNING: FASTLANE_WORKER_SECRET not set! All authenticated requests will be rejected.");
  }
});
