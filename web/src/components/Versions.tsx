import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  useApi,
  apiPost,
  authHeaders,
  getActiveBundleId,
} from "../hooks/useApi";
import {
  cardCls,
  inputCls,
  textareaCls,
  btnPrimary,
  btnSecondary,
  btnSecSm,
} from "../styles";
import type { VersionsData, VersionLocalization } from "../types";

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

const FIELD_META: {
  key: keyof VersionLocalization;
  label: string;
  type: "input" | "textarea";
  hint?: string;
  maxLength?: number;
  level: "app" | "version";
}[] = [
  {
    key: "name",
    label: "App Name",
    type: "input",
    hint: "Max 30 characters",
    maxLength: 30,
    level: "app",
  },
  {
    key: "subtitle",
    label: "Subtitle",
    type: "input",
    hint: "Max 30 characters",
    maxLength: 30,
    level: "app",
  },
  {
    key: "keywords",
    label: "Keywords",
    type: "textarea",
    hint: "Comma-separated, max 100 characters",
    maxLength: 100,
    level: "version",
  },
  {
    key: "description",
    label: "Description",
    type: "textarea",
    hint: "Max 4000 characters",
    maxLength: 4000,
    level: "version",
  },
  {
    key: "promotionalText",
    label: "Promotional Text",
    type: "textarea",
    hint: "Max 170 characters, can be updated without new version",
    maxLength: 170,
    level: "version",
  },
  {
    key: "whatsNew",
    label: "What's New",
    type: "textarea",
    hint: "Release notes for this version",
    maxLength: 4000,
    level: "version",
  },
];

const stateColors: Record<string, string> = {
  READY_FOR_SALE: "bg-emerald-50 text-emerald-700",
  PREPARE_FOR_SUBMISSION: "bg-amber-50 text-amber-700",
  WAITING_FOR_REVIEW: "bg-blue-50 text-blue-700",
  IN_REVIEW: "bg-violet-50 text-violet-700",
  REJECTED: "bg-red-50 text-red-600",
  DEVELOPER_REJECTED: "bg-red-50 text-red-600",
  METADATA_REJECTED: "bg-red-50 text-red-600",
};

function StateBadge({ state }: { state: string }) {
  const cls = stateColors[state] ?? "bg-gray-50 text-gray-600";
  const label = state
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

function EditableField({
  field,
  value,
  localization,
  isEditable,
  onSave,
}: {
  field: (typeof FIELD_META)[number];
  value: string;
  localization: VersionLocalization;
  isEditable: boolean;
  onSave: (
    field: string,
    value: string,
    loc: VersionLocalization,
  ) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      if (ref.current instanceof HTMLTextAreaElement) {
        ref.current.setSelectionRange(
          ref.current.value.length,
          ref.current.value.length,
        );
      }
    }
  }, [editing]);

  const handleSave = async () => {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(field.key, draft, localization);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
    }
    if (field.type === "input" && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (field.type === "textarea" && e.key === "Enter" && e.metaKey) {
      e.preventDefault();
      handleSave();
    }
  };

  const charCount = draft.length;
  const isOverLimit = field.maxLength ? charCount > field.maxLength : false;

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <label className="text-[12px] font-semibold text-[#6b7280] uppercase tracking-wide">
            {field.label}
          </label>
          <span className="text-[10px] text-[#c8cdd3] font-medium">
            {field.level === "app" ? "App Info" : "Version"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {field.maxLength && editing && (
            <span
              className={`text-[11px] font-mono ${isOverLimit ? "text-red-500 font-semibold" : "text-[#9ca3af]"}`}
            >
              {charCount}/{field.maxLength}
            </span>
          )}
          {!editing && isEditable && (
            <button
              onClick={() => setEditing(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-[#ea0e2b] font-medium hover:underline"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div>
          {field.type === "input" ? (
            <input
              ref={ref as React.RefObject<HTMLInputElement>}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              className={inputCls}
              maxLength={field.maxLength ? field.maxLength + 10 : undefined}
            />
          ) : (
            <textarea
              ref={ref as React.RefObject<HTMLTextAreaElement>}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`${textareaCls} min-h-[80px]`}
              rows={
                field.key === "description"
                  ? 8
                  : field.key === "whatsNew"
                    ? 4
                    : 3
              }
            />
          )}
          {field.hint && (
            <p className="text-[10px] text-[#c8cdd3] mt-1">{field.hint}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleSave}
              disabled={saving || isOverLimit}
              className="inline-flex items-center gap-1.5 px-3 py-[6px] rounded-xl text-xs font-medium bg-[#ea0e2b] text-white hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="spinner !w-3 !h-3" /> Saving…
                </>
              ) : (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-3.5 h-3.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Save to ASC
                </>
              )}
            </button>
            <button
              onClick={() => {
                setDraft(value);
                setEditing(false);
              }}
              disabled={saving}
              className="px-3 py-[6px] rounded-xl text-xs font-medium border border-[#eef0f3] bg-white text-[#6b7280] hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            {field.type === "textarea" && (
              <span className="text-[10px] text-[#c8cdd3] ml-auto">
                ⌘+Enter to save
              </span>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={() => isEditable && setEditing(true)}
          className={`text-[13px] text-[#111827] whitespace-pre-wrap break-words rounded-xl px-3.5 py-[9px] border border-[#eef0f3] bg-[#fafbfc] min-h-[38px] ${isEditable ? "cursor-pointer hover:border-[#d1d5db] transition-colors" : ""}`}
        >
          {value || <span className="text-[#c8cdd3] italic">Empty</span>}
        </div>
      )}
    </div>
  );
}

