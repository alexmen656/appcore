import { useApi, getActiveBundleId } from "../hooks/useApi";
import SigningSection from "./comps/settings/SigningSection";
import SnapshotEnvSection from "./comps/settings/SnapshotEnvSection";
import { RepoLinker } from "./Screenshots";
import type { AppItem, GitHubStatus } from "../types";

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function AppSettings({ addToast }: Props) {
  const { data: apps } = useApi<AppItem[]>("/apps", [], true);
  const { data: ghStatus } = useApi<GitHubStatus>("/github/status", [], true);

  const bundleId = getActiveBundleId();
  const activeApp = apps?.find((a) => a.bundleId === bundleId && a.isOwnApp);

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight text-[#111827] dark:text-[#e8eaf0] mb-5">
        App Settings
      </h1>

      {activeApp ? (
        <RepoLinker
          appId={activeApp.id}
          appName={activeApp.name}
          connected={!!ghStatus?.connected}
          addToast={addToast}
        />
      ) : (
        <div className="bg-white dark:bg-[#1c2028] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-2xl p-5 mb-5 text-sm text-[#9ca3af] dark:text-[#5c6478]">
          No app selected. Choose an app from the sidebar to link a GitHub repo.
        </div>
      )}

      {activeApp && <SigningSection appId={activeApp.id} addToast={addToast} />}
      {activeApp && (
        <SnapshotEnvSection appId={activeApp.id} addToast={addToast} />
      )}
    </div>
  );
}
