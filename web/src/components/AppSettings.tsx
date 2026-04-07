import { useState } from "react";
import {
  useApi,
  getActiveBundleId,
  apiDelete,
  setActiveBundleId,
} from "../hooks/useApi";
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

  const activeApp = apps?.find(
    (a) => a.bundleId === getActiveBundleId() && a.isOwnApp,
  );
  
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
      {activeApp && <DangerZone app={activeApp} addToast={addToast} />}
    </div>
  );
}

function DangerZone({
  app,
  addToast,
}: {
  app: AppItem;
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleDelete = async () => {
    if (confirmText !== app.bundleId) return;
    setDeleting(true);
    try {
      await apiDelete(`/apps/${app.id}`);
      setActiveBundleId(null);
      addToast(`"${app.name}" has been removed.`, "success");
    } catch (err: any) {
      addToast(err.message ?? "Failed to delete app", "error");
      setDeleting(false);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 p-5">
      <h2 className="text-[13px] font-bold uppercase tracking-widest text-red-500 dark:text-red-400 mb-1">
        Danger Zone
      </h2>
      <p className="text-[13px] text-[#6b7280] dark:text-[#8b93a5] mb-4">
        This app and all associated data (screenshots, builds, keywords,
        analyses) will be permanently deleted.
      </p>

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-2 px-4 py-[9px] rounded-xl text-[13px] font-semibold border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 bg-white dark:bg-[#1c2028] hover:bg-red-50 dark:hover:bg-red-950/40 transition-all"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
          Remove app
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-[13px] text-[#374151] dark:text-[#c8cdd3]">
            Confirm by typing the bundle ID:{" "}
            <span className="font-mono font-semibold text-red-500">
              {app.bundleId}
            </span>
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={app.bundleId}
            className="w-full rounded-xl px-3.5 py-[9px] text-[13px] border border-red-300 dark:border-red-800 bg-white dark:bg-[#1c2028] text-[#111827] dark:text-[#e8eaf0] focus:outline-none focus:ring-2 focus:ring-red-400/40"
            disabled={deleting}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={confirmText !== app.bundleId || deleting}
              className="inline-flex items-center gap-1.5 px-4 py-[9px] rounded-xl text-[13px] font-semibold bg-red-600 text-white hover:bg-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting ? (
                <>
                  <div className="spinner !w-3.5 !h-3.5" /> Deleting…
                </>
              ) : (
                "Delete permanently"
              )}
            </button>
            <button
              onClick={() => {
                setConfirming(false);
                setConfirmText("");
              }}
              disabled={deleting}
              className="px-4 py-[9px] rounded-xl text-[13px] font-medium border border-[#eef0f3] dark:border-[#2a2f3d] bg-white dark:bg-[#1c2028] text-[#6b7280] dark:text-[#8b93a5] hover:bg-gray-50 dark:hover:bg-[#252b38] transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
