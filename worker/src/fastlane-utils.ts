import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const PATH = process.env.FASTLANE_PATH ?? "/opt/homebrew/bin/fastlane";

export async function findFastlane(): Promise<string> {
  try {
    await execAsync(`${PATH} --version`);
    return PATH;
  } catch {
    throw new Error(
      `Fastlane not found at ${PATH}. Override with FASTLANE_PATH env var.`,
    );
  }
}
