import { useState, useEffect, useRef, useCallback } from "react";
import { useApi, apiPost, getActiveBundleId, authHeaders } from "../hooks/useApi";
import { cardCls, btnPrimary, btnSecondary, btnSecSm } from "../styles";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocalePreview {
  locale: string;
  name: string;
  subtitle: string;
  keywords: string;
  description: string;
  whatsNew: string;
  promotionalText: string;
}

interface SubmissionPreview {
  appId: string;
  bundleId: string;
  appName: string;
  versionString: string | null;
  appStoreState: string | null;
  isEditable: boolean;
  locales: LocalePreview[];
}

interface SubmissionStatus {
  active: boolean;
  jobId?: string;
  status: "idle" | "preparing" | "running" | "completed" | "failed";
  logs: string[];
  errors: string[];
  startedAt?: string;
}

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

// ─── Status badge colors ──────────────────────────────────────────────────────

const stateColors: Record<string, string> = {
  READY_FOR_SALE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
  PREPARE_FOR_SUBMISSION: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  WAITING_FOR_REVIEW: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  IN_REVIEW: "bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400",
  REJECTED: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
  DEVELOPER_REJECTED: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
  METADATA_REJECTED: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
  PENDING_DEVELOPER_RELEASE: "bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400",
};

function StateBadge({ state }: { state: string }) {
  const cls = stateColors[state] ?? "bg-gray-50 text-gray-600";
  const label = state.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

const statusColors: Record<string, { dot: string; text: string }> = {
  idle: { dot: "bg-gray-300", text: "text-gray-500" },
  preparing: { dot: "bg-amber-400 animate-pulse", text: "text-amber-600" },
  running: { dot: "bg-blue-500 animate-pulse", text: "text-blue-600" },
  completed: { dot: "bg-emerald-500", text: "text-emerald-600" },
  failed: { dot: "bg-red-500", text: "text-red-600" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Submissions({ addToast }: Props) {
  const [preview, setPreview] = useState<SubmissionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [activeLocale, setActiveLocale] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [status, setStatus] = useState<SubmissionStatus | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load preview ──────────────────────────────────────────────────────

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const bundleId = getActiveBundleId();
      const qs = bundleId ? `?bundleId=${encodeURIComponent(bundleId)}` : "";
      const res = await fetch(`/api/submissions/preview${qs}`, { headers: authHeaders() });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? `HTTP ${res.status}`);
      }
      const data: SubmissionPreview = await res.json();
      setPreview(data);
      if (data.locales.length > 0 && !activeLocale) {
        setActiveLocale(data.locales[0].locale);
      }
    } catch (err: any) {
      setPreviewError(err.message);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  // Reload on app change
  useEffect(() => {
    window.addEventListener("app-changed", loadPreview);
    return () => window.removeEventListener("app-changed", loadPreview);
  }, [loadPreview]);

  // ── Poll submission status ────────────────────────────────────────────

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/submissions/status", { headers: authHeaders() });
      if (res.ok) {
        const s: SubmissionStatus = await res.json();
        setStatus(s);
        if (!s.active && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    } catch {
      // ignore poll errors
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollStatus();
    pollRef.current = setInterval(pollStatus, 2000);
  }, [pollStatus]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [status?.logs?.length]);

  // ── Actions ───────────────────────────────────────────────────────────

  const submitMetadata = async () => {
    setSubmitting("metadata");
    setShowLogs(true);
    try {
      const res = await apiPost("/submissions/metadata", { bundleId: getActiveBundleId() });
      addToast(res.message || "Metadata submission started", "success");
      startPolling();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setSubmitting(null);
    }
  };

  const submitForReview = async () => {
    setSubmitting("review");
    setShowLogs(true);
    try {
      const res = await apiPost("/submissions/review", { bundleId: getActiveBundleId() });
      addToast(res.message || "Submit for review started", "success");
      startPolling();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setSubmitting(null);
    }
  };

  const submitForReviewAPI = async () => {
    setSubmitting("review-api");
    try {
      const res = await apiPost("/submissions/review-api", { bundleId: getActiveBundleId() });
      addToast(res.message || "Submitted for review", res.ok ? "success" : "error");
      loadPreview();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setSubmitting(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────

  const selectedLocale = preview?.locales.find((l) => l.locale === activeLocale);
  const isActive = status?.active === true;
  const statusStyle = statusColors[status?.status ?? "idle"];

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-[#111827] dark:text-[#e8eaf0] mb-1">
        Submit
      </h1>
      <p className="text-sm text-[#9ca3af] dark:text-[#5c6478] mb-8">
        Push metadata to the App Store via Fastlane and submit for review
      </p>

      {/* ─── Error state ───────────────────────────────────────────── */}
      {previewError && (
        <div className={`${cardCls} mb-6 border-red-200 bg-red-50`}>
          <div className="flex items-start gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-red-500 shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-700">Failed to load submission preview</p>
              <p className="text-xs text-red-600 mt-1">{previewError}</p>
              <button onClick={loadPreview} className="text-xs text-red-700 underline mt-2">
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Loading ───────────────────────────────────────────────── */}
      {previewLoading && !preview && (
        <div className={`${cardCls} flex items-center justify-center py-16`}>
          <div className="spinner" />
          <span className="ml-3 text-sm text-gray-400 dark:text-[#5c6478]">Loading App Store version data…</span>
        </div>
      )}

      {/* ─── Version Overview ──────────────────────────────────────── */}
      {preview && (
        <>
          <div className={`${cardCls} mb-6`}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="text-lg font-bold text-[#111827] dark:text-[#e8eaf0]">{preview.appName}</h2>
                  <p className="text-xs text-gray-400 dark:text-[#5c6478] font-mono mt-0.5">{preview.bundleId}</p>
                </div>
                {preview.versionString && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#111827] dark:text-[#e8eaf0]">v{preview.versionString}</span>
                    {preview.appStoreState && <StateBadge state={preview.appStoreState} />}
                  </div>
                )}
              </div>

              {/* ─── Action buttons ── */}
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={loadPreview} className={btnSecSm} disabled={previewLoading}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                    <path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  Refresh
                </button>
                <button
                  onClick={submitMetadata}
                  disabled={!!submitting || isActive}
                  className={btnSecondary}
                >
                  {submitting === "metadata" ? (
                    <><div className="spinner !w-3.5 !h-3.5" /> Submitting…</>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      Push Metadata
                    </>
                  )}
                </button>
                {preview.isEditable && preview.appStoreState === "PREPARE_FOR_SUBMISSION" && (
                  <>
                    <button
                      onClick={submitForReview}
                      disabled={!!submitting || isActive}
                      className={btnPrimary}
                    >
                      {submitting === "review" ? (
                        <><div className="spinner !w-3.5 !h-3.5" /> Submitting…</>
                      ) : (
                        <>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                            <path d="M22 2L11 13" /><path d="M22 2L15 22 11 13 2 9l20-7z" />
                          </svg>
                          Submit for Review
                        </>
                      )}
                    </button>
                    <button
                      onClick={submitForReviewAPI}
                      disabled={!!submitting}
                      className={btnSecSm}
                      title="Submit via App Store Connect API (no Fastlane required)"
                    >
                      {submitting === "review-api" ? "Submitting…" : "Review (API)"}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Submission status indicator */}
            {status && status.status !== "idle" && (
              <div className="mt-4 pt-4 border-t border-[#f3f4f6] dark:border-[#2a2f3d]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
                    <span className={`text-sm font-medium capitalize ${statusStyle.text}`}>
                      {status.status}
                    </span>
                    {status.jobId && (
                      <span className="text-[10px] text-gray-400 dark:text-[#5c6478] font-mono">
                        {status.jobId.slice(0, 8)}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowLogs(!showLogs)}
                    className="text-xs text-gray-400 dark:text-[#5c6478] hover:text-gray-600 dark:hover:text-[#8b93a5] transition-colors"
                  >
                    {showLogs ? "Hide Logs" : "Show Logs"}
                  </button>
                </div>

                {/* Error summary */}
                {status.errors.length > 0 && (
                  <div className="mt-2 p-2.5 bg-red-50 rounded-lg">
                    {status.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-600">{e}</p>
                    ))}
                  </div>
                )}

                {/* Log viewer */}
                {showLogs && status.logs.length > 0 && (
                  <div className="mt-3 bg-[#1a1a2e] rounded-xl p-4 max-h-64 overflow-y-auto font-mono text-xs text-gray-300">
                    {status.logs.map((line, i) => (
                      <div
                        key={i}
                        className={`py-0.5 ${
                          line.startsWith("[stderr]")
                            ? "text-yellow-400"
                            : line.includes("error") || line.includes("Error")
                            ? "text-red-400"
                            : line.includes("success") || line.includes("completed")
                            ? "text-emerald-400"
                            : ""
                        }`}
                      >
                        {line}
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── Locale Tabs ───────────────────────────────────────────── */}
          {preview.locales.length > 0 && (
            <div className={`${cardCls}`}>
              <div className="flex items-center gap-1 mb-5 border-b border-[#f3f4f6] dark:border-[#2a2f3d] pb-4 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-[#5c6478] mr-2">
                  Metadata Preview
                </span>
                {preview.locales.map((loc) => (
                  <button
                    key={loc.locale}
                    onClick={() => setActiveLocale(loc.locale)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      activeLocale === loc.locale
                        ? "bg-[#ea0e2b] text-white"
                        : "bg-gray-50 dark:bg-[#252b38] text-gray-600 dark:text-[#8b93a5] hover:bg-gray-100 dark:hover:bg-[#2a2f3d]"
                    }`}
                  >
                    {loc.locale}
                  </button>
                ))}
              </div>

              {selectedLocale && (
                <div className="space-y-4">
                  <MetadataField label="App Name" value={selectedLocale.name} maxLen={30} />
                  <MetadataField label="Subtitle" value={selectedLocale.subtitle} maxLen={30} />
                  <MetadataField label="Keywords" value={selectedLocale.keywords} maxLen={100} />
                  <MetadataField label="Description" value={selectedLocale.description} maxLen={4000} multiline />
                  <MetadataField label="Promotional Text" value={selectedLocale.promotionalText} maxLen={170} />
                  <MetadataField label="What's New" value={selectedLocale.whatsNew} maxLen={4000} multiline />
                </div>
              )}

              {preview.locales.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-[#5c6478] text-center py-8">
                  No locales configured. Add locales in Settings → ASO Locales.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Metadata field display ───────────────────────────────────────────────────

function MetadataField({
  label,
  value,
  maxLen,
  multiline,
}: {
  label: string;
  value: string;
  maxLen?: number;
  multiline?: boolean;
}) {
  const len = value.length;
  const overLimit = maxLen ? len > maxLen : false;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-500 dark:text-[#5c6478] uppercase tracking-wide">{label}</label>
        {maxLen && (
          <span className={`text-[10px] font-mono ${overLimit ? "text-red-500 font-semibold" : "text-gray-400 dark:text-[#5c6478]"}`}>
            {len}/{maxLen}
          </span>
        )}
      </div>
      {value ? (
        <div
          className={`px-3.5 py-2.5 bg-[#f8f9fb] dark:bg-[#252b38] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-xl text-[13px] text-[#111827] dark:text-[#e8eaf0] ${
            multiline ? "whitespace-pre-wrap font-mono text-xs max-h-48 overflow-y-auto" : "truncate"
          }`}
        >
          {value}
        </div>
      ) : (
        <div className="px-3.5 py-2.5 bg-[#f8f9fb] dark:bg-[#252b38] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-xl text-[13px] text-gray-400 dark:text-[#5c6478] italic">
          Not set
        </div>
      )}
    </div>
  );
}
