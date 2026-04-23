import { useApi, getActiveBundleId } from "../hooks/useApi";
import { ScreenshotJobsTable, BuildJobsTable } from "./Screenshots";
import type { AppItem } from "../types";

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function Actions({ addToast }: Props) {
  const { data: apps } = useApi<AppItem[]>("/apps", [], true);
  const bundleId = getActiveBundleId();
  const activeApp = apps?.find((a) => a.bundleId === bundleId && a.isOwnApp);

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-[#111827] dark:text-[#e8eaf0] mb-5">
        Logs
      </h1>

      {activeApp && (
        <>
          <BuildJobsTable appId={activeApp.id} addToast={addToast} />
          <ScreenshotJobsTable appId={activeApp.id} addToast={addToast} />
        </>
      )}
    </div>
  );
}
