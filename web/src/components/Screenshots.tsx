import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, GitBranch } from "lucide-react";

const LOG_PREFIX_COLORS: { prefix: string; color: string }[] = [
  { prefix: "[snapshot]", color: "#38bdf8" },
  { prefix: "[repo]", color: "#b700ff" },
  { prefix: "[build]", color: "#a78bfa" },
  { prefix: "[frame]", color: "#34d399" },
  { prefix: "[framing]", color: "#b9fc00" },
  { prefix: "[signing]", color: "#38c600" },
  { prefix: "[config]", color: "#0169fb" },
];

function renderLogLine(line: string, i: number) {
  const entry = LOG_PREFIX_COLORS.find(({ prefix }) => line.startsWith(prefix));
  if (entry) {
    return (
      <span key={i} className="block text-[#e5e7eb]">
        <span style={{ color: entry.color }}>{entry.prefix}</span>
        {line.slice(entry.prefix.length)}
      </span>
    );
  }
  return (
    <span key={i} className="block text-[#e5e7eb]">
      {line}
    </span>
  );
}

function useLazyLogs(path: string | null) {
  const [logs, setLogs] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path || logs !== null || loading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api${path}`, { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        setLogs(Array.isArray(d.logs) ? d.logs : []);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return { logs, loading, error };
}

function LogsBlock({
  logs,
  loading,
  error,
}: {
  logs: string[] | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-[#9ca3af] dark:text-[#5c6478] py-2">
        <div className="spinner !w-3 !h-3" /> Loading logs…
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-[12px] text-red-500">
        Failed to load logs: {error}
      </div>
    );
  }
  if (!logs || logs.length === 0) {
    return (
      <div className="text-[12px] text-[#9ca3af] dark:text-[#5c6478]">
        No logs captured.
      </div>
    );
  }
  return (
    <div>
      <div className="text-[11px] font-medium text-[#6b7280] dark:text-[#8b93a5] uppercase tracking-wide mb-1">
        Logs ({logs.length} lines)
      </div>
      <pre className="text-[11px] bg-[#111827] rounded-lg p-3 overflow-x-auto max-h-[400px] overflow-y-auto font-mono leading-relaxed">
        {logs.map(renderLogLine)}
      </pre>
    </div>
  );
}

import {
  useApi,
  apiPost,
  getActiveBundleId,
  authHeaders,
} from "../hooks/useApi";
import {
  cardCls,
  btnPrimary,
  btnPrimSm,
  btnSecondary,
  btnSecSm,
  inputCls,
} from "../styles";
import type {
  GitHubStatus,
  GitHubRepo,
  AppRepoLink,
  ScreenshotJob,
  BuildJob,
  AppItem,
} from "../types";

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

const PRESETS = [
  { label: "Purple", bg1: "#667eea", bg2: "#764ba2" },
  { label: "Blue", bg1: "#4facfe", bg2: "#00f2fe" },
  { label: "Sunset", bg1: "#f093fb", bg2: "#f5576c" },
  { label: "Mint", bg1: "#43e97b", bg2: "#38f9d7" },
  { label: "Coral", bg1: "#f7971e", bg2: "#ffd200" },
  { label: "Night", bg1: "#0f0c29", bg2: "#302b63" },
];

export default function Screenshots({ addToast }: Props) {
  const { data: ghStatus } = useApi<GitHubStatus>("/github/status", [], true);
  const { data: apps } = useApi<AppItem[]>("/apps", [], true);

  const bundleId = getActiveBundleId();
  const activeApp = apps?.find((a) => a.bundleId === bundleId && a.isOwnApp);

  if (!activeApp) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-semibold tracking-tight text-[#111827] dark:text-[#e8eaf0] mb-1">
          Screenshots
        </h1>
        <p className="text-sm text-[#9ca3af] dark:text-[#5c6478] mb-8">
          Select an app to manage GitHub integration and screenshot generation.
        </p>
        <div
          className={`${cardCls} text-center py-12 text-gray-400 dark:text-[#5c6478]`}
        >
          No app selected. Choose an app from the sidebar.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-semibold tracking-tight text-[#111827] dark:text-[#e8eaf0] mb-1">
        Screenshots
      </h1>
      <p className="text-sm text-[#9ca3af] dark:text-[#5c6478] mb-8">
        Automatically generate App Store screenshots via Fastlane when you push
        to GitHub.
      </p>

      {!ghStatus?.connected && (
        <div
          className={`${cardCls} mb-5 flex items-center gap-3 border-amber-200 bg-amber-50`}
        >
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <span className="text-sm text-amber-800">
            Connect your GitHub account in{" "}
            <a href="/settings" className="underline font-medium">
              User Settings
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

      <ScreenshotJobsTable appId={activeApp.id} addToast={addToast} />
    </div>
  );
}

export function RepoLinker({
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
  const [dirs, setDirs] = useState<string[] | null>(null);
  const [loadingDirs, setLoadingDirs] = useState(false);
  const [selectedDir, setSelectedDir] = useState<string>("");
  const [step, setStep] = useState<"repo" | "dir">("repo");
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

  const loadDirs = async (repoFullName: string) => {
    const [owner, repo] = repoFullName.split("/");
    setLoadingDirs(true);
    setDirs(null);
    try {
      const res = await fetch(`/api/github/repo-dirs/${owner}/${repo}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDirs(await res.json());
    } catch (err: any) {
      addToast(`Failed to load directories: ${err.message}`, "error");
      setDirs([]);
    } finally {
      setLoadingDirs(false);
    }
  };

  const handleRepoNext = () => {
    if (!selectedRepo) return;
    setStep("dir");
    setSelectedDir("");
    loadDirs(selectedRepo);
  };

  const handleLink = async () => {
    if (!selectedRepo) return;
    setLinking(true);
    try {
      await apiPost("/github/link", {
        appId,
        repoFullName: selectedRepo,
        iosDir: selectedDir || null,
      });
      addToast(`Linked ${selectedRepo} → ${appName}`, "success");
      setShowPicker(false);
      setSelectedRepo("");
      setSelectedDir("");
      setStep("repo");
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
    setStep("repo");
    setSelectedDir("");
    if (!repos) loadRepos();
  };

  return (
    <div className={`${cardCls} mb-5`}>
      <h2 className="text-[18px] font-semibold text-[#111827] dark:text-[#e8eaf0] mb-1">
        GitHub Repository
      </h2>
      <p className="text-xs text-[#9ca3af] dark:text-[#5c6478] mb-4">
        Link a GitHub repo to this app. On every push, Marteso will
        automatically generate screenshots and binary.
      </p>

      {link?.linked ? (
        <div className="flex items-center gap-3">
          <div className="flex justify-between gap-2 bg-[#f8f9fb] dark:bg-[#252b38] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-xl px-4 py-2.5 w-full">
            <div className="flex items-center gap-3">
              <GitBranch
                className="w-5 h-5 text-[#111827] dark:text-[#e8eaf0]"
              />
              <div>
                <div className="text-sm font-medium text-[#111827] dark:text-[#e8eaf0]">
                  {link.repoFullName}
                </div>
                <div className="text-[11px] text-[#9ca3af] dark:text-[#5c6478]">
                  {link.iosDir
                    ? `iOS folder: ${link.iosDir}/`
                    : "Repo connected"}
                </div>
              </div>
            </div>
            <div>
              <button className={btnSecSm} onClick={handleUnlink}>
                Unlink
              </button>
              {connected && (
                <button className={btnSecSm} onClick={openPicker}>
                  Change
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div>
          {connected ? (
            <button className={btnPrimary} onClick={openPicker}>
              <GitBranch className="w-4 h-4" />
              Link Repository
            </button>
          ) : (
            <p className="text-sm text-[#9ca3af] dark:text-[#5c6478]">
              Connect GitHub in User Settings to link a repo.
            </p>
          )}
        </div>
      )}

      {showPicker && (
        <div className="mt-4 border border-[#eef0f3] dark:border-[#2a2f3d] rounded-xl p-4 bg-[#f8f9fb] dark:bg-[#161920]">
          {step === "repo" ? (
            <>
              <h3 className="text-sm font-medium text-[#111827] dark:text-[#e8eaf0] mb-3">
                Select a repository
              </h3>
              {loadingRepos ? (
                <div className="flex items-center gap-2 text-sm text-[#9ca3af] dark:text-[#5c6478] py-4">
                  <div className="spinner !w-4 !h-4" /> Loading repositories…
                </div>
              ) : (
                <>
                  <select
                    className="w-full px-3 py-2 rounded-xl border border-[#eef0f3] dark:border-[#2a2f3d] bg-white dark:bg-[#1c2028] text-sm text-[#111827] dark:text-[#e8eaf0] mb-3"
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
                      onClick={handleRepoNext}
                      disabled={!selectedRepo}
                    >
                      Next
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
            </>
          ) : (
            <>
              <h3 className="text-sm font-medium text-[#111827] dark:text-[#e8eaf0] mb-0.5">
                iOS app folder
              </h3>
              <p className="text-xs text-[#9ca3af] dark:text-[#5c6478] mb-3">
                Select the folder that contains the iOS app code (e.g.{" "}
                <code className="font-mono">ios</code> for React Native). Leave
                as root if the Xcode project is at the repo root.
              </p>
              {loadingDirs ? (
                <div className="flex items-center gap-2 text-sm text-[#9ca3af] dark:text-[#5c6478] py-4">
                  <div className="spinner !w-4 !h-4" /> Scanning folders…
                </div>
              ) : (
                <>
                  <select
                    className="w-full px-3 py-2 rounded-xl border border-[#eef0f3] dark:border-[#2a2f3d] bg-white dark:bg-[#1c2028] text-sm text-[#111827] dark:text-[#e8eaf0] mb-3"
                    value={selectedDir}
                    onChange={(e) => setSelectedDir(e.target.value)}
                  >
                    <option value="">/ (repo root)</option>
                    {dirs?.map((d) => (
                      <option key={d} value={d}>
                        {d}/
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      className={btnPrimary}
                      onClick={handleLink}
                      disabled={linking}
                    >
                      {linking ? "Linking…" : "Link"}
                    </button>
                    <button
                      className={btnSecondary}
                      onClick={() => setStep("repo")}
                    >
                      Back
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
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function ScreenshotJobsTable({
  appId,
  addToast,
}: {
  appId: string;
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}) {
  const {
    data: jobs,
    loading,
    refetch,
  } = useApi<ScreenshotJob[]>(`/github/screenshots/${appId}`, [appId], true);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      PENDING:
        "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
      RUNNING:
        "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
      COMPLETED:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
      FAILED: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
    };
    return `inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium ${colors[s] ?? "bg-gray-50 text-gray-600 dark:bg-[#252b38] dark:text-[#8b93a5]"}`;
  };

  async function handleTrigger() {
    setTriggering(true);
    try {
      await apiPost(`/github/screenshots/trigger/${appId}`);
      addToast("Screenshot job started", "success");
      setTimeout(refetch, 800);
    } catch {
      addToast("Failed to trigger screenshot job", "error");
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className={`${cardCls} mb-5`}>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[15px] font-semibold text-[#111827] dark:text-[#e8eaf0]">
          Screenshot Jobs
        </h2>
        <button
          onClick={handleTrigger}
          disabled={triggering}
          className={btnSecSm}
        >
          {triggering ? "Starting…" : "Run Now"}
        </button>
      </div>
      <p className="text-xs text-[#9ca3af] dark:text-[#5c6478] mb-4">
        Recent screenshot generation runs triggered by GitHub pushes.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-[#5c6478] py-8 justify-center">
          <div className="spinner !w-4 !h-4" /> Loading…
        </div>
      ) : !jobs || jobs.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400 dark:text-[#5c6478]">
          No screenshot jobs yet. Link a repo and push a commit to trigger one.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((j) => (
            <JobRow
              key={j.id}
              job={j}
              expanded={expandedJob === j.id}
              onToggle={() =>
                setExpandedJob(expandedJob === j.id ? null : j.id)
              }
              statusBadge={statusBadge}
              addToast={addToast}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JobRow({
  job,
  expanded,
  onToggle,
  statusBadge,
  addToast,
}: {
  job: ScreenshotJob;
  expanded: boolean;
  onToggle: () => void;
  statusBadge: (s: string) => string;
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}) {
  const [framedUrls] = useState<string[]>([]);
  const {
    logs,
    loading: logsLoading,
    error: logsError,
  } = useLazyLogs(
    expanded ? `/github/screenshots/${job.appId}/${job.id}/logs` : null,
  );

  return (
    <div className="border border-[#eef0f3] dark:border-[#2a2f3d] rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[#fafbfc] dark:hover:bg-white/[0.03] transition-colors text-left"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-mono text-[#111827] dark:text-[#e8eaf0]">
              {job.commitSha.slice(0, 7)}
            </span>
            <span className="text-[12px] font-mono bg-[#f3f4f6] dark:bg-[#252b38] dark:text-[#8b93a5] px-1.5 py-0.5 rounded">
              {job.branch ?? "—"}
            </span>
            <span className={statusBadge(job.status)}>{job.status}</span>
          </div>
          {job.commitMessage && (
            <div className="text-[12px] text-[#6b7280] dark:text-[#8b93a5] truncate mt-0.5">
              {job.commitMessage}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-[12px] text-[#9ca3af] dark:text-[#5c6478]">
            {job.pusher ? `by ${job.pusher}` : ""}
          </div>
          <div className="text-[11px] text-[#9ca3af] dark:text-[#5c6478]">
            {new Date(job.createdAt).toLocaleString()}
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-[#9ca3af] dark:text-[#5c6478] shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-[#eef0f3] dark:border-[#2a2f3d] bg-[#fafbfc] dark:bg-[#161920] px-4 py-3">
          {job.error && (
            <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200">
              <div className="text-[11px] font-medium text-red-700 uppercase tracking-wide mb-1">
                Error
              </div>
              <pre className="text-[12px] text-red-600 whitespace-pre-wrap break-all font-mono">
                {job.error}
              </pre>
            </div>
          )}

          {job.status === "COMPLETED" && (
            <div className="mb-3 flex items-center gap-3">
              {job.screenshotUrls.length > 0 && (
                <div className="text-[12px] text-emerald-700">
                  {job.screenshotUrls.length} screenshot(s) generated
                </div>
              )}
            </div>
          )}

          {framedUrls.length > 0 && (
            <div className="mb-4">
              <div className="text-[11px] font-medium text-[#6b7280] dark:text-[#8b93a5] uppercase tracking-wide mb-2">
                Framed ({framedUrls.length})
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {framedUrls.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                  >
                    <img
                      src={url}
                      alt="Framed screenshot"
                      className="h-48 rounded-lg border border-[#eef0f3] dark:border-[#2a2f3d] object-cover hover:opacity-90 transition-opacity"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          <LogsBlock logs={logs} loading={logsLoading} error={logsError} />
        </div>
      )}
    </div>
  );
}

export function BuildJobsTable({
  appId,
  addToast,
}: {
  appId: string;
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}) {
  const {
    data: jobs,
    loading,
    refetch,
  } = useApi<BuildJob[]>(`/github/builds/${appId}`, [appId], true);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      PENDING:
        "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
      RUNNING:
        "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
      COMPLETED:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
      FAILED: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
    };
    return `inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium ${colors[s] ?? "bg-gray-50 text-gray-600 dark:bg-[#252b38] dark:text-[#8b93a5]"}`;
  };

  async function handleTrigger() {
    setTriggering(true);
    try {
      await apiPost(`/github/builds/trigger/${appId}`);
      addToast("Build job started", "success");
      setTimeout(refetch, 800);
    } catch {
      addToast("Failed to trigger build job", "error");
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className={`${cardCls} mb-5`}>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[15px] font-semibold text-[#111827] dark:text-[#e8eaf0]">
          Build Jobs
        </h2>
        <button
          onClick={handleTrigger}
          disabled={triggering}
          className={btnSecSm}
        >
          {triggering ? "Starting…" : "Run Now"}
        </button>
      </div>
      <p className="text-xs text-[#9ca3af] dark:text-[#5c6478] mb-4">
        Binary build runs triggered by GitHub pushes.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-[#5c6478] py-8 justify-center">
          <div className="spinner !w-4 !h-4" /> Loading…
        </div>
      ) : !jobs || jobs.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400 dark:text-[#5c6478]">
          No build jobs yet. Link a repo and push a commit to trigger one.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((j) => (
            <BuildJobRow
              key={j.id}
              job={j}
              expanded={expandedJob === j.id}
              onToggle={() =>
                setExpandedJob(expandedJob === j.id ? null : j.id)
              }
              statusBadge={statusBadge}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BuildJobRow({
  job,
  expanded,
  onToggle,
  statusBadge,
}: {
  job: BuildJob;
  expanded: boolean;
  onToggle: () => void;
  statusBadge: (s: string) => string;
}) {
  const {
    logs,
    loading: logsLoading,
    error: logsError,
  } = useLazyLogs(
    expanded ? `/github/builds/${job.appId}/${job.id}/logs` : null,
  );

  return (
    <div className="border border-[#eef0f3] dark:border-[#2a2f3d] rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[#fafbfc] dark:hover:bg-white/[0.03] transition-colors text-left"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {job.commitSha && (
              <span className="text-[13px] font-mono text-[#111827] dark:text-[#e8eaf0]">
                {job.commitSha.slice(0, 7)}
              </span>
            )}
            {job.branch && (
              <span className="text-[12px] font-mono bg-[#f3f4f6] dark:bg-[#252b38] dark:text-[#8b93a5] px-1.5 py-0.5 rounded">
                {job.branch}
              </span>
            )}
            <span className={statusBadge(job.status)}>{job.status}</span>
            {job.ipaPath && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                IPA ready
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[11px] text-[#9ca3af] dark:text-[#5c6478]">
            {new Date(job.createdAt).toLocaleString()}
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-[#9ca3af] dark:text-[#5c6478] shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-[#eef0f3] dark:border-[#2a2f3d] bg-[#fafbfc] dark:bg-[#161920] px-4 py-3">
          {job.errors.length > 0 && (
            <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200">
              <div className="text-[11px] font-medium text-red-700 uppercase tracking-wide mb-1">
                Errors
              </div>
              <pre className="text-[12px] text-red-600 whitespace-pre-wrap break-all font-mono">
                {job.errors.join("\n")}
              </pre>
            </div>
          )}
          <LogsBlock logs={logs} loading={logsLoading} error={logsError} />
        </div>
      )}
    </div>
  );
}
