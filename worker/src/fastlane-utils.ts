import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
let cachedFastlanePath: string | undefined;

export async function findFastlane(): Promise<string> {
  if (cachedFastlanePath) return cachedFastlanePath;

  for (const cmd of ["fastlane", "bundle exec fastlane"]) {
    try {
      await execAsync(`${cmd} --version`);
      cachedFastlanePath = cmd;
      return cmd;
    } catch {
      /* try next */
    }
  }

  throw new Error(
    "Fastlane not found. Install via `brew install fastlane` or `gem install fastlane`.",
  );
}
