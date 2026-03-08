import { Router, Request, Response } from "express";
import { spawn, exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import sharp from "sharp";
import { findFastlane, patchUITestFiles } from "./fastlane-utils";
const execAsync = promisify(exec);

export const workerRouter = Router();

workerRouter.get("/health", async (_req: Request, res: Response) => {
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

interface DeliverRequest {
  locales: Record<
    string,
    {
      name: string;
      subtitle: string;
      keywords: string;
      description: string;
      whatsNew: string;
      promotionalText: string;
      supportUrl: string;
      marketingUrl: string;
    }
  >;
  apiKey: {
    key_id: string;
    issuer_id: string;
    key: string;
    in_house: boolean;
  };
  bundleId: string;
  action: "metadata" | "submit_for_review";
  copyright?: string;
}

workerRouter.post("/deliver", async (req: Request, res: Response) => {
  const body = req.body as DeliverRequest;
  const { locales, apiKey, bundleId, action, copyright } = body;

  if (!locales || !apiKey || !bundleId || !action) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const tmpDir = path.join(os.tmpdir(), `worker-deliver-${Date.now()}`);
  const metadataRoot = path.join(tmpDir, "metadata");
  const logs: string[] = [];
  const errors: string[] = [];

  try {
    logs.push("Writing metadata files...");
    for (const [locale, data] of Object.entries(locales)) {
      const localeDir = path.join(metadataRoot, locale);
      fs.mkdirSync(localeDir, { recursive: true });

      fs.writeFileSync(path.join(localeDir, "name.txt"), data.name);
      fs.writeFileSync(path.join(localeDir, "subtitle.txt"), data.subtitle);
      fs.writeFileSync(path.join(localeDir, "keywords.txt"), data.keywords);
      fs.writeFileSync(
        path.join(localeDir, "description.txt"),
        data.description,
      );
      fs.writeFileSync(
        path.join(localeDir, "release_notes.txt"),
        data.whatsNew,
      );
      fs.writeFileSync(
        path.join(localeDir, "promotional_text.txt"),
        data.promotionalText,
      );
      fs.writeFileSync(
        path.join(localeDir, "support_url.txt"),
        data.supportUrl,
      );
      fs.writeFileSync(
        path.join(localeDir, "marketing_url.txt"),
        data.marketingUrl,
      );
    }
    fs.writeFileSync(
      path.join(metadataRoot, "copyright.txt"),
      copyright ?? `© ${new Date().getFullYear()} Fringelo Group`,
    );
    logs.push(`Metadata written for ${Object.keys(locales).length} locale(s)`);

    // 2. Write API key JSON
    const apiKeyPath = path.join(tmpDir, "api_key.json");
    fs.writeFileSync(apiKeyPath, JSON.stringify(apiKey, null, 2));
    logs.push("API key file written");

    // 3. Find fastlane
    const fastlanePath = await findFastlane();
    logs.push(`Using fastlane at: ${fastlanePath}`);

    // 4. Build deliver args
    const args = [
      "--api_key_path",
      apiKeyPath,
      "--metadata_path",
      metadataRoot,
      "--app_identifier",
      bundleId,
      "--skip_screenshots",
      "--skip_binary_upload",
      "--force",
      "--precheck_include_in_app_purchases",
      "false",
    ];

    if (action === "metadata") {
      args.push("--skip_app_version_update");
      args.push("--submit_for_review", "false");
    } else if (action === "submit_for_review") {
      args.push("--submit_for_review");
    }

    logs.push(`Running: fastlane deliver ${args.join(" ")}`);

    // 5. Execute fastlane deliver
    await new Promise<void>((resolve, reject) => {
      const parts = fastlanePath.split(" ");
      const cmd = parts[0];
      const cmdArgs = [...parts.slice(1), "deliver", ...args];

      const proc = spawn(cmd, cmdArgs, {
        cwd: tmpDir,
        env: { ...process.env, FASTLANE_DISABLE_COLORS: "1" },
        stdio: ["pipe", "pipe", "pipe"],
      });

      proc.stdout?.on("data", (data: Buffer) => {
        const line = data.toString().trim();
        if (line) logs.push(line);
      });

      proc.stderr?.on("data", (data: Buffer) => {
        const line = data.toString().trim();
        if (line) logs.push(`[stderr] ${line}`);
      });

      proc.on("close", (code) => {
        if (code === 0) {
          logs.push("Fastlane deliver completed successfully.");
          resolve();
        } else {
          const errMsg = `Fastlane deliver exited with code ${code}`;
          errors.push(errMsg);
          logs.push(errMsg);
          reject(new Error(errMsg));
        }
      });

      proc.on("error", (err) => {
        errors.push(err.message);
        reject(err);
      });
    });

    res.json({ ok: true, logs, errors });
  } catch (err: any) {
    errors.push(err.message);
    res.json({ ok: false, logs, errors });
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});

interface SnapshotRequest {
  repoUrl: string;
  accessToken: string;
  branch?: string;
  appName: string;
  bundleId: string;
}

workerRouter.post("/snapshot", async (req: Request, res: Response) => {
  const body = req.body as SnapshotRequest;
  const { repoUrl, accessToken, branch, appName, bundleId } = body;

  if (!repoUrl || !accessToken) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const tmpDir = path.join(os.tmpdir(), `worker-snapshot-${Date.now()}`);
  const logs: string[] = [];
  const errors: string[] = [];

  try {
    // 1. Clone the repo
    fs.mkdirSync(tmpDir, { recursive: true });
    const cloneUrl = repoUrl.replace(
      "https://",
      `https://x-access-token:${accessToken}@`,
    );
    const branchArg = branch ? `--branch ${branch}` : "";
    logs.push(`Cloning repo${branch ? ` @${branch}` : ""} ...`);

    await execAsync(
      `git clone --depth 1 ${branchArg} "${cloneUrl}" "${tmpDir}"`,
      {
        timeout: 120_000,
      },
    );
    logs.push("Clone complete");

    // 2. Check for Snapfile / Fastfile
    const snapfilePath = path.join(tmpDir, "fastlane", "Snapfile");
    const fastfilePath = path.join(tmpDir, "fastlane", "Fastfile");
    const hasSnapfile = fs.existsSync(snapfilePath);
    const hasFastfile = fs.existsSync(fastfilePath);

    if (!hasSnapfile && !hasFastfile) {
      logs.push("No fastlane/Snapfile or Fastfile — creating default Snapfile");
      const fastlaneDir = path.join(tmpDir, "fastlane");
      fs.mkdirSync(fastlaneDir, { recursive: true });
      fs.writeFileSync(
        snapfilePath,
        [
          "# Auto-generated by AppCore Worker",
          `# App: ${appName} (${bundleId})`,
          "",
          "devices([",
          '  "iPhone 16 Pro Max",',
          '  "iPhone 16",',
          '  "iPad Pro 13-inch (M4)"',
          "])",
          "",
          'languages(["en-US"])',
          "",
          `scheme("${appName}")`,
          "",
          "clear_previous_screenshots(true)",
          'output_directory("./fastlane/screenshots")',
          "",
        ].join("\n"),
      );
    }

    // 3. Patch UITest files for Swift 6
    patchUITestFiles(tmpDir, (msg) => logs.push(msg));

    // 4. Run fastlane snapshot
    const fastlanePath = await findFastlane();
    logs.push(`Using fastlane: ${fastlanePath}`);
    logs.push("Running fastlane snapshot ...");

    try {
      const { stdout, stderr } = await execAsync(
        `${fastlanePath} snapshot 2>&1`,
        {
          cwd: tmpDir,
          timeout: 900_000,
          env: { ...process.env, FASTLANE_DISABLE_COLORS: "1" },
          maxBuffer: 10 * 1024 * 1024,
        },
      );
      if (stdout) logs.push(...stdout.split("\n").filter(Boolean));
      if (stderr)
        logs.push(
          ...stderr
            .split("\n")
            .filter(Boolean)
            .map((l) => `[stderr] ${l}`),
        );
    } catch (execErr: any) {
      if (execErr.stdout)
        logs.push(...execErr.stdout.split("\n").filter(Boolean));
      if (execErr.stderr)
        logs.push(...execErr.stderr.split("\n").filter(Boolean));
      throw new Error(
        `fastlane snapshot exited with code ${execErr.code ?? "unknown"}.`,
      );
    }

    logs.push("fastlane snapshot completed");

    // 5. Collect screenshots and encode as base64
    const screenshotsDir = path.join(tmpDir, "fastlane", "screenshots");
    const screenshots: Record<
      string,
      Array<{ filename: string; data: string }>
    > = {};

    if (fs.existsSync(screenshotsDir)) {
      const collectImages = (dir: string, locale: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            collectImages(full, entry.name);
          } else if (/\.(png|jpg|jpeg)$/i.test(entry.name)) {
            if (!screenshots[locale]) screenshots[locale] = [];
            const data = fs.readFileSync(full).toString("base64");
            screenshots[locale].push({ filename: entry.name, data });
          }
        }
      };
      collectImages(screenshotsDir, "default");
      const totalFiles = Object.values(screenshots).reduce(
        (n, a) => n + a.length,
        0,
      );
      logs.push(
        `Collected ${totalFiles} screenshot(s) across ${Object.keys(screenshots).length} locale(s)`,
      );
    } else {
      logs.push("No screenshots directory found after run");
    }

    res.json({ ok: true, logs, errors, screenshots });
  } catch (err: any) {
    errors.push(err.message);
    res.json({ ok: false, logs, errors, screenshots: {} });
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});

const SIZE_REMAP: Record<string, { w: number; h: number }> = {
  "2064x2752": { w: 2048, h: 2732 }, // iPad Pro 13" M4 → 12.9" 4th
};

interface FrameitRequest {
  images: Array<{ filename: string; data: string }>;
  options: {
    subtitle?: string;
    title?: string;
    bgColor1?: string;
    bgColor2?: string;
    textColor?: string;
  };
}

workerRouter.post("/frameit", async (req: Request, res: Response) => {
  const body = req.body as FrameitRequest;
  const { images, options } = body;

  if (!images || images.length === 0) {
    res.status(400).json({ error: "No images provided" });
    return;
  }

  const {
    subtitle,
    title,
    bgColor1 = "#667eea",
    bgColor2 = "#764ba2",
    textColor = "#ffffff",
  } = options || {};

  const effectiveTitle = title || subtitle || " ";
  const tmpDir = path.join(os.tmpdir(), `worker-frameit-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    let firstW = 1290;
    let firstH = 2796;

    // 1. Write input images to temp dir, resizing if needed
    for (const img of images) {
      const buf = Buffer.from(img.data, "base64");
      const tmpPath = path.join(
        tmpDir,
        img.filename.replace(/\.[^.]+$/, ".png"),
      );
      const meta = await sharp(buf).metadata();
      const remapKey = `${meta.width}x${meta.height}`;
      const remap = SIZE_REMAP[remapKey];

      let pipeline = sharp(buf);
      if (remap) {
        pipeline = pipeline.resize(remap.w, remap.h, { fit: "fill" });
        firstW = remap.w;
        firstH = remap.h;
      } else {
        firstW = meta.width ?? firstW;
        firstH = meta.height ?? firstH;
      }
      await pipeline.png().toFile(tmpPath);
    }

    // 2. Generate gradient background
    const bgPath = path.join(tmpDir, "background.jpg");
    const bgW = firstW * 2;
    const bgH = firstH * 2;
    const svg = `<svg width="${bgW}" height="${bgH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stop-color="${bgColor1}"/>
          <stop offset="100%" stop-color="${bgColor2}"/>
        </linearGradient>
      </defs>
      <rect width="${bgW}" height="${bgH}" fill="url(#bg)"/>
    </svg>`;
    await sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toFile(bgPath);

    // 3. Write Framefile.json
    const defaultSection: Record<string, any> = {
      background: "./background.jpg",
      padding: 50,
      show_complete_frame: false,
      stack_title: false,
      title_below_image: false,
      title: { text: effectiveTitle, color: textColor },
    };
    if (subtitle) {
      defaultSection.keyword = { text: subtitle, color: textColor };
    }

    fs.writeFileSync(
      path.join(tmpDir, "Framefile.json"),
      JSON.stringify(
        { device_frame_version: "latest", default: defaultSection, data: [] },
        null,
        2,
      ),
    );

    // 4. Run fastlane frameit
    const fastlaneBin = await findFastlane();
    let combinedOutput = "";
    try {
      const result = await execAsync(`${fastlaneBin} frameit 2>&1`, {
        cwd: tmpDir,
        timeout: 300_000,
        env: { ...process.env, FASTLANE_DISABLE_COLORS: "1" },
        maxBuffer: 10 * 1024 * 1024,
      });
      combinedOutput = result.stdout ?? "";
    } catch (execErr: any) {
      combinedOutput = (execErr.stdout ?? "") + (execErr.stderr ?? "");
      const hasOutput = fs
        .readdirSync(tmpDir)
        .some((f) => f.endsWith("_framed.png"));
      if (!hasOutput) {
        throw new Error(
          `fastlane frameit failed (code ${execErr.code}).\n${combinedOutput}`,
        );
      }
    }

    // 5. Collect framed images
    const framedFiles = fs
      .readdirSync(tmpDir)
      .filter((f) => f.endsWith("_framed.png"));
    if (framedFiles.length === 0) {
      throw new Error(`frameit produced no output.\n${combinedOutput}`);
    }

    const framedImages: Array<{ filename: string; data: string }> = [];
    for (const f of framedFiles) {
      const data = fs.readFileSync(path.join(tmpDir, f)).toString("base64");
      framedImages.push({ filename: f, data });
    }

    res.json({ ok: true, framedImages });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});
