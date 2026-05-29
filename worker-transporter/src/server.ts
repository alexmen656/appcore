import "dotenv/config";
import express from "express";
import os from "os";
import { workerAuth } from "./auth";
import { uploadBinaryRouter } from "./routes/upload-binary";

const app = express();
const PORT = Number(process.env.TRANSPORTER_WORKER_PORT ?? 3200);

app.use(express.json({ limit: "200mb" }));

app.get("/health", (_req, res) => {
  const transporterPath = process.env.ITMS_TRANSPORTER_PATH ?? "/usr/local/itms/itms/bin/iTMSTransporter";
  const { existsSync } = require("fs");
  const transporterFound = existsSync(transporterPath);

  res.json({
    ok: transporterFound,
    transporter: transporterFound ? transporterPath : null,
    error: transporterFound ? undefined : `iTMSTransporter not found at ${transporterPath}`,
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    uptime: process.uptime(),
  });
});

app.use("/worker", workerAuth, uploadBinaryRouter);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Transporter Worker running on port ${PORT}`);
  console.log(`   GET  /health                          - Health check (no auth)`);
  console.log(`   POST /worker/upload-binary            - Upload IPA via iTMSTransporter`);
  console.log(`   GET  /worker/upload-binary/:id/stream - SSE log stream`);

  if (!process.env.FASTLANE_WORKER_SECRET) {
    console.error("⚠️  WARNING: FASTLANE_WORKER_SECRET not set! All requests will be rejected.");
  }
});
