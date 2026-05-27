import { Router, Request, Response } from "express";
import { spawn } from "child_process";
import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import os from "os";

export const uploadBinaryRouter = Router();

interface JobState {
  logs: string[];
  result: { ok: boolean; logs: string[]; errors: string[] } | null;
  emitter: EventEmitter;
}

const activeJobs = new Map<string, JobState>();

function createJob(runId: string) {
  const state: JobState = { logs: [], result: null, emitter: new EventEmitter() };
  state.emitter.setMaxListeners(10);
  activeJobs.set(runId, state);
  setTimeout(() => activeJobs.delete(runId), 60 * 60 * 1000).unref();
  return {
    log(line: string) {
      state.logs.push(line);
      state.emitter.emit("line", line);
    },
    finish(result: JobState["result"]) {
      state.result = result;
      state.emitter.emit("result", result);
    },
  };
}

interface UploadBinaryRequest {
  ipaUrl: string;
  keyId: string;
  issuerId: string;
  privateKey: string;
}

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? require("https") : require("http");
    const file = fs.createWriteStream(destPath);
    proto.get(url, (res: any) => {
      if (res.statusCode !== 200) {
        reject(new Error(`IPA download failed: HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve()));
      file.on("error", reject);
    }).on("error", reject);
  });
}

function normalizeP8Key(raw: string): string {
  const stripped = raw.replace(
    /-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|-----BEGIN EC PRIVATE KEY-----|-----END EC PRIVATE KEY-----|\s/g,
    "",
  );
  return `-----BEGIN PRIVATE KEY-----\n${stripped.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----\n`;
}

async function resolveITMSTransporter(): Promise<string> {
  const candidates = [
    process.env.ITMS_TRANSPORTER_PATH,
    "/Applications/Transporter.app/Contents/itms/bin/iTMSTransporter",
    "/usr/local/itms/bin/iTMSTransporter",
    "/Applications/Xcode.app/Contents/Developer/usr/bin/iTMSTransporter",
  ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  throw new Error("iTMSTransporter not found. Install Apple Transporter.");
}

uploadBinaryRouter.post("/upload-binary", async (req: Request, res: Response) => {
  const { ipaUrl, keyId, issuerId, privateKey } = req.body as UploadBinaryRequest;

  if (!ipaUrl || !keyId || !issuerId || !privateKey) {
    res.status(400).json({ error: "Missing required fields: ipaUrl, keyId, issuerId, privateKey" });
    return;
  }

  const runId = String(Date.now());
  const job = createJob(runId);
  res.json({ ok: true, runId });

  const tmpDir = path.join(os.tmpdir(), `worker-binary-${runId}`);
  const privateKeyDir = path.join(os.homedir(), ".appstoreconnect", "private_keys");
  const privateKeyPath = path.join(privateKeyDir, `AuthKey_${keyId}.p8`);
  const logs: string[] = [];
  const errors: string[] = [];
  let wroteKeyFile = false;

  const pushLog = (line: string) => {
    logs.push(line);
    job.log(line);
  };
  const pushError = (line: string) => {
    errors.push(line);
    job.log(`[error] ${line}`);
  };

  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    const ipaPath = path.join(tmpDir, "app.ipa");
    pushLog(`Downloading IPA from server...`);
    await downloadFile(ipaUrl, ipaPath);
    const ipaSizeBytes = fs.statSync(ipaPath).size;
    pushLog(`IPA downloaded (${Math.round(ipaSizeBytes / 1024 / 1024)} MB)`);

    if (!fs.existsSync(privateKeyPath)) {
      fs.mkdirSync(privateKeyDir, { recursive: true });
      fs.writeFileSync(privateKeyPath, normalizeP8Key(privateKey), { mode: 0o600 });
      wroteKeyFile = true;
      pushLog(`Wrote API private key to ${privateKeyPath}`);
    }

    const transporter = await resolveITMSTransporter();
    pushLog(`Using iTMSTransporter at: ${transporter}`);

    await new Promise<void>((resolve, reject) => {
      const args = ["-m", "upload", "-f", ipaPath, "-apiKey", keyId, "-apiIssuer", issuerId, "-v", "detailed"];
      pushLog(`Running: iTMSTransporter -m upload -f app.ipa`);

      const proc = spawn(transporter, args, {
        env: { ...process.env, LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8" },
        stdio: ["pipe", "pipe", "pipe"],
      });

      const hardTimeout = setTimeout(() => {
        proc.kill();
        reject(new Error("iTMSTransporter timed out after 30 minutes"));
      }, 30 * 60 * 1000);

      let stdoutBuffer = "";

      proc.stdout?.on("data", (data: Buffer) => {
        const line = data.toString().trim();
        if (line) {
          stdoutBuffer += line + "\n";
          pushLog(line);
        }
      });

      proc.stderr?.on("data", (data: Buffer) => {
        const line = data.toString().trim();
        if (line) pushLog(`[stderr] ${line}`);
      });

      proc.on("close", (code) => {
        clearTimeout(hardTimeout);
        if (code !== 0) {
          const msg = `iTMSTransporter exited with code ${code}`;
          pushError(msg);
          reject(new Error(msg));
          return;
        }
        // Exit code 0 can be a false positive — verify a package was actually uploaded
        if (!stdoutBuffer.includes("package(s) were uploaded successfully")) {
          const msg = "iTMSTransporter exited with code 0 but no packages were uploaded. IPA may be invalid or already processing.";
          pushError(msg);
          reject(new Error(msg));
          return;
        }
        pushLog("iTMSTransporter upload completed successfully.");
        resolve();
      });

      proc.on("error", (err) => {
        clearTimeout(hardTimeout);
        pushError(err.message);
        reject(err);
      });
    });

    job.finish({ ok: true, logs, errors });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    pushError(msg);
    job.finish({ ok: false, logs, errors });
  } finally {
    if (wroteKeyFile) {
      try { fs.unlinkSync(privateKeyPath); } catch { /* ignore */ }
    }
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

uploadBinaryRouter.get("/upload-binary/:runId/stream", (req: Request, res: Response) => {
  const job = activeJobs.get(req.params.runId as string);
  if (!job) {
    res.status(404).json({ error: "Unknown runId" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let closed = false;
  const send = (event: string, data: unknown) => {
    if (closed) return;
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { closed = true; }
  };

  for (const line of job.logs) send("log", line);

  if (job.result) {
    send("result", job.result);
    if (!closed) res.end();
    return;
  }

  const onLine = (line: string) => send("log", line);
  const onResult = (result: unknown) => { send("result", result); if (!closed) res.end(); };

  job.emitter.on("line", onLine);
  job.emitter.once("result", onResult);

  const heartbeat = setInterval(() => {
    if (!closed) {
      try { res.write(`: ping ${Date.now()}\n\n`); } catch { closed = true; clearInterval(heartbeat); }
    }
  }, 15_000);
  heartbeat.unref();

  req.on("close", () => {
    closed = true;
    clearInterval(heartbeat);
    job.emitter.off("line", onLine);
    job.emitter.off("result", onResult);
  });
});
