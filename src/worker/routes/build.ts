import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import os from "os";
import { findFastlane } from "../fastlane-utils";
import { execAsync, buildWithGym } from "./shared";

function findConfigFile(dir: string): string | null {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "fastlane") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findConfigFile(full);
      if (found) return found;
    } else if (entry.name === "config.json") {
      return full;
    }
  }
  return null;
}

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

    let resolvedScheme = gymScheme;
    const configFile = findConfigFile(tmpDir);
    if (configFile) {
      try {
        const cfg = JSON.parse(fs.readFileSync(configFile, "utf8"))?._config ?? {};
        if (cfg.scheme) {
          resolvedScheme = cfg.scheme;
          logs.push(`[config] Using scheme from config.json: ${resolvedScheme}`);
        }
      } catch {
        logs.push("[config] Warning: could not parse config.json");
      }
    }

    const fastlanePath = await findFastlane();
    logs.push(`Using fastlane: ${fastlanePath}`);

    const ipaPath = await buildWithGym(
      tmpDir,
      appName,
      bundleId,
      resolvedScheme,
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
