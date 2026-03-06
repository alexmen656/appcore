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

export function patchUITestFiles(
  repoDir: string,
  log: (msg: string) => void,
): void {
  const findSwift = (dir: string, results: string[] = []): string[] => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        findSwift(full, results);
      } else if (entry.isFile() && entry.name.endsWith(".swift")) {
        results.push(full);
      }
    }
    return results;
  };

  const swiftFiles = findSwift(repoDir);
  for (const file of swiftFiles) {
    const src = fs.readFileSync(file, "utf8");
    if (!src.includes("setupSnapshot(")) continue;

    const patched = src.replace(
      /^(?!.*@MainActor\b)([ \t]*)((?:final\s+)?class\s+\w+\s*:\s*XCTestCase)/gm,
      (_match, indent, classDecl) =>
        `${indent}@MainActor\n${indent}${classDecl}`,
    );

    if (patched !== src) {
      fs.writeFileSync(file, patched, "utf8");
      log(
        `Patched @MainActor onto UITest class in ${path.relative(repoDir, file)}`,
      );
    }
  }
}
