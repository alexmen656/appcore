import sharp from "sharp";
import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface FrameOptions {
  subtitle?: string;
  title?: string;
  bgColor1?: string;
  bgColor2?: string;
  textColor?: string;
}

// ─── Resolution remapping ─────────────────────────────────────────────────────
// Key format: "WxH"
// Value: target { w, h } that frameit accepts
const SIZE_REMAP: Record<string, { w: number; h: number }> = {
  // iPhone 16 Pro Max (6.9") → iPhone 14 Pro Max (6.7")
  "1320x2868": { w: 1290, h: 2796 },
  // iPhone 16 Pro (6.3") → iPhone 14 Pro (6.1")
  "1206x2622": { w: 1179, h: 2556 },
  // iPad Pro 13-inch M4 → iPad Pro 12.9" 4th gen
  "2064x2752": { w: 2048, h: 2732 },
  // iPhone 15 Plus / 16 Plus
  "1290x2796": { w: 1290, h: 2796 },
};

export async function frameWithFastlane(
  inputDir: string,
  outputDir: string,
  options: FrameOptions,
): Promise<string[]> {
  const {
    subtitle,
    title,
    bgColor1 = "#667eea",
    bgColor2 = "#764ba2",
    textColor = "#ffffff",
  } = options;

  const effectiveTitle = title || subtitle || " ";

  const tmpDir = path.join(os.tmpdir(), `appcore-frameit-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // ── Collect source images ────────────────────────────────────────────────
    const srcFiles = fs
      .readdirSync(inputDir)
      .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
      .map((f) => path.join(inputDir, f))
      .filter((f) => fs.statSync(f).isFile());

    if (srcFiles.length === 0) {
      throw new Error("No images found in input directory");
    }

    let firstW = 1290;
    let firstH = 2796;

    for (const src of srcFiles) {
      const baseName = path.basename(src, path.extname(src));
      const tmpPath = path.join(tmpDir, `${baseName}.png`);

      const meta = await sharp(src).metadata();
      const remapKey = `${meta.width}x${meta.height}`;
      const remap = SIZE_REMAP[remapKey];

      let pipeline = sharp(src);
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

    // ── Generate gradient background ─────────────────────────────────────────
    const bgPath = path.join(tmpDir, "background.jpg");
    await generateGradientBg(
      bgPath,
      firstW * 2,
      firstH * 2,
      bgColor1,
      bgColor2,
    );

    // ── Framefile.json ────────────────────────────────────────────────────────
    const defaultSection: Record<string, any> = {
      background: "./background.jpg",
      padding: 50,
      show_complete_frame: false,
      stack_title: false,
      title_below_image: false,
      title: {
        text: effectiveTitle,
        color: textColor,
      },
    };
    if (subtitle) {
      defaultSection.keyword = {
        text: subtitle,
        color: textColor,
      };
    }

    fs.writeFileSync(
      path.join(tmpDir, "Framefile.json"),
      JSON.stringify(
        { device_frame_version: "latest", default: defaultSection, data: [] },
        null,
        2,
      ),
    );

    // ── Run fastlane frameit ──────────────────────────────────────────────────
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

    // ── Copy framed output ───────────────────────────────────────────────────
    fs.mkdirSync(outputDir, { recursive: true });
    const framedFiles = fs
      .readdirSync(tmpDir)
      .filter((f) => f.endsWith("_framed.png"));

    if (framedFiles.length === 0) {
      throw new Error(`frameit produced no output.\n${combinedOutput}`);
    }

    const outputPaths: string[] = [];
    for (const f of framedFiles) {
      const dest = path.join(outputDir, f);
      fs.copyFileSync(path.join(tmpDir, f), dest);
      outputPaths.push(dest);
    }
    return outputPaths;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

export function findImageFiles(dir: string, results: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "framed") {
      findImageFiles(full, results);
    } else if (/\.(png|jpg|jpeg)$/i.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function generateGradientBg(
  outPath: string,
  w: number,
  h: number,
  c1: string,
  c2: string,
): Promise<void> {
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
  </svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toFile(outPath);
}

export async function findFastlane(): Promise<string> {
  const candidates = [
    "fastlane",
    "/usr/local/bin/fastlane",
    `${os.homedir()}/.fastlane/bin/fastlane`,
  ];
  for (const c of candidates) {
    try {
      await execAsync(`${c} --version`);
      return c;
    } catch {
      // next
    }
  }
  try {
    await execAsync("bundle exec fastlane --version");
    return "bundle exec fastlane";
  } catch {
    // not available
  }
  throw new Error(
    "Fastlane not found. Install via `brew install fastlane` or `gem install fastlane`.",
  );
}
