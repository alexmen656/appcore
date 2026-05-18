import { Router, Request, Response } from "express";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { findFastlane } from "../fastlane-utils";

export const deliverRouter = Router();

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
  screenshots?: Record<string, Array<{ filename: string; data: string }>>;
  screenshotFallback?: string;
  ipa?: string;
}

deliverRouter.post("/deliver", async (req: Request, res: Response) => {
  const body = req.body as DeliverRequest;
  const { locales, apiKey, bundleId, action, copyright, screenshots, screenshotFallback, ipa } = body;

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
      for (const [file, content] of Object.entries({
        "name.txt": data.name,
        "subtitle.txt": data.subtitle,
        "keywords.txt": data.keywords,
        "description.txt": data.description,
        "release_notes.txt": data.whatsNew,
        "promotional_text.txt": data.promotionalText,
        "support_url.txt": data.supportUrl,
        "marketing_url.txt": data.marketingUrl,
      }))
        fs.writeFileSync(path.join(localeDir, file), content);
    }
    fs.writeFileSync(
      path.join(metadataRoot, "copyright.txt"),
      copyright ?? `© ${new Date().getFullYear()} Fringelo Group`,
    );
    logs.push(`Metadata written for ${Object.keys(locales).length} locale(s)`);

    const screenshotsRoot = path.join(tmpDir, "screenshots");
    const hasScreenshots = screenshots && Object.keys(screenshots).length > 0;
    if (hasScreenshots) {
      let totalScreenshots = 0;
      const fallbackImages = screenshotFallback ? screenshots![screenshotFallback] : undefined;
      for (const locale of Object.keys(locales)) {
        const images = screenshots![locale] ?? fallbackImages;
        if (!images || images.length === 0) continue;
        const localeDir = path.join(screenshotsRoot, locale);
        fs.mkdirSync(localeDir, { recursive: true });
        for (const img of images) {
          fs.writeFileSync(path.join(localeDir, img.filename), Buffer.from(img.data, "base64"));
          totalScreenshots++;
        }
      }
      logs.push(
        `Screenshots written: ${totalScreenshots} image(s) across ${Object.keys(locales).length} locale(s)`,
      );
    }

    const apiKeyPath = path.join(tmpDir, "api_key.json");
    fs.writeFileSync(apiKeyPath, JSON.stringify(apiKey, null, 2));
    logs.push("API key file written");

    let resolvedIpaPath: string | null = null;
    if (ipa) {
      resolvedIpaPath = path.join(tmpDir, `app.ipa`);
      fs.writeFileSync(resolvedIpaPath, Buffer.from(ipa, "base64"));
      logs.push("IPA written to temp directory.");
    }

    const fastlanePath = await findFastlane();
    logs.push(`Using fastlane at: ${fastlanePath}`);

    const args = [
      "--api_key_path",
      apiKeyPath,
      "--metadata_path",
      metadataRoot,
      "--app_identifier",
      bundleId,
      "--force",
      "--precheck_include_in_app_purchases",
      "false",
    ];

    if (resolvedIpaPath) {
      args.push("--ipa", resolvedIpaPath);
    } else {
      args.push("--skip_binary_upload");
    }

    if (hasScreenshots) {
      args.push("--screenshots_path", screenshotsRoot);
      args.push("--overwrite_screenshots");
    } else {
      args.push("--skip_screenshots");
    }

    if (action === "metadata") {
      args.push("--skip_app_version_update");
      args.push("--submit_for_review", "false");
    } else if (action === "submit_for_review") {
      args.push("--submit_for_review");
    }

    logs.push(`Running: fastlane deliver (screenshots: ${hasScreenshots ? "yes" : "skipped"})`);

    await new Promise<void>((resolve, reject) => {
      const parts = fastlanePath.split(" ");
      const cmd = parts[0];
      const cmdArgs = [...parts.slice(1), "deliver", ...args];

      const proc = spawn(cmd, cmdArgs, {
        cwd: tmpDir,
        env: { ...process.env, FASTLANE_DISABLE_COLORS: "1", LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8" },
        stdio: ["pipe", "pipe", "pipe"],
      });

      const hardTimeout = setTimeout(
        () => {
          proc.kill();
          reject(new Error("fastlane deliver timed out after 30 minutes"));
        },
        30 * 60 * 1000,
      );

      proc.stdout?.on("data", (data: Buffer) => {
        const line = data.toString().trim();
        if (line) logs.push(line);
      });

      proc.stderr?.on("data", (data: Buffer) => {
        const line = data.toString().trim();
        if (line) logs.push(`[stderr] ${line}`);
      });

      proc.on("close", (code) => {
        clearTimeout(hardTimeout);
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
        clearTimeout(hardTimeout);
        errors.push(err.message);
        reject(err);
      });
    });

    res.json({ ok: true, logs, errors });
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    res.json({ ok: false, logs, errors });
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});
