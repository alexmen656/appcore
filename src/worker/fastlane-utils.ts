import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

export async function findFastlane(): Promise<string> {
  try {
    if (await execAsync(`fastlane --version`)) {
      return "fastlane";
    }
  } catch {
    // next
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
