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
type FontCandidate = {
  test: RegExp;
  paths: string[];
};

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

interface FramefileSection {
  background?: string;
  padding: number;
  show_complete_frame: boolean;
  stack_title: boolean;
  title_below_image: boolean;
  title: { text: string; color: string; font: string; font_size: number };
}

const BUNDLED_FRAMEIT_FONT = path.join(__dirname, "ArialRoundedBold.ttf");
const FRAMEIT_FONT_NAME = "FrameitTextFont";

const FONT_CANDIDATES: FontCandidate[] = [
  {
    test: /[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF]/u,
    paths: [
      "/System/Library/Fonts/SFIndia.ttc",
      "/System/Library/Fonts/Kohinoor.ttc",
      "/System/Library/Fonts/KohinoorGujarati.ttc",
      "/System/Library/Fonts/KohinoorTelugu.ttc",
      "/System/Library/Fonts/NotoSansKannada.ttc",
      "/System/Library/Fonts/NotoSansOriya.ttc",
      "/System/Library/Fonts/Supplemental/Devanagari Sangam MN.ttc",
      "/System/Library/Fonts/Supplemental/Tamil Sangam MN.ttc",
      "/System/Library/Fonts/Supplemental/Malayalam Sangam MN.ttc",
    ],
  },
  {
    test: /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u30FF]/u,
    paths: [
      "/System/Library/Fonts/STHeiti Medium.ttc",
      "/System/Library/Fonts/Hiragino Sans GB.ttc",
      "/System/Library/Fonts/CJKSymbolsFallback.ttc",
    ],
  },
  {
    test: /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/u,
    paths: ["/System/Library/Fonts/AppleSDGothicNeo.ttc"],
  },
  {
    test: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/u,
    paths: [
      "/System/Library/Fonts/SFArabicRounded.ttf",
      "/System/Library/Fonts/SFArabic.ttf",
      "/System/Library/Fonts/GeezaPro.ttc",
    ],
  },
  {
    test: /[\u0E00-\u0E7F]/u,
    paths: ["/System/Library/Fonts/Supplemental/Krungthep.ttf"],
  },
  {
    test: /[\u0590-\u05FF]/u,
    paths: ["/System/Library/Fonts/Supplemental/Raanana.ttc", "/System/Library/Fonts/ArialHB.ttc"],
  },
];

function pickFrameitFont(text: string): string {
  for (const candidate of FONT_CANDIDATES) {
    if (!candidate.test.test(text)) continue;
    const found = candidate.paths.find((fontPath) => fs.existsSync(fontPath));
    if (found) return found;
  }

  return BUNDLED_FRAMEIT_FONT;
}

function copyFrameitFont(sourcePath: string, targetDir: string): string {
  const ext = path.extname(sourcePath) || ".ttf";
  const localName = `${FRAMEIT_FONT_NAME}${ext}`;
  fs.copyFileSync(sourcePath, path.join(targetDir, localName));
  return `./${localName}`;
}

function buildTitleSection(
  title: string | undefined,
  subtitle: string | undefined,
  textColor: string,
  layoutMode: LayoutMode,
  font: string,
  background?: string,
): FramefileSection {
  return {
    ...(background ? { background } : {}),
    padding: 50,
    show_complete_frame: false,
    stack_title: false,
    title_below_image: layoutMode === "bottom",
    title: {
      text: title ?? subtitle ?? " ",
      color: textColor,
      font,
      font_size: 150,
    },
  };
}

frameitRouter.post("/frameit", async (req: Request, res: Response) => {
  const { images, options } = req.body as FrameitRequest;

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
  let tmpDirNoBg = "";

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

    await sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toFile(path.join(tmpDir, "background.jpg"));
    const fontSourcePath = pickFrameitFont(`${title ?? ""} ${subtitle ?? ""}`);
    const frameitFont = copyFrameitFont(fontSourcePath, tmpDir);

    const defaultSection = buildTitleSection(title, subtitle, textColor, layoutMode, frameitFont, "./background.jpg");

    fs.writeFileSync(
      path.join(tmpDir, "Framefile.json"),
      JSON.stringify({ device_frame_version: "latest", default: defaultSection, data: [] }, null, 2),
    );

    tmpDirNoBg = path.join(os.tmpdir(), `worker-frameit-nobg-${Date.now()}`);
    fs.mkdirSync(tmpDirNoBg, { recursive: true });

    for (const img of images) {
      const basename = img.filename.replace(/\.[^.]+$/, "");
      const src = path.join(tmpDir, basename + ".png");
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(tmpDirNoBg, basename + ".png"));
      }
    }
    
    const frameitFontNoBg = copyFrameitFont(fontSourcePath, tmpDirNoBg);
    const defaultSectionNoBg = buildTitleSection(title, subtitle, textColor, layoutMode, frameitFontNoBg);

    fs.writeFileSync(
      path.join(tmpDirNoBg, "Framefile.json"),
      JSON.stringify({ device_frame_version: "latest", default: defaultSectionNoBg, data: [] }, null, 2),
    );

    const fastlaneBin = await findFastlane();

    const runFrameit = async (dir: string) => {
      let output = "";
      try {
        const result = await execAsync(`${fastlaneBin} frameit 2>&1`, {
          cwd: dir,
          timeout: 300_000,
          env: {
            ...process.env,
            FASTLANE_DISABLE_COLORS: "1",
            LANG: "en_US.UTF-8",
            LC_ALL: "en_US.UTF-8",
            LC_CTYPE: "en_US.UTF-8",
          },
          maxBuffer: 10 * 1024 * 1024,
        });
        output = result.stdout ?? "";
      } catch (execErr) {
        const e = execErr as { stdout?: string; stderr?: string; code?: number };
        output = (e.stdout ?? "") + (e.stderr ?? "");
        const hasOutput = fs.readdirSync(dir).some((f) => f.endsWith("_framed.png"));
        if (!hasOutput) {
          throw new Error(`fastlane frameit failed (code ${e.code}).\n${output}`);
        }
      }
      return output;
    };

    const [combinedOutput] = await Promise.all([runFrameit(tmpDir), runFrameit(tmpDirNoBg)]);

    const framedFiles = fs.readdirSync(tmpDir).filter((f) => f.endsWith("_framed.png"));
    if (framedFiles.length === 0) {
      throw new Error(`frameit produced no output.\n${combinedOutput}`);
    }

    const gravity = layoutMode === "top" ? "north" : layoutMode === "bottom" ? "south" : "centre";

    const processFramedFiles = async (
      dir: string,
      files: string[],
    ): Promise<Array<{ filename: string; data: string }>> => {
      const result: Array<{ filename: string; data: string }> = [];
      for (const f of files) {
        const raw = await fs.promises.readFile(path.join(dir, f));
        const srcBase = f.replace(/_framed\.png$/, "");
        const dims = outputDims.get(srcBase) ?? { w: firstW, h: firstH };
        const finalBuf = await sharp(raw).resize(dims.w, dims.h, { fit: "cover", position: gravity }).png().toBuffer();
        result.push({ filename: srcBase + ".png", data: finalBuf.toString("base64") });
      }
      return result;
    };

    const noBgFiles = fs.readdirSync(tmpDirNoBg).filter((f) => f.endsWith("_framed.png"));
    const [framedImages, unframedImages] = await Promise.all([
      processFramedFiles(tmpDir, framedFiles),
      processFramedFiles(tmpDirNoBg, noBgFiles),
    ]);

    res.json({ ok: true, framedImages, unframedImages });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  } finally {
    for (const dir of [tmpDir, tmpDirNoBg].filter(Boolean)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
});
