import { Router, Request, Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";
import { findFastlane } from "../fastlane-utils";

const execAsync = promisify(exec);

export const healthRouter = Router();

healthRouter.get("/health", async (_req: Request, res: Response) => {
  try {
    const fastlanePath = await findFastlane();
    const { stdout } = await execAsync(`${fastlanePath} --version`);
    res.json({
      ok: true,
      fastlaneVersion: stdout.trim(),
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      uptime: process.uptime(),
    });
  } catch (err: any) {
    res.json({
      ok: false,
      error: err.message,
      hostname: os.hostname(),
    });
  }
});
