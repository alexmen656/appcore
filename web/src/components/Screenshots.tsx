import { useState, useCallback } from "react";
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
  AppItem,
} from "../types";

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

// ─── Gradient presets ─────────────────────────────────────────────────────────
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

      <ScreenshotJobsTable appId={activeApp.id} addToast={addToast} />

      <LocalTestPanel addToast={addToast} />
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
            <button className={btnSecSm} onClick={openPicker}>
              Change
            </button>
          )}
        </div>
      ) : (
        <div>
          {connected ? (
            <button className={btnPrimary} onClick={openPicker}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
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

function ScreenshotJobsTable({
  appId,
  addToast,
}: {
  appId: string;
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}) {
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
    <div className={`${cardCls} mb-5`}>
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

// ─── Single Job Row ───────────────────────────────────────────────────────────

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
  const [showFrameForm, setShowFrameForm] = useState(false);
  const [subtitle, setSubtitle] = useState("Your App");
  const [preset, setPreset] = useState(0);
  const [framing, setFraming] = useState(false);
  const [framedUrls, setFramedUrls] = useState<string[]>([]);

  const handleFrame = async () => {
    setFraming(true);
    try {
      const res = await fetch(
        `/api/github/screenshots/frame/${job.id}`,
        {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            subtitle,
            bgColor1: PRESETS[preset].bg1,
            bgColor2: PRESETS[preset].bg2,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Framing failed");
      setFramedUrls(data.framedUrls);
      addToast(`${data.count} screenshots framed`, "success");
      setShowFrameForm(false);
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setFraming(false);
    }
  };

  return (
    <div className="border border-[#eef0f3] rounded-xl overflow-hidden">
      {/* Summary row */}
      <button
        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[#fafbfc] transition-colors text-left"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-mono text-[#111827]">
              {job.commitSha.slice(0, 7)}
            </span>
            <span className="text-[12px] font-mono bg-[#f3f4f6] px-1.5 py-0.5 rounded">
              {job.branch ?? "—"}
            </span>
            <span className={statusBadge(job.status)}>{job.status}</span>
          </div>
          {job.commitMessage && (
            <div className="text-[12px] text-[#6b7280] truncate mt-0.5">
              {job.commitMessage}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-[12px] text-[#9ca3af]">
            {job.pusher ? `by ${job.pusher}` : ""}
          </div>
          <div className="text-[11px] text-[#9ca3af]">
            {new Date(job.createdAt).toLocaleString()}
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-[#9ca3af] shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-[#eef0f3] bg-[#fafbfc] px-4 py-3">
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

          {/* Screenshot count + Frame button */}
          {job.status === "COMPLETED" && (
            <div className="mb-3 flex items-center gap-3">
              {job.screenshotUrls.length > 0 && (
                <div className="text-[12px] text-emerald-700">
                  {job.screenshotUrls.length} screenshot(s) generated
                </div>
              )}
              <button
                className={btnPrimSm}
                onClick={() => setShowFrameForm((v) => !v)}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <rect x="7" y="7" width="10" height="10" rx="1" />
                </svg>
                Frame Screenshots
              </button>
            </div>
          )}

          {/* Frame form */}
          {showFrameForm && (
            <div className="mb-4 p-4 rounded-xl border border-[#eef0f3] bg-white">
              <div className="text-[12px] font-semibold text-[#111827] mb-3">
                App Store Framing
              </div>
              <div className="mb-3">
                <label className="text-[11px] text-[#6b7280] mb-1 block">
                  Subtitle
                </label>
                <input
                  className={inputCls}
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="e.g. Track anything, anywhere"
                />
              </div>
              <div className="mb-4">
                <label className="text-[11px] text-[#6b7280] mb-1.5 block">
                  Background
                </label>
                <div className="flex gap-2 flex-wrap">
                  {PRESETS.map((p, i) => (
                    <button
                      key={p.label}
                      onClick={() => setPreset(i)}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${preset === i ? "border-[#111827] scale-110" : "border-transparent"}`}
                      style={{
                        background: `linear-gradient(135deg, ${p.bg1}, ${p.bg2})`,
                      }}
                      title={p.label}
                    />
                  ))}
                </div>
              </div>
              <button
                className={btnPrimary}
                onClick={handleFrame}
                disabled={framing}
              >
                {framing ? (
                  <>
                    <div className="spinner !w-3.5 !h-3.5" /> Framing…
                  </>
                ) : (
                  "Apply Frame"
                )}
              </button>
            </div>
          )}

          {/* Framed screenshot thumbnails */}
          {framedUrls.length > 0 && (
            <div className="mb-4">
              <div className="text-[11px] font-medium text-[#6b7280] uppercase tracking-wide mb-2">
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
                      className="h-48 rounded-lg border border-[#eef0f3] object-cover hover:opacity-90 transition-opacity"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Logs */}
          {job.logs && job.logs.length > 0 ? (
            <div>
              <div className="text-[11px] font-medium text-[#6b7280] uppercase tracking-wide mb-1">
                Logs ({job.logs.length} lines)
              </div>
              <pre className="text-[11px] text-[#e5e7eb] bg-[#111827] rounded-lg p-3 overflow-x-auto max-h-[400px] overflow-y-auto font-mono leading-relaxed">
                {job.logs.join("\n")}
              </pre>
            </div>
          ) : (
            <div className="text-[12px] text-[#9ca3af]">No logs captured.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Local Test Panel ─────────────────────────────────────────────────────────

function LocalTestPanel({
  addToast,
}: {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}) {
  const [open, setOpen] = useState(false);
  const [dirPath, setDirPath] = useState("");
  const [subtitle, setSubtitle] = useState("Your App");
  const [preset, setPreset] = useState(0);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const handleRun = useCallback(async () => {
    if (!dirPath.trim()) {
      addToast("Please enter a directory path", "error");
      return;
    }
    setRunning(true);
    setResults([]);
    try {
      const res = await fetch("/api/github/screenshots/test-local", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          dirPath: dirPath.trim(),
          subtitle,
          bgColor1: PRESETS[preset].bg1,
          bgColor2: PRESETS[preset].bg2,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Framing failed");
      setResults(data.framedUrls);
      addToast(`${data.count} screenshots framed`, "success");
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setRunning(false);
    }
  }, [dirPath, subtitle, preset, addToast]);

  return (
    <div className={cardCls}>
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <h2 className="text-[15px] font-semibold text-[#111827] text-left">
            Local Test — Frame Existing Screenshots
          </h2>
          <p className="text-xs text-[#9ca3af] text-left mt-0.5">
            Point to a folder of raw screenshots on disk to preview framing
            instantly.
          </p>
        </div>
        <svg
          className={`w-4 h-4 text-[#9ca3af] shrink-0 ml-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-4">
          <div className="mb-3">
            <label className="text-[11px] text-[#6b7280] mb-1 block">
              Directory path (absolute, on server)
            </label>
            <input
              className={inputCls}
              value={dirPath}
              onChange={(e) => setDirPath(e.target.value)}
              placeholder="/Users/you/project/fastlane/screenshots/en-US/iPhone 16 Pro Max"
            />
          </div>
          <div className="mb-3">
            <label className="text-[11px] text-[#6b7280] mb-1 block">
              Subtitle
            </label>
            <input
              className={inputCls}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="e.g. Track anything, anywhere"
            />
          </div>
          <div className="mb-4">
            <label className="text-[11px] text-[#6b7280] mb-1.5 block">
              Background gradient
            </label>
            <div className="flex gap-2 flex-wrap items-center">
              {PRESETS.map((p, i) => (
                <button
                  key={p.label}
                  onClick={() => setPreset(i)}
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${preset === i ? "border-[#111827] scale-110" : "border-transparent"}`}
                  style={{
                    background: `linear-gradient(135deg, ${p.bg1}, ${p.bg2})`,
                  }}
                  title={p.label}
                />
              ))}
              <span className="text-[11px] text-[#9ca3af] ml-1">
                {PRESETS[preset].label}
              </span>
            </div>
          </div>
          <button
            className={btnPrimary}
            onClick={handleRun}
            disabled={running}
          >
            {running ? (
              <>
                <div className="spinner !w-3.5 !h-3.5" /> Framing…
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <rect x="7" y="7" width="10" height="10" rx="1" />
                </svg>
                Frame Screenshots
              </>
            )}
          </button>

          {results.length > 0 && (
            <div className="mt-5">
              <div className="text-[11px] font-medium text-[#6b7280] uppercase tracking-wide mb-2">
                Result — {results.length} screenshot(s)
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {results.map((url) => (
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
                      className="h-64 rounded-xl border border-[#eef0f3] object-cover hover:opacity-90 transition-opacity shadow-sm"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
