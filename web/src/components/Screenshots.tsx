import { useState, useEffect, useCallback } from "react";
import {
  useApi,
  apiPost,
  getActiveBundleId,
  authHeaders,
} from "../hooks/useApi";
import {
  cardCls,
  btnPrimary,
  btnSecondary,
  btnSecSm,
} from "../styles";
import type {
  GitHubStatus,
  GitHubRepo,
  AppRepoLink,
  ScreenshotJob,
  AppItem,
} from "../types";

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function Screenshots({ addToast }: Props) {
  const { data: ghStatus } = useApi<GitHubStatus>("/github/status", [], true);
  const { data: apps } = useApi<AppItem[]>("/apps", [], true);

  const bundleId = getActiveBundleId();
  const activeApp = apps?.find((a) => a.bundleId === bundleId && a.isOwnApp);

  if (!activeApp) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-semibold tracking-tight text-[#111827] mb-1">
          Screenshots
        </h1>
        <p className="text-sm text-[#9ca3af] mb-8">
          Select an app to manage GitHub integration and screenshot generation.
        </p>
        <div className={`${cardCls} text-center py-12 text-gray-400`}>
          No app selected. Choose an app from the sidebar.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-semibold tracking-tight text-[#111827] mb-1">
        Screenshots
      </h1>
      <p className="text-sm text-[#9ca3af] mb-8">
        Automatically generate App Store screenshots via Fastlane when you push
        to GitHub.
      </p>

      {!ghStatus?.connected && (
        <div
          className={`${cardCls} mb-5 flex items-center gap-3 border-amber-200 bg-amber-50`}
        >
          <svg
            className="w-5 h-5 text-amber-500 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.834-2.694-.834-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <span className="text-sm text-amber-800">
            Connect your GitHub account in{" "}
            <a href="/settings" className="underline font-medium">
              Settings
            </a>{" "}
            first to enable repo linking.
          </span>
        </div>
      )}

      <RepoLinker
        appId={activeApp.id}
        appName={activeApp.name}
        connected={!!ghStatus?.connected}
        addToast={addToast}
      />

      <ScreenshotJobsTable appId={activeApp.id} />
    </div>
  );
}

// ─── Repo Linker ──────────────────────────────────────────────────────────────

function RepoLinker({
  appId,
  appName,
  connected,
  addToast,
}: {
  appId: string;
  appName: string;
  connected: boolean;
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}) {
  const { data: link, refetch } = useApi<AppRepoLink>(
    `/github/app-repo/${appId}`,
    [appId],
    true,
  );
  const [repos, setRepos] = useState<GitHubRepo[] | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [linking, setLinking] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const loadRepos = async () => {
    setLoadingRepos(true);
    try {
      const res = await fetch("/api/github/repos", { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRepos(await res.json());
    } catch (err: any) {
      addToast(`Failed to load repos: ${err.message}`, "error");
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleLink = async () => {
    if (!selectedRepo) return;
    setLinking(true);
    try {
      await apiPost("/github/link", { appId, repoFullName: selectedRepo });
      addToast(`Linked ${selectedRepo} → ${appName}`, "success");
      setShowPicker(false);
      setSelectedRepo("");
      refetch();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm("Remove the repo link? The webhook will be deleted.")) return;
    try {
      await apiPost("/github/unlink", { appId });
      addToast("Repo unlinked", "info");
      refetch();
    } catch (err: any) {
      addToast(err.message, "error");
    }
  };

  const openPicker = () => {
    setShowPicker(true);
    if (!repos) loadRepos();
  };

  return (
    <div className={`${cardCls} mb-5`}>
      <h2 className="text-[15px] font-semibold text-[#111827] mb-1">
        GitHub Repository
      </h2>
      <p className="text-xs text-[#9ca3af] mb-4">
        Link a GitHub repo to this app. On every push, AppCore will clone the
        repo and run <code className="text-[11px]">fastlane snapshot</code> to
        generate screenshots.
      </p>

      {link?.linked ? (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#f8f9fb] border border-[#eef0f3] rounded-xl px-4 py-2.5">
            <svg
              className="w-5 h-5 text-[#111827]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
            <div>
              <div className="text-sm font-medium text-[#111827]">
                {link.repoFullName}
              </div>
              <div className="text-[11px] text-[#9ca3af]">
                Webhook active — screenshots on push
              </div>
            </div>
          </div>
          <button className={btnSecSm} onClick={handleUnlink}>
            Unlink
          </button>
          {connected && (
            <button
              className={btnSecSm}
              onClick={openPicker}
            >
              Change
            </button>
          )}
        </div>
      ) : (
        <div>
          {connected ? (
            <button className={btnPrimary} onClick={openPicker}>
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              Link Repository
            </button>
          ) : (
            <p className="text-sm text-gray-400">
              Connect GitHub in Settings to link a repo.
            </p>
          )}
        </div>
      )}

      {/* Repo picker modal */}
      {showPicker && (
        <div className="mt-4 border border-[#eef0f3] rounded-xl p-4 bg-[#f8f9fb]">
          <h3 className="text-sm font-medium text-[#111827] mb-3">
            Select a repository
          </h3>
          {loadingRepos ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
              <div className="spinner !w-4 !h-4" /> Loading repositories…
            </div>
          ) : (
            <>
              <select
                className="w-full px-3 py-2 rounded-xl border border-[#eef0f3] bg-white text-sm text-[#111827] mb-3"
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
              >
                <option value="">— Choose a repo —</option>
                {repos?.map((r) => (
                  <option key={r.id} value={r.fullName}>
                    {r.fullName}
                    {r.private ? " 🔒" : ""}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  className={btnPrimary}
                  onClick={handleLink}
                  disabled={!selectedRepo || linking}
                >
                  {linking ? "Linking…" : "Link"}
                </button>
                <button
                  className={btnSecondary}
                  onClick={() => setShowPicker(false)}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Screenshot Jobs Table ────────────────────────────────────────────────────

function ScreenshotJobsTable({ appId }: { appId: string }) {
  const { data: jobs, loading } = useApi<ScreenshotJob[]>(
    `/github/screenshots/${appId}`,
    [appId],
    true,
  );
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      PENDING: "bg-amber-50 text-amber-700",
      RUNNING: "bg-blue-50 text-blue-700",
      COMPLETED: "bg-emerald-50 text-emerald-700",
      FAILED: "bg-red-50 text-red-600",
    };
    return `inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium ${colors[s] ?? "bg-gray-50 text-gray-600"}`;
  };

  return (
    <div className={cardCls}>
      <h2 className="text-[15px] font-semibold text-[#111827] mb-1">
        Screenshot Jobs
      </h2>
      <p className="text-xs text-[#9ca3af] mb-4">
        Recent screenshot generation runs triggered by GitHub pushes.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center">
          <div className="spinner !w-4 !h-4" /> Loading…
        </div>
      ) : !jobs || jobs.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">
          No screenshot jobs yet. Link a repo and push a commit to trigger one.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((j) => (
            <div
              key={j.id}
              className="border border-[#eef0f3] rounded-xl overflow-hidden"
            >
              {/* Summary row */}
              <button
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[#fafbfc] transition-colors text-left"
                onClick={() => setExpandedJob(expandedJob === j.id ? null : j.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-mono text-[#111827]">
                      {j.commitSha.slice(0, 7)}
                    </span>
                    <span className="text-[12px] font-mono bg-[#f3f4f6] px-1.5 py-0.5 rounded">
                      {j.branch ?? "—"}
                    </span>
                    <span className={statusBadge(j.status)}>{j.status}</span>
                  </div>
                  {j.commitMessage && (
                    <div className="text-[12px] text-[#6b7280] truncate mt-0.5">
                      {j.commitMessage}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[12px] text-[#9ca3af]">
                    {j.pusher ? `by ${j.pusher}` : ""}
                  </div>
                  <div className="text-[11px] text-[#9ca3af]">
                    {new Date(j.createdAt).toLocaleString()}
                  </div>
                </div>
                <svg
                  className={`w-4 h-4 text-[#9ca3af] shrink-0 transition-transform ${expandedJob === j.id ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded details */}
              {expandedJob === j.id && (
                <div className="border-t border-[#eef0f3] bg-[#fafbfc] px-4 py-3">
                  {/* Error banner */}
                  {j.error && (
                    <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200">
                      <div className="text-[11px] font-medium text-red-700 uppercase tracking-wide mb-1">
                        Error
                      </div>
                      <pre className="text-[12px] text-red-600 whitespace-pre-wrap break-all font-mono">
                        {j.error}
                      </pre>
                    </div>
                  )}

                  {/* Screenshots count */}
                  {j.screenshotUrls.length > 0 && (
                    <div className="mb-3 text-[12px] text-emerald-700">
                      {j.screenshotUrls.length} screenshot(s) generated
                    </div>
                  )}

                  {/* Logs */}
                  {j.logs && j.logs.length > 0 ? (
                    <div>
                      <div className="text-[11px] font-medium text-[#6b7280] uppercase tracking-wide mb-1">
                        Logs ({j.logs.length} lines)
                      </div>
                      <pre className="text-[11px] text-[#374151] bg-[#111827] text-[#e5e7eb] rounded-lg p-3 overflow-x-auto max-h-[400px] overflow-y-auto font-mono leading-relaxed">
                        {j.logs.join("\n")}
                      </pre>
                    </div>
                  ) : (
                    <div className="text-[12px] text-[#9ca3af]">
                      No logs captured.
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
