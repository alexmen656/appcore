import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import os from "os";
import sharp from "sharp";
import { findFastlane } from "../fastlane-utils";
import { execAsync } from "./shared";

export const frameitRouter = Router();

const SIZE_REMAP: Record<string, { w: number; h: number }> = {
  "2064x2752": { w: 2048, h: 2732 }, // iPad Pro 13" M4 → 12.9" 4th
};

type LayoutMode = "center" | "top" | "bottom";

interface FrameitRequest {
  images: Array<{ filename: string; data: string }>;
  options: {
    subtitle?: string;
    title?: string;
    bgColor1?: string;
    bgColor2?: string;
    textColor?: string;
    layoutMode?: LayoutMode | "random";
  };
}

frameitRouter.post("/frameit", async (req: Request, res: Response) => {
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
    layoutMode: layoutModeInput,
  } = options || {};

  const LAYOUT_MODES: LayoutMode[] = ["center", "top", "bottom"];
  const layoutMode: LayoutMode =
    !layoutModeInput || layoutModeInput === "random"
      ? LAYOUT_MODES[Math.floor(Math.random() * LAYOUT_MODES.length)]
      : layoutModeInput;

  const tmpDir = path.join(os.tmpdir(), `worker-frameit-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    let firstW = 1290;
    let firstH = 2796;
    const outputDims = new Map<string, { w: number; h: number }>();

    for (const img of images) {
      const buf = Buffer.from(img.data, "base64");
      const basename = img.filename.replace(/\.[^.]+$/, "");
      const tmpPath = path.join(tmpDir, basename + ".png");
      const meta = await sharp(buf).metadata();
      const remapKey = `${meta.width}x${meta.height}`;
      const remap = SIZE_REMAP[remapKey];

      outputDims.set(basename, {
        w: meta.width ?? firstW,
        h: meta.height ?? firstH,
      });

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

    fs.copyFileSync(
      "ArialRoundedBold.ttf",
      path.join(tmpDir, "ArialRoundedBold.ttf"),
    );

    const defaultSection: Record<string, any> = {
      background: "./background.jpg",
      padding: 50,
      show_complete_frame: false,
      stack_title: false,
      title_below_image: layoutMode === "bottom",
    };

    const titleStyle = {
      color: textColor,
      font: "./ArialRoundedBold.ttf",
      font_size: 150,
    };

    if (title) {
      defaultSection.title = { text: title, ...titleStyle };
    }
    if (subtitle) {
      defaultSection.title = { text: subtitle, ...titleStyle };
    }
    if (!title && !subtitle) {
      defaultSection.title = { text: " ", ...titleStyle };
    }

    fs.writeFileSync(
      path.join(tmpDir, "Framefile.json"),
      JSON.stringify(
        { device_frame_version: "latest", default: defaultSection, data: [] },
        null,
        2,
      ),
    );

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

    const framedFiles = fs
      .readdirSync(tmpDir)
      .filter((f) => f.endsWith("_framed.png"));
    if (framedFiles.length === 0) {
      throw new Error(`frameit produced no output.\n${combinedOutput}`);
    }

    const framedImages: Array<{ filename: string; data: string }> = [];
    for (const f of framedFiles) {
      const raw = fs.readFileSync(path.join(tmpDir, f));
      const img = sharp(raw);

      const srcBase = f.replace(/_framed\.png$/, "");
      const dims = outputDims.get(srcBase) ?? { w: firstW, h: firstH };

      const gravity =
        layoutMode === "top"
          ? "north"
          : layoutMode === "bottom"
            ? "south"
            : "centre";

      const finalBuf = await img
        .resize(dims.w, dims.h, { fit: "cover", position: gravity })
        .png()
        .toBuffer();

      framedImages.push({ filename: f, data: finalBuf.toString("base64") });
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
