import fs from "fs";
import path from "path";
import { workerClient } from "./worker-client";

export interface FrameOptions {
  subtitle?: string;
  title?: string;
  bgColor1?: string;
  bgColor2?: string;
  textColor?: string;
}

export async function frameWithFastlane(
  inputDir: string,
  outputDir: string,
  options: FrameOptions,
  unframedOutputDir?: string,
): Promise<string[]> {
  const srcFiles = fs
    .readdirSync(inputDir)
    .filter((f) => /\.(png)$/i.test(f))
    .map((f) => path.join(inputDir, f))
    .filter((f) => fs.statSync(f).isFile());

  if (srcFiles.length === 0) {
    throw new Error("No images found in input directory");
  }

  const images = srcFiles.map((f) => ({
    filename: path.basename(f),
    data: fs.readFileSync(f).toString("base64"),
  }));

  const result = await workerClient.frameit({ images, options });

  if (!result.ok) {
    throw new Error(`Worker frameit failed: ${result.error ?? "unknown error"}`);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const outputPaths: string[] = [];

  for (const img of result.framedImages) {
    const dest = path.join(outputDir, img.filename);
    fs.writeFileSync(dest, Buffer.from(img.data, "base64"));
    outputPaths.push(dest);
  }

  if (unframedOutputDir && result.unframedImages && result.unframedImages.length > 0) {
    fs.mkdirSync(unframedOutputDir, { recursive: true });
    for (const img of result.unframedImages) {
      fs.writeFileSync(path.join(unframedOutputDir, img.filename), Buffer.from(img.data, "base64"));
    }
  }

  return outputPaths;
}
