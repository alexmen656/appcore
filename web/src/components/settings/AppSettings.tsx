import { useState } from "react";
import {
  borderDefault,
  pageTitle,
  textMuted,
  textPrimary,
  textSecondary,
} from "../../styles";
import { Trash2 } from "lucide-react";
import {
  useApi,
  getActiveBundleId,
  apiDelete,
  setActiveBundleId,
} from "../../hooks/useApi";
import SigningSection from "./SigningSection";
import SnapshotEnvSection from "./SnapshotEnvSection";
import { RepoLinker } from "../Logs";
import type { AppItem, GitHubStatus } from "../../types";

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
      <h1 className={`${pageTitle} mb-5`}>App Settings</h1>

      {activeApp ? (
        <RepoLinker
          appId={activeApp.id}
          appName={activeApp.name}
          connected={!!ghStatus?.connected}
          addToast={addToast}
        />
      ) : (
        <div
          className={`bg-white dark:bg-[#1c2028] border ${borderDefault} rounded-2xl p-5 mb-5 text-sm ${textMuted}`}
        >
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
      <p className={`text-[13px] ${textSecondary} mb-4`}>
        This app and all associated data (screenshots, builds, keywords,
        analyses) will be permanently deleted.
      </p>

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-2 px-4 py-[9px] rounded-xl text-[13px] font-semibold border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 bg-white dark:bg-[#1c2028] hover:bg-red-50 dark:hover:bg-red-950/40 transition-all"
        >
          <Trash2 className="w-4 h-4" />
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
            className={`w-full rounded-xl px-3.5 py-[9px] text-[13px] border border-red-300 dark:border-red-800 bg-white dark:bg-[#1c2028] ${textPrimary} focus:outline-none focus:ring-2 focus:ring-red-400/40`}
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
              className={`px-4 py-[9px] rounded-xl text-[13px] font-medium border ${borderDefault} bg-white dark:bg-[#1c2028] ${textSecondary} hover:bg-gray-50 dark:hover:bg-[#252b38] transition-all`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
