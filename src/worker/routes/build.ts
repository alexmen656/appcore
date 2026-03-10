import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import os from "os";
import { findFastlane } from "../fastlane-utils";
import { execAsync, buildWithGym } from "./shared";

export const buildRouter = Router();

interface BuildRequest {
  repoUrl: string;
  accessToken: string;
  branch?: string;
  appName: string;
  bundleId: string;
  gymScheme?: string;
  exportMethod?: string;
}

buildRouter.post("/build", async (req: Request, res: Response) => {
  const body = req.body as BuildRequest;
  const {
    repoUrl,
    accessToken,
    branch,
    appName,
    bundleId,
    gymScheme,
    exportMethod = "app-store",
  } = body;

  if (!repoUrl || !accessToken || !bundleId) {
    res.status(400).json({
      error: "Missing required fields: repoUrl, accessToken, bundleId",
    });
    return;
  }

  const tmpDir = path.join(os.tmpdir(), `worker-build-${Date.now()}`);
  const logs: string[] = [];
  const errors: string[] = [];

  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    const cloneUrl = repoUrl.replace(
      "https://",
      `https://x-access-token:${accessToken}@`,
    );
    const branchArg = branch ? `--branch ${branch}` : "";
    logs.push(`Cloning repo${branch ? ` @${branch}` : ""} ...`);
    await execAsync(
      `git clone --depth 1 ${branchArg} "${cloneUrl}" "${tmpDir}"`,
      { timeout: 120_000 },
    );
    logs.push("Clone complete");

    const fastlanePath = await findFastlane();
    logs.push(`Using fastlane: ${fastlanePath}`);

    const ipaPath = await buildWithGym(
      tmpDir,
      appName,
      bundleId,
      gymScheme,
      exportMethod,
      fastlanePath,
      logs,
    );

    res.json({ ok: true, logs, errors, ipaBuilt: true, ipaPath });
  } catch (err: any) {
    errors.push(err.message);
    res.json({ ok: false, logs, errors, ipaBuilt: false });
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});
