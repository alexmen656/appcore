import { Router, Request, Response } from "express";
import { createSnapshotJob, getSnapshotJob } from "../log-bus";
import { SnapshotRunner } from "../services/SnapshotRunner";

export const snapshotRouter = Router();

interface SnapshotRequest {
  repoUrl: string;
  accessToken: string;
  branch?: string;
  appName: string;
  bundleId: string;
  iosDir?: string;
  exportMethod?: string;
  envVars?: Record<string, string>;
}

snapshotRouter.post("/snapshot", async (req: Request, res: Response) => {
  const { repoUrl, accessToken, branch, appName, iosDir, envVars } = req.body as SnapshotRequest;

  if (!repoUrl || !accessToken || !appName) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  if (!/^https:\/\/[^\s"'`\\;<>&|$(){}[\]]+$/.test(repoUrl)) {
    res.status(400).json({ error: "Invalid repository URL" });
    return;
  }

  if (branch && !/^[a-zA-Z0-9/_.-]+$/.test(branch)) {
    res.status(400).json({ error: "Invalid branch name" });
    return;
  }

  const runId = String(Date.now());
  const { emit: emitLog, finish } = createSnapshotJob(runId);

  res.json({ ok: true, runId });

  const runner = new SnapshotRunner(runId, { repoUrl, accessToken, branch, appName, iosDir, envVars }, emitLog, finish);
  runner.run().catch(() => {
    /* errors are captured inside SnapshotRunner */
  });
});

snapshotRouter.get("/snapshot/:runId/stream", (req: Request, res: Response) => {
  const job = getSnapshotJob(req.params.runId as string);
  if (!job) {
    res.status(404).json({ error: "Unknown runId" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  for (const line of job.logs) send("log", line);

  if (job.result) {
    send("result", job.result);
    res.end();
    return;
  }

  const onLine = (line: string) => send("log", line);
  const onResult = (result: unknown) => {
    send("result", result);
    res.end();
  };

  job.emitter.on("line", onLine);
  job.emitter.once("result", onResult);

  req.on("close", () => {
    job.emitter.off("line", onLine);
    job.emitter.off("result", onResult);
  });
});