export default function Versions({ addToast }: Props) {
  const { versionId } = useParams<{ versionId: string }>();
  const apiPath = versionId
    ? `/asc/versions?versionId=${encodeURIComponent(versionId)}`
    : "/asc/versions";
  const { data, loading, error, refetch } = useApi<VersionsData>(apiPath, [
    versionId ?? "",
  ]);
  const [activeLocale, setActiveLocale] = useState<string | null>(null);

  // ─── Submission state ───────────────────────────────────────────────
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<{
    active: boolean;
    status: string;
    logs: string[];
    errors: string[];
    jobId?: string;
  } | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setActiveLocale(null);
  }, [versionId]);

  useEffect(() => {
    if (data?.localizations?.length && !activeLocale) {
      const enUs = data.localizations.find((l) => l.locale === "en-US");
      setActiveLocale(enUs?.locale ?? data.localizations[0].locale);
    }
  }, [data, activeLocale]);

  // ─── Submission polling ─────────────────────────────────────────────
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/submissions/status", {
        headers: authHeaders(),
      });
      if (res.ok) {
        const s = await res.json();
        setSubmitStatus(s);
        if (!s.active && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          // Refresh version data when submission finishes
          refetch();
        }
      }
    } catch {
      /* ignore */
    }
  }, [refetch]);

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

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [submitStatus?.logs?.length]);

  // ─── Submit actions ─────────────────────────────────────────────────
  const submitMetadata = async () => {
    setSubmitting("metadata");
    setShowLogs(true);
    try {
      const res = await apiPost("/submissions/metadata", {
        bundleId: getActiveBundleId(),
      });
      addToast(res.message || "Metadata push started", "success");
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
      const res = await apiPost("/submissions/review", {
        bundleId: getActiveBundleId(),
      });
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
      const res = await apiPost("/submissions/review-api", {
        bundleId: getActiveBundleId(),
      });
      addToast(res.message || "Submitted", res.ok ? "success" : "error");
      refetch();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setSubmitting(null);
    }
  };

  const isActive = submitStatus?.active === true;

  const handleSave = useCallback(
    async (field: string, value: string, loc: VersionLocalization) => {
      try {
        const res = await fetch("/api/asc/versions/metadata", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            appInfoLocalizationId: loc.appInfoLocalizationId,
            versionLocalizationId: loc.versionLocalizationId,
            field,
            value,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        addToast(`${field} updated successfully`, "success");
        refetch();
      } catch (err: any) {
        addToast(`Failed to update ${field}: ${err.message}`, "error");
        throw err;
      }
    },
    [addToast, refetch],
  );

  if (!versionId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="w-10 h-10 text-gray-300"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <p className="text-sm">Select a version from the sidebar</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
        <div className="spinner" /> Loading version data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-8 h-8 text-red-300"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-sm">{error}</p>
        <button
          onClick={refetch}
          className="text-[#ea0e2b] text-sm font-medium hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const activeLoc =
    data.localizations.find((l) => l.locale === activeLocale) ??
    data.localizations[0];

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#111827] mb-1">
            Versions
          </h1>
          <p className="text-sm text-[#9ca3af]">
            View and edit your App Store metadata. Changes are pushed to App
            Store Connect immediately.
          </p>
        </div>
        <button
          onClick={refetch}
          className="inline-flex items-center gap-1.5 px-3 py-[7px] rounded-xl border border-[#eef0f3] bg-white text-[#111827] text-[13px] font-medium transition-all hover:border-[#ea0e2b] hover:text-[#ea0e2b]"
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
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Version info card */}
      <div className={`${cardCls} mb-6`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-[#9ca3af] mb-0.5">
                Version
              </div>
              <div className="text-[15px] font-semibold text-[#111827]">
                {data.versionString ?? "—"}
              </div>
            </div>
            <div className="w-px h-8 bg-[#eef0f3]" />
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-[#9ca3af] mb-0.5">
                Status
              </div>
              {data.appStoreState ? (
                <StateBadge state={data.appStoreState} />
              ) : (
                <span className="text-[13px] text-[#9ca3af]">—</span>
              )}
            </div>
          </div>

          {/* ── Submit actions ── */}
          <div className="flex items-center gap-2 flex-wrap">
            {!data.isEditable && data.appStoreState === "READY_FOR_SALE" && (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg mr-1">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-3.5 h-3.5"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Live – read-only
              </div>
            )}
            <button
              onClick={submitMetadata}
              disabled={!!submitting || isActive}
              className={btnSecondary}
            >
              {submitting === "metadata" ? (
                <>
                  <div className="spinner !w-3.5 !h-3.5" /> Pushing…
                </>
              ) : (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Push Metadata
                </>
              )}
            </button>
            {data.isEditable &&
              (data.appStoreState === "PREPARE_FOR_SUBMISSION" || data.appStoreState === "DEVELOPER_REJECTED") && (
                <>
                  <button
                    onClick={submitForReview}
                    disabled={!!submitting || isActive}
                    className={btnPrimary}
                  >
                    {submitting === "review" ? (
                      <>
                        <div className="spinner !w-3.5 !h-3.5" /> Submitting…
                      </>
                    ) : (
                      <>
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-4 h-4"
                        >
                          <path d="M22 2L11 13" />
                          <path d="M22 2L15 22 11 13 2 9l20-7z" />
                        </svg>
                        Submit for Review
                      </>
                    )}
                  </button>
                  <button
                    onClick={submitForReviewAPI}
                    disabled={!!submitting}
                    className={btnSecSm}
                    title="Submit via App Store Connect API directly (no Fastlane needed)"
                  >
                    {submitting === "review-api"
                      ? "Submitting…"
                      : "Review (API)"}
                  </button>
                </>
              )}
          </div>
        </div>

        {/* ── Submission progress ── */}
        {submitStatus && submitStatus.status !== "idle" && (
          <div className="mt-4 pt-4 border-t border-[#f3f4f6]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    submitStatus.status === "preparing" ||
                    submitStatus.status === "running"
                      ? "bg-blue-500 animate-pulse"
                      : submitStatus.status === "completed"
                        ? "bg-emerald-500"
                        : submitStatus.status === "failed"
                          ? "bg-red-500"
                          : "bg-gray-300"
                  }`}
                />
                <span
                  className={`text-sm font-medium capitalize ${
                    submitStatus.status === "running" ||
                    submitStatus.status === "preparing"
                      ? "text-blue-600"
                      : submitStatus.status === "completed"
                        ? "text-emerald-600"
                        : submitStatus.status === "failed"
                          ? "text-red-600"
                          : "text-gray-500"
                  }`}
                >
                  Fastlane: {submitStatus.status}
                </span>
              </div>
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showLogs ? "Hide Logs" : "Show Logs"}
              </button>
            </div>
            {submitStatus.errors.length > 0 && (
              <div className="mt-2 p-2.5 bg-red-50 rounded-lg">
                {submitStatus.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">
                    {e}
                  </p>
                ))}
              </div>
            )}
            {showLogs && submitStatus.logs.length > 0 && (
              <div className="mt-3 bg-[#1a1a2e] rounded-xl p-4 max-h-56 overflow-y-auto font-mono text-xs text-gray-300">
                {submitStatus.logs.map((line, i) => (
                  <div
                    key={i}
                    className={`py-0.5 ${
                      line.startsWith("[stderr]")
                        ? "text-yellow-400"
                        : line.toLowerCase().includes("error")
                          ? "text-red-400"
                          : line.toLowerCase().includes("success") ||
                              line.toLowerCase().includes("completed")
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

      {/* Locale tabs */}
      {data.localizations.length > 1 && (
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
          {data.localizations.map((loc) => (
            <button
              key={loc.locale}
              onClick={() => setActiveLocale(loc.locale)}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all whitespace-nowrap ${
                loc.locale === activeLocale
                  ? "bg-[#ea0e2b] text-white"
                  : "bg-white border border-[#eef0f3] text-[#6b7280] hover:border-[#d1d5db] hover:text-[#111827]"
              }`}
            >
              {loc.locale}
            </button>
          ))}
        </div>
      )}

      {/* Metadata fields */}
      {activeLoc && (
        <div className={`${cardCls} flex flex-col gap-6`}>
          <div className="flex items-center justify-between pb-2 border-b border-[#f3f4f6]">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-[#111827]">
                {activeLoc.locale}
              </span>
              <span className="text-[11px] text-[#9ca3af]">Localization</span>
            </div>
            {data.isEditable && (
              <span className="text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                Editable
              </span>
            )}
          </div>

          {FIELD_META.map((field) => (
            <EditableField
              key={field.key}
              field={field}
              value={(activeLoc as any)[field.key] ?? ""}
              localization={activeLoc}
              isEditable={data.isEditable || field.key === "promotionalText"}
              onSave={handleSave}
            />
          ))}
        </div>
      )}

      {data.localizations.length === 0 && (
        <div
          className={`${cardCls} flex flex-col items-center justify-center py-12 text-center`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="w-10 h-10 text-gray-300 mb-3"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <p className="text-sm text-[#9ca3af]">
            No localizations found for this version.
          </p>
        </div>
      )}

      <ScreenshotsPanel appId={data.appId} activeLocale={activeLocale} />
    </div>
  );
}

// ─── Screenshots Panel ────────────────────────────────────────────────────────

interface FramedJob {
  id: string;
  commitSha: string;
  commitMessage: string | null;
  branch: string | null;
  createdAt: string;
  framedByLocale: Record<string, string[]>;
}

function ScreenshotsPanel({
  appId,
  activeLocale,
}: {
  appId: string;
  activeLocale: string | null;
}) {
  const { data, loading } = useApi<{ job: FramedJob | null }>(
    `/github/screenshots/latest-framed/${appId}`,
    [appId],
  );

  const job = data?.job;
  const framedByLocale = job?.framedByLocale ?? {};
  const locales = Object.keys(framedByLocale).filter(
    (l) => (framedByLocale[l]?.length ?? 0) > 0,
  );

  const [selectedLocale, setSelectedLocale] = useState<string | null>(null);

  // Sync with active metadata locale when possible
  const effectiveLocale =
    selectedLocale ??
    (activeLocale && locales.includes(activeLocale)
      ? activeLocale
      : locales[0] ?? null);

  if (loading) return null;
  if (!job || locales.length === 0) return null;

  const screenshots = effectiveLocale ? (framedByLocale[effectiveLocale] ?? []) : [];

  return (
    <div className={`${cardCls} mt-6`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[#111827]">
            App Store Screenshots
          </h2>
          <p className="text-xs text-[#9ca3af] mt-0.5">
            Latest framed set — commit{" "}
            <span className="font-mono">{job.commitSha.slice(0, 7)}</span>
            {job.branch ? ` · ${job.branch}` : ""}
            {" · "}
            {new Date(job.createdAt).toLocaleDateString()}
          </p>
        </div>
        {locales.length > 1 && (
          <div className="flex items-center gap-1 overflow-x-auto">
            {locales.map((l) => (
              <button
                key={l}
                onClick={() => setSelectedLocale(l)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap ${
                  l === effectiveLocale
                    ? "bg-[#ea0e2b] text-white"
                    : "bg-white border border-[#eef0f3] text-[#6b7280] hover:border-[#d1d5db]"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        )}
      </div>

      {locales.length === 1 && (
        <div className="text-[11px] text-[#9ca3af] mb-3">{effectiveLocale}</div>
      )}

      {screenshots.length === 0 ? (
        <p className="text-sm text-[#9ca3af] py-4 text-center">
          No screenshots for {effectiveLocale}.
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {screenshots.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <img
                src={url}
                alt="App Store screenshot"
                className="h-64 rounded-xl border border-[#eef0f3] object-cover hover:opacity-90 transition-opacity shadow-sm"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
