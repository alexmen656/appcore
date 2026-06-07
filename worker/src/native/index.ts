import { type LogFn } from "./command";
import { hasPackageJson, installNodeModules } from "./node";
import { isCapacitorProject, syncCapacitor } from "./capacitor";
import { hasPodfile, installPods } from "./cocoapods";

export async function prepareNativeDeps(repoDir: string, workDir: string, log: LogFn): Promise<void> {
  if (hasPackageJson(repoDir)) {
    await installNodeModules(repoDir, log);

    if (isCapacitorProject(repoDir)) {
      await syncCapacitor(repoDir, log);
      return;
    }
  }

  if (hasPodfile(workDir)) {
    await installPods(workDir, log);
  }
}

export type { LogFn } from "./command";

export { hasPodfile, installPods } from "./cocoapods";
export { isCapacitorProject } from "./capacitor";
