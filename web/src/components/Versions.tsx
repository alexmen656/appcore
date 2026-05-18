import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { useApi, apiGet, apiPost, apiPatch, apiDelete, getActiveBundleId } from "../hooks/useApi";
import { usePermissions } from "../hooks/usePermissions";
import {
  badgeOutline,
  borderDefault,
  cardCls,
  inputCls,
  pageTitle,
  textMuted,
  textPrimary,
  textSecondary,
  textareaCls,
} from "../styles";
import type { VersionsData, VersionLocalization, VersionLocalizationSummary } from "../types";
import { getLocaleFlag, getLocaleName } from "../utils/localeUtils";
import { useClickOutside } from "../hooks/useClickOutside";
import {
  Send,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Upload,
  RefreshCw,
  RefreshCcw,
  Check,
  Store,
  FileText,
  Calendar,
  AlertCircle,
  Plus,
  X,
  ShieldCheck,
} from "lucide-react";

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

interface FramedJob {
  id: string;
  commitSha: string;
  commitMessage: string | null;
  branch: string | null;
  createdAt: string;
  framedByLocale: Record<string, string[]>;
}

const FIELD_META: {
  key: keyof VersionLocalization;
  label: string;
  type: "input" | "textarea";
  hint?: string;
  maxLength?: number;
}[] = [
  {
    key: "name",
    label: "App Name",
    type: "input",
    hint: "Max 30 characters",
    maxLength: 30,
  },
  {
    key: "subtitle",
    label: "Subtitle",
    type: "input",
    hint: "Max 30 characters",
    maxLength: 30,
  },
  {
    key: "keywords",
    label: "Keywords",
    type: "textarea",
    hint: "Comma-separated, max 100 characters",
    maxLength: 100,
  },
  {
    key: "description",
    label: "Description",
    type: "textarea",
    hint: "Max 4000 characters",
    maxLength: 4000,
  },
  {
    key: "promotionalText",
    label: "Promotional Text",
    type: "textarea",
    hint: "Max 170 characters, can be updated without new version",
    maxLength: 170,
  },
  {
    key: "whatsNew",
    label: "What's New",
    type: "textarea",
    hint: "Release notes for this version",
    maxLength: 4000,
  },
  {
    key: "supportUrl",
    label: "Support URL",
    type: "input",
    hint: "URL to your support page",
  },
  {
    key: "privacyPolicyUrl",
    label: "Privacy Policy URL",
    type: "input",
    hint: "URL to your privacy policy",
  },
  {
    key: "marketingUrl",
    label: "Marketing URL",
    type: "input",
    hint: "URL to your app's marketing page",
  },
];

const EMPTY_LOCALIZATION_FIELDS = {
  name: "",
  subtitle: "",
  keywords: "",
  description: "",
  whatsNew: "",
  promotionalText: "",
  supportUrl: "",
  privacyPolicyUrl: "",
  marketingUrl: "",
};

function mergeVersionData(current: VersionsData | null, next: VersionsData, updateSummaries = false): VersionsData {
  if (!current || current.versionId !== next.versionId) return next;

  const localizations = [...current.localizations];
  for (const loc of next.localizations) {
    const index = localizations.findIndex((existing) => existing.locale === loc.locale);
    if (index >= 0) localizations[index] = loc;
    else localizations.push(loc);
  }

  return {
    ...current,
    ...next,
    localizationSummaries: updateSummaries ? next.localizationSummaries : current.localizationSummaries,
    localizations,
  };
}

function LocaleFlag({ locale, className }: { locale: string; className?: string }) {
  return (
    <img
      src={`/country-flags/${getLocaleFlag(locale)}.svg`}
      alt=""
      className={className ?? "h-[14px] w-auto object-contain shrink-0 rounded-xs"}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

const DEVICES: [RegExp, string][] = [
  [/iphone[_-]?6\.9/i, 'iPhone 6.9"'],
  [/iphone[_-]?6\.7/i, 'iPhone 6.7"'],
  [/iphone[_-]?6\.5/i, 'iPhone 6.5"'],
  [/iphone[_-]?6\.3/i, 'iPhone 6.3"'],
  [/iphone[_-]?5\.5/i, 'iPhone 5.5"'],
  [/iphone[_-]?4\.7/i, 'iPhone 4.7"'],
  [/ipad[_-]?13/i, 'iPad 13"'],
  [/ipad[_-]?12\.9/i, 'iPad 12.9"'],
  [/ipad[_-]?11/i, 'iPad 11"'],
  [/ipad/i, "iPad"],
];

function getDeviceLabel(url: string): string {
  const filename = decodeURIComponent(url.split("/").pop() ?? url);

  for (const [re, label] of DEVICES) {
    if (re.test(filename)) return label;
  }
  return "Other";
}

const SUBMIT_STATUS_DEFAULT = { dot: "bg-gray-300", text: "text-gray-500" };
const SUBMIT_STATUS_COLORS: Record<string, { dot: string; text: string }> = {
  preparing: { dot: "bg-blue-500 animate-pulse", text: "text-blue-600" },
  running: { dot: "bg-blue-500 animate-pulse", text: "text-blue-600" },
  completed: { dot: "bg-emerald-500", text: "text-emerald-600" },
  failed: { dot: "bg-red-500", text: "text-red-600" },
};

function StateBadge({ state }: { state: string }) {
  const label = state.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return <span className={badgeOutline(state)}>{label}</span>;
}

function ActionButton({
  canSubmitForReview,
  submitting,
  isActive,
  onSubmitForReview,
  onPushMetadata,
  onUploadBinary,
  onRefetch,
  onSync,
}: {
  canSubmitForReview: boolean;
  submitting: string | null;
  isActive: boolean;
  onSubmitForReview: () => void;
  onPushMetadata: () => void;
  onUploadBinary: () => void;
  onRefetch: () => void;
  onSync: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const busy = !!submitting || isActive;

  useClickOutside(ref, () => setOpen(false));

  if (canSubmitForReview) {
    return (
      <div ref={ref} className="relative flex items-stretch">
        <button
          onClick={onSubmitForReview}
          disabled={busy}
          className="inline-flex items-center gap-2 pl-4 pr-3 py-[9px] rounded-l-xl text-[13px] font-semibold bg-[#D94412] text-white hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting === "review" ? (
            <>
              <div className="spinner !w-3.5 !h-3.5" /> Submitting…
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Submit for Review
            </>
          )}
        </button>
        <div className="w-px bg-[#c80b24] opacity-40" />
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={busy}
          className="px-2.5 rounded-r-xl bg-[#D94412] text-white hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="More actions"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div
            className={`absolute right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#1c2028] border ${borderDefault} rounded-xl shadow-lg py-1 min-w-[180px]`}
          >
            <button
              onClick={() => {
                setOpen(false);
                onPushMetadata();
              }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] ${textPrimary} hover:bg-[#fafbfc] dark:hover:bg-[#252b38] transition-colors text-left`}
            >
              <Upload className={`w-4 h-4 ${textSecondary}`} />
              Push Metadata
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onUploadBinary();
              }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] ${textPrimary} hover:bg-[#fafbfc] dark:hover:bg-[#252b38] transition-colors text-left`}
            >
              <Upload className={`w-4 h-4 ${textSecondary}`} />
              Upload Binary
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onRefetch();
              }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] ${textPrimary} hover:bg-[#fafbfc] dark:hover:bg-[#252b38] transition-colors text-left`}
            >
              <RefreshCw className={`w-4 h-4 ${textSecondary}`} />
              Reload
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onSync();
              }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] ${textPrimary} hover:bg-[#fafbfc] dark:hover:bg-[#252b38] transition-colors text-left`}
            >
              <RefreshCcw className={`w-4 h-4 ${textSecondary}`} />
              Sync from App Store
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative flex items-stretch">
      <button
        onClick={onPushMetadata}
        disabled={busy}
        className={`inline-flex items-center gap-2 pl-3.5 pr-3 py-[8px] rounded-l-xl text-[13px] font-medium border ${borderDefault} bg-white dark:bg-[#1c2028] ${textPrimary} hover:border-[#D94412] hover:text-[#D94412] transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {submitting === "metadata" ? (
          <>
            <div className="spinner !w-3.5 !h-3.5" /> Pushing…
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            Push Metadata
          </>
        )}
      </button>
      <div className="w-px bg-[#eef0f3]" />
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className={`px-2.5 rounded-r-xl border border-l-0 ${borderDefault} bg-white dark:bg-[#1c2028] ${textSecondary} hover:border-[#D94412] hover:text-[#D94412] transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-label="More actions"
      >
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          className={`absolute right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#1c2028] border ${borderDefault} rounded-xl shadow-lg py-1 min-w-[160px]`}
        >
          <button
            onClick={() => {
              setOpen(false);
              onUploadBinary();
            }}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] ${textPrimary} hover:bg-[#fafbfc] dark:hover:bg-[#252b38] transition-colors text-left`}
          >
            <Upload className={`w-4 h-4 ${textSecondary}`} />
            Upload Binary
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onRefetch();
            }}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] ${textPrimary} hover:bg-[#fafbfc] dark:hover:bg-[#252b38] transition-colors text-left`}
          >
            <RefreshCw className={`w-4 h-4 ${textSecondary}`} />
            Reload
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onSync();
            }}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] ${textPrimary} hover:bg-[#fafbfc] dark:hover:bg-[#252b38] transition-colors text-left`}
          >
            <RefreshCcw className={`w-4 h-4 ${textSecondary}`} />
            Sync from App Store
          </button>
        </div>
      )}
    </div>
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
  onSave: (field: string, value: string, loc: VersionLocalization) => Promise<void>;
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
        ref.current.setSelectionRange(ref.current.value.length, ref.current.value.length);
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
  const nearLimit = field.maxLength ? charCount > field.maxLength * 0.9 : false;

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <label className={`text-[12px] font-semibold ${textSecondary} uppercase tracking-wide`}>{field.label}</label>
        </div>
        <div className="flex items-center gap-2">
          {field.maxLength && editing && (
            <span
              className={`text-[11px] font-mono tabular-nums ${isOverLimit ? "text-red-500 font-bold" : nearLimit ? "text-amber-500" : "text-[#9ca3af]"}`}
            >
              {charCount}/{field.maxLength}
            </span>
          )}
          {!editing && isEditable && (
            <button
              onClick={() => setEditing(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-[#D94412] font-medium hover:underline"
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
              rows={field.key === "description" ? 8 : field.key === "whatsNew" ? 4 : 3}
            />
          )}
          {field.hint && <p className="text-[10px] text-[#c8cdd3] mt-1">{field.hint}</p>}
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleSave}
              disabled={saving || isOverLimit}
              className="inline-flex items-center gap-1.5 px-3 py-[6px] rounded-xl text-xs font-semibold bg-[#D94412] text-white hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="spinner !w-3 !h-3" /> Saving…
                </>
              ) : (
                <>
                  <Check className="w-3 h-3" /> Save
                </>
              )}
            </button>
            <button
              onClick={() => {
                setDraft(value);
                setEditing(false);
              }}
              disabled={saving}
              className={`px-3 py-[6px] rounded-xl text-xs font-medium border ${borderDefault} bg-white dark:bg-[#1c2028] ${textSecondary} hover:bg-gray-50 dark:hover:bg-[#252b38] transition-all`}
            >
              Cancel
            </button>
            {field.type === "textarea" && (
              <span className="text-[10px] text-[#c8cdd3] dark:text-[#3a4050] ml-auto">⌘+Enter to save</span>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={() => isEditable && setEditing(true)}
          className={`text-[13px] ${textPrimary} whitespace-pre-wrap break-words rounded-xl px-3.5 py-[9px] border ${borderDefault} bg-[#fafbfc] dark:bg-[#252b38] min-h-[38px] ${
            isEditable
              ? "cursor-pointer hover:border-[#d1d5db] dark:hover:border-[#3a4050] hover:bg-white dark:hover:bg-[#1c2028] transition-colors"
              : ""
          }`}
        >
          {value || <span className="text-[#c8cdd3] dark:text-[#3a4050] italic">Empty</span>}
        </div>
      )}
    </div>
  );
}

function InlineEditField({
  label,
  value,
  isEditable,
  onSave,
}: {
  label: string;
  value: string;
  isEditable: boolean;
  onSave: (val: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = async () => {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1.5">
        <label className={`text-[12px] font-semibold ${textSecondary} uppercase tracking-wide`}>{label}</label>
        {!editing && isEditable && (
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-[#D94412] font-medium hover:underline"
          >
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setDraft(value);
                setEditing(false);
              }
              if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
            }}
            className={inputCls}
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-[6px] rounded-xl text-xs font-semibold bg-[#D94412] text-white hover:bg-[#c80b24] transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="spinner !w-3 !h-3" /> Saving…
                </>
              ) : (
                "Save"
              )}
            </button>
            <button
              onClick={() => {
                setDraft(value);
                setEditing(false);
              }}
              className={`px-3 py-[6px] rounded-xl text-xs font-medium border ${borderDefault} bg-white dark:bg-[#1c2028] ${textSecondary} hover:bg-gray-50 dark:hover:bg-[#252b38] transition-all`}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => isEditable && setEditing(true)}
          className={`text-[13px] ${textPrimary} rounded-xl px-3.5 py-[9px] border ${borderDefault} bg-[#fafbfc] dark:bg-[#252b38] min-h-[38px] ${
            isEditable
              ? "cursor-pointer hover:border-[#d1d5db] dark:hover:border-[#3a4050] hover:bg-white dark:hover:bg-[#1c2028] transition-colors"
              : ""
          }`}
        >
          {value || <span className="text-[#c8cdd3] dark:text-[#3a4050] italic">Empty</span>}
        </div>
      )}
    </div>
  );
}

interface LatestBuild {
  builtAt: string;
  originalFilename: string;
  bundleId: string;
  exportMethod: string;
  sizeBytes: number;
  iconUrl: string | null;
}

function LatestBuildCard({ bundleId, appName }: { bundleId: string; appName: string }) {
  const { data, loading } = useApi<{ build: LatestBuild | null }>(
    `/submissions/build-info?bundleId=${encodeURIComponent(bundleId)}`,
    [bundleId],
  );

  if (loading || !data?.build) return null;
  const build = data.build;

  const sizeMb = (build.sizeBytes / 1024 / 1024).toFixed(1);
  const builtDate = new Date(build.builtAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className={`${cardCls} mb-5`}>
      <div className={`text-[14px] font-bold mb-3 ${textPrimary}`}>Latest Build</div>
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          {build.iconUrl ? (
            <img
              src={build.iconUrl}
              alt={appName}
              className={`w-16 h-16 rounded-[16px] border ${borderDefault} shadow-sm object-cover`}
            />
          ) : (
            <div
              className={`w-16 h-16 rounded-[16px] bg-[#f3f4f6] dark:bg-[#252b38] border ${borderDefault} flex items-center justify-center`}
            >
              <Store className="w-6 h-6 text-[#9ca3af]" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className={`text-[14px] font-semibold ${textPrimary} leading-tight`}>{appName}</div>
              <div className={`text-[11px] ${textMuted} font-mono mt-0.5`}>{build.bundleId}</div>
            </div>
            <span className={`${badgeOutline("sandbox")} shrink-0 uppercase tracking-wide`}>{build.exportMethod}</span>
          </div>

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className={`flex items-center gap-1 text-[12px] ${textSecondary}`}>
              <FileText className="w-3.5 h-3.5 shrink-0" />
              {sizeMb} MB
            </span>
            <span className={`flex items-center gap-1 text-[12px] ${textSecondary}`}>
              <Calendar className="w-3.5 h-3.5" />
              {builtDate}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScreenshotsPanel({
  appId,
  activeLocale,
  addToast,
}: {
  appId: string;
  activeLocale: string | null;
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}) {
  const { canWrite } = usePermissions();
  const { data, loading, refetch } = useApi<{ job: FramedJob | null }>(`/github/screenshots/latest-framed/${appId}`, [
    appId,
  ]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [orderOverride, setOrderOverride] = useState<Record<string, string[]>>({});
  const [draggingUrl, setDraggingUrl] = useState<string | null>(null);
  const [dragOverUrl, setDragOverUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setOrderOverride({});
  }, [data?.job?.id]);

  useEffect(() => {
    if (!previewUrl) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewUrl(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewUrl]);

  const deleteScreenshot = async (jobId: string, url: string) => {
    if (!canWrite) return;
    if (!confirm("Remove this screenshot?")) return;

    setDeleting(url);
    try {
      await apiDelete(`/github/screenshots/framed/${jobId}`, { url });
      addToast("Screenshot removed", "success");
      refetch();
    } catch (err: any) {
      addToast(`Failed to remove: ${err.message}`, "error");
    } finally {
      setDeleting(null);
    }
  };

  const persistOrder = async (jobId: string, locale: string, urls: string[]) => {
    if (!canWrite) return;
    try {
      await apiPatch(`/github/screenshots/framed/${jobId}/reorder`, { locale, urls });
    } catch (err: any) {
      addToast(`Failed to reorder: ${err.message}`, "error");
      setOrderOverride((prev) => {
        const next = { ...prev };
        delete next[locale];
        return next;
      });
    }
  };

  const job = data?.job;
  const framedByLocale = job?.framedByLocale ?? {};
  const locales = Object.keys(framedByLocale).filter((l) => (framedByLocale[l]?.length ?? 0) > 0);
  const effectiveLocale = activeLocale && locales.includes(activeLocale) ? activeLocale : (locales[0] ?? null);

  if (loading || !job || locales.length === 0) return null;

  const screenshots = effectiveLocale ? (orderOverride[effectiveLocale] ?? framedByLocale[effectiveLocale] ?? []) : [];
  const grouped = new Map<string, string[]>();

  for (const url of screenshots) {
    const label = getDeviceLabel(url);
    if (!grouped.has(label)) grouped.set(label, []);
    grouped.get(label)!.push(url);
  }

  const deviceOrder = (label: string) => {
    const idx = DEVICES.findIndex(([, l]) => l === label);
    return idx === -1 ? 99 : idx;
  };

  const sortedGroups = [...grouped.entries()].sort(([a], [b]) => deviceOrder(a) - deviceOrder(b));

  const handleDrop = (targetUrl: string) => {
    const sourceUrl = draggingUrl;
    setDraggingUrl(null);
    setDragOverUrl(null);
    if (!sourceUrl || !effectiveLocale || sourceUrl === targetUrl) return;
    if (getDeviceLabel(sourceUrl) !== getDeviceLabel(targetUrl)) return;

    const next = [...screenshots];
    const from = next.indexOf(sourceUrl);
    const to = next.indexOf(targetUrl);
    if (from === -1 || to === -1) return;
    next.splice(from, 1);
    next.splice(to, 0, sourceUrl);

    setOrderOverride((prev) => ({ ...prev, [effectiveLocale]: next }));
    persistOrder(job.id, effectiveLocale, next);
  };

  const previewIndex = previewUrl ? screenshots.indexOf(previewUrl) : -1;
  const previewLabel = previewUrl ? getDeviceLabel(previewUrl) : "";
  const showPreviousPreview = () => {
    if (previewIndex <= -1 || screenshots.length === 0) return;
    setPreviewUrl(screenshots[(previewIndex - 1 + screenshots.length) % screenshots.length]);
  };
  const showNextPreview = () => {
    if (previewIndex <= -1 || screenshots.length === 0) return;
    setPreviewUrl(screenshots[(previewIndex + 1) % screenshots.length]);
  };

  return (
    <>
      <div className="pb-5 border-b border-[#f3f4f6] dark:border-[#2a2f3d]">
        <div className="flex items-center justify-between mb-4">
          <div className={`text-[14px] font-bold ${textPrimary}`}>Screenshots</div>
          <span className={`text-[11px] ${textSecondary} font-mono`}>
            {job.commitSha.slice(0, 7)}
            {job.branch ? ` · ${job.branch}` : ""}
            {effectiveLocale ? ` · ${effectiveLocale}` : ""}
          </span>
        </div>

        {screenshots.length === 0 ? (
          <p className="text-[12px] text-[#9ca3af] py-3 text-center">No screenshots for {effectiveLocale}.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {sortedGroups.map(([label, urls]) => (
              <div key={label}>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className={`text-[11px] font-bold ${textMuted}`}>{label}</div>
                  <span className="text-[10px] text-[#c8cdd3] dark:text-[#3a4050]">- max 10</span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {urls.map((url) => {
                    const isDragging = draggingUrl === url;
                    const isDropTarget =
                      dragOverUrl === url &&
                      draggingUrl &&
                      draggingUrl !== url &&
                      getDeviceLabel(draggingUrl) === label;
                    return (
                      <div
                        key={url}
                        draggable
                        onDragStart={(e) => {
                          setDraggingUrl(url);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDraggingUrl(null);
                          setDragOverUrl(null);
                        }}
                        onDragOver={(e) => {
                          if (!draggingUrl || draggingUrl === url) return;
                          if (getDeviceLabel(draggingUrl) !== label) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dragOverUrl !== url) setDragOverUrl(url);
                        }}
                        onDragLeave={() => {
                          if (dragOverUrl === url) setDragOverUrl(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleDrop(url);
                        }}
                        className={`relative shrink-0 group/img cursor-grab active:cursor-grabbing transition-all ${
                          isDragging ? "opacity-40" : ""
                        } ${isDropTarget ? "ring-2 ring-[#D94412] ring-offset-2 rounded-xl" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => setPreviewUrl(url)}
                          className="block text-left"
                          aria-label={`Open ${label} screenshot preview`}
                        >
                          <img
                            src={url}
                            alt={`${label} screenshot`}
                            draggable={false}
                            className="h-[200px] w-auto rounded-xl border border-[#eef0f3] object-cover shadow-sm group-hover/img:shadow-md group-hover/img:opacity-90 transition-all"
                          />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            deleteScreenshot(job.id, url);
                          }}
                          disabled={deleting === url}
                          title="Remove screenshot"
                          className="absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover/img:opacity-100 hover:bg-red-600 transition-all disabled:opacity-50"
                        >
                          {deleting === url ? <div className="spinner !w-3.5 !h-3.5" /> : <X className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {previewUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 py-6"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-4 text-white">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold truncate">{previewLabel}</div>
              {effectiveLocale && (
                <div className="text-[11px] text-white/60 font-mono">
                  {effectiveLocale}
                  {previewIndex > -1 ? ` · ${previewIndex + 1}/${screenshots.length}` : ""}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewUrl(null);
              }}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Close screenshot preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {screenshots.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  showPreviousPreview();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                aria-label="Previous screenshot"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  showNextPreview();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                aria-label="Next screenshot"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          <img
            src={previewUrl}
            alt={`${previewLabel} screenshot preview`}
            className="max-h-[88vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

function ReviewerInfoPanel({
  data,
  addToast,
  onRefetch,
}: {
  data: VersionsData;
  addToast: (msg: string, type: "success" | "error" | "info") => void;
  onRefetch: () => void;
}) {
  const { canWrite } = usePermissions();
  const [form, setForm] = useState({
    reviewerFirstName: data.reviewerFirstName ?? "",
    reviewerLastName: data.reviewerLastName ?? "",
    reviewerPhone: data.reviewerPhone ?? "",
    reviewerEmail: data.reviewerEmail ?? "",
    reviewerDemoAccountRequired: data.reviewerDemoAccountRequired ?? false,
    reviewerDemoUsername: data.reviewerDemoUsername ?? "",
    reviewerDemoPassword: data.reviewerDemoPassword ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setForm({
      reviewerFirstName: data.reviewerFirstName ?? "",
      reviewerLastName: data.reviewerLastName ?? "",
      reviewerPhone: data.reviewerPhone ?? "",
      reviewerEmail: data.reviewerEmail ?? "",
      reviewerDemoAccountRequired: data.reviewerDemoAccountRequired ?? false,
      reviewerDemoUsername: data.reviewerDemoUsername ?? "",
      reviewerDemoPassword: data.reviewerDemoPassword ?? "",
    });
    setDirty(false);
  }, [data.versionId]);

  const set = (key: keyof typeof form, value: any) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!data.versionId || !canWrite) return;
    setSaving(true);
    try {
      await apiPatch("/asc/versions/reviewer-info", {
        bundleId: getActiveBundleId(),
        versionId: data.versionId,
        ...form,
      });
      addToast("Reviewer info saved to App Store Connect", "success");
      setDirty(false);
      onRefetch();
    } catch (err: any) {
      addToast(`Failed to save: ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    if (!data.versionId || !canWrite) return;
    setSyncing(true);
    try {
      await apiPost("/asc/versions/reviewer-info/sync", {
        bundleId: getActiveBundleId(),
        versionId: data.versionId,
      });
      addToast("Reviewer info synced from App Store Connect", "success");
      onRefetch();
    } catch (err: any) {
      addToast(`Sync failed: ${err.message}`, "error");
    } finally {
      setSyncing(false);
    }
  };

  if (!data.versionId) return null;

  return (
    <div className={`${cardCls} mt-5`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className={`w-4 h-4 ${textMuted}`} />
          <span className={`text-[14px] font-bold ${textPrimary}`}>App Review Contact</span>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${borderDefault} bg-transparent text-[12px] ${textSecondary} hover:border-[#D94412] hover:text-[#D94412] transition-all disabled:opacity-50`}
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
          Sync from ASC
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={`text-[12px] font-semibold ${textSecondary} uppercase tracking-wide block mb-1.5`}>
            First Name
          </label>
          <input
            type="text"
            className={inputCls}
            value={form.reviewerFirstName}
            onChange={(e) => set("reviewerFirstName", e.target.value)}
            placeholder="Max"
          />
        </div>
        <div>
          <label className={`text-[12px] font-semibold ${textSecondary} uppercase tracking-wide block mb-1.5`}>
            Last Name
          </label>
          <input
            type="text"
            className={inputCls}
            value={form.reviewerLastName}
            onChange={(e) => set("reviewerLastName", e.target.value)}
            placeholder="Mustermann"
          />
        </div>
        <div>
          <label className={`text-[12px] font-semibold ${textSecondary} uppercase tracking-wide block mb-1.5`}>
            Phone Number
          </label>
          <input
            type="tel"
            className={inputCls}
            value={form.reviewerPhone}
            onChange={(e) => set("reviewerPhone", e.target.value)}
            placeholder="+49 151 12345678"
          />
        </div>
        <div>
          <label className={`text-[12px] font-semibold ${textSecondary} uppercase tracking-wide block mb-1.5`}>
            E-Mail
          </label>
          <input
            type="email"
            className={inputCls}
            value={form.reviewerEmail}
            onChange={(e) => set("reviewerEmail", e.target.value)}
            placeholder="review@yourcompany.com"
          />
        </div>

        <div className="col-span-2 flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.reviewerDemoAccountRequired}
              onChange={(e) => set("reviewerDemoAccountRequired", e.target.checked)}
              className="w-4 h-4 rounded accent-[#D94412] dark:[color-scheme:dark]"
            />
            <span className={`text-[13px] ${textPrimary}`}>Login required (Demo Account)</span>
          </label>
        </div>

        {form.reviewerDemoAccountRequired && (
          <>
            <div>
              <label className={`text-[12px] font-semibold ${textSecondary} uppercase tracking-wide block mb-1.5`}>
                Demo Username
              </label>
              <input
                type="text"
                className={inputCls}
                value={form.reviewerDemoUsername}
                onChange={(e) => set("reviewerDemoUsername", e.target.value)}
                placeholder="demo@example.com"
              />
            </div>
            <div>
              <label className={`text-[12px] font-semibold ${textSecondary} uppercase tracking-wide block mb-1.5`}>
                Demo Password
              </label>
              <input
                type="password"
                autoComplete="off"
                className={inputCls}
                value={form.reviewerDemoPassword}
                onChange={(e) => set("reviewerDemoPassword", e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </>
        )}
      </div>

      {dirty && (
        <div className="flex justify-end mt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium bg-gradient-to-br from-[#D94412] to-[#C4001E] text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="spinner w-3.5 h-3.5" /> Saving…
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" /> Save to App Store Connect
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Versions({ addToast }: Props) {
  const { canWrite } = usePermissions();
  const { versionId } = useParams<{ versionId: string }>();
  const apiPath = versionId ? `/asc/versions?versionId=${encodeURIComponent(versionId)}` : "/asc/versions";
  const { data: fetchedData, loading, error, refetch } = useApi<VersionsData>(apiPath, [versionId ?? ""]);
  const { data: ascLocales } = useApi<string[]>("/asc/supported-locales", [], true);
  const [data, setData] = useState<VersionsData | null>(null);
  const [activeLocale, setActiveLocale] = useState<string | null>(null);
  const [showAddLocale, setShowAddLocale] = useState(false);
  const [addingLocale, setAddingLocale] = useState(false);
  const [removingLocale, setRemovingLocale] = useState<string | null>(null);
  const [visibleLoadingLocale, setVisibleLoadingLocale] = useState<string | null>(null);
  const addLocaleRef = useRef<HTMLDivElement>(null);
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
  const [translatingLocales, setTranslatingLocales] = useState<string[]>([]);
  const translationPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localeLoadingDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setActiveLocale(null);
    setData(null);
  }, [versionId]);

  useEffect(() => {
    setData(fetchedData);
  }, [fetchedData]);

  useEffect(() => {
    if (!data || activeLocale) return;
    const loadedLocale = data.localizations[0]?.locale;
    if (loadedLocale) setActiveLocale(loadedLocale);
  }, [data, activeLocale]);

  const loadLocalization = useCallback(
    async (locale: string, force = false, activateAfterLoad = false, updateSummaries = false) => {
      if (!data?.versionId) return;
      if (!force && data.localizations.some((loc) => loc.locale === locale)) {
        setActiveLocale(locale);
        return;
      }

      if (localeLoadingDelayRef.current) clearTimeout(localeLoadingDelayRef.current);
      localeLoadingDelayRef.current = setTimeout(() => {
        setVisibleLoadingLocale(locale);
      }, 250);

      try {
        const next = await apiGet<VersionsData>("/asc/versions", {
          versionId: data.versionId,
          locale,
        });
        setData((current) => mergeVersionData(current, next, updateSummaries));
        if (activateAfterLoad) setActiveLocale(locale);
      } catch (err: any) {
        addToast(`Failed to load ${locale}: ${err.message}`, "error");
      } finally {
        if (localeLoadingDelayRef.current) {
          clearTimeout(localeLoadingDelayRef.current);
          localeLoadingDelayRef.current = null;
        }
        setVisibleLoadingLocale(null);
      }
    },
    [data?.versionId, data?.localizations, addToast],
  );

  const selectLocale = useCallback(
    (locale: string) => {
      if (data?.localizations.some((loc) => loc.locale === locale)) {
        setActiveLocale(locale);
        return;
      }
      loadLocalization(locale, false, true);
    },
    [data?.localizations, loadLocalization],
  );

  const pollStatus = useCallback(async () => {
    try {
      const s = await apiGet<{ active: boolean; status: string; logs: string[]; errors: string[]; jobId?: string }>(
        "/submissions/status",
      );
      setSubmitStatus(s);
      if (!s.active && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        refetch();
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
      if (translationPollRef.current) clearInterval(translationPollRef.current);
      if (localeLoadingDelayRef.current) clearTimeout(localeLoadingDelayRef.current);
    };
  }, []);

  useEffect(() => {
    setTranslatingLocales(data?.translatingLocales ?? []);
  }, [data?.translatingLocales, data?.versionId]);

  useEffect(() => {
    const versionId = data?.versionId;
    if (!versionId) return;
    if (translatingLocales.length === 0) {
      if (translationPollRef.current) {
        clearInterval(translationPollRef.current);
        translationPollRef.current = null;
      }
      return;
    }
    if (translationPollRef.current) return;

    const poll = async () => {
      try {
        const { translatingLocales: latest } = await apiGet<{ translatingLocales: string[] }>(
          `/asc/versions/translations/status?versionId=${encodeURIComponent(versionId)}`,
        );
        setTranslatingLocales((prev) => {
          const finished = prev.filter((l) => !latest.includes(l));
          if (finished.length > 0) {
            for (const loc of finished) addToast(`Translation finished for ${loc}`, "success");
            refetch();
          }
          return latest;
        });
      } catch {
        /* ignore */
      }
    };
    translationPollRef.current = setInterval(poll, 3000);
    poll();
    return () => {
      if (translationPollRef.current) {
        clearInterval(translationPollRef.current);
        translationPollRef.current = null;
      }
    };
  }, [data?.versionId, translatingLocales.length, addToast, refetch]);
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [submitStatus?.logs?.length]);

  const runSubmission = async (kind: "metadata" | "review" | "binary") => {
    if (!canWrite) {
      addToast("Viewer role cannot perform this action", "error");
      return;
    }
    setSubmitting(kind);
    setShowLogs(true);
    try {
      const res = await apiPost(`/submissions/${kind}`, { bundleId: getActiveBundleId() });
      const fallback = kind === "metadata" ? "Metadata push started" : kind === "binary" ? "Binary upload started" : "Submit for review started";
      addToast(res.message || fallback, "success");
      startPolling();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setSubmitting(null);
    }
  };

  const syncFromAppStore = async () => {
    if (!canWrite) {
      addToast("Viewer role cannot perform this action", "error");
      return;
    }
    try {
      const res = await apiPost("/actions/sync", {
        bundleId: getActiveBundleId(),
      });
      addToast(res.message || "Sync started", "success");
    } catch (e: any) {
      addToast(e.message, "error");
    }
  };

  useClickOutside(addLocaleRef, () => setShowAddLocale(false));

  const createLocalization = useCallback(
    async (locale: string) => {
      if (!data?.versionId) return;
      setAddingLocale(true);
      setShowAddLocale(false);
      try {
        const created = await apiPost<{ appInfoLocalizationId?: string | null; versionLocalizationId?: string | null }>(
          "/asc/versions/localizations",
          {
            bundleId: getActiveBundleId(),
            versionId: data.versionId,
            locale,
            name: data.appName,
          },
        );
        const sourceLoc = data.localizations.find((l) => l.locale === "en-US") ?? data.localizations[0];
        const newLocalization: VersionLocalization = {
          locale,
          appInfoLocalizationId: created.appInfoLocalizationId ?? null,
          versionLocalizationId: created.versionLocalizationId ?? null,
          ...EMPTY_LOCALIZATION_FIELDS,
          name: data.appName,
        };

        if (sourceLoc && (created.appInfoLocalizationId || created.versionLocalizationId)) {
          try {
            await apiPost("/asc/versions/localizations/translate", {
              bundleId: getActiveBundleId(),
              versionId: data.versionId,
              targetLocale: locale,
              sourceLocale: sourceLoc.locale,
              appInfoLocalizationId: created.appInfoLocalizationId ?? null,
              versionLocalizationId: created.versionLocalizationId ?? null,
              sourceFields: {
                name: sourceLoc.name || data.appName || "",
                subtitle: sourceLoc.subtitle ?? "",
                keywords: sourceLoc.keywords ?? "",
                description: sourceLoc.description ?? "",
                promotionalText: sourceLoc.promotionalText ?? "",
                whatsNew: sourceLoc.whatsNew ?? "",
              },
              extraFields: {
                privacyPolicyUrl: sourceLoc.privacyPolicyUrl ?? "",
                supportUrl: sourceLoc.supportUrl ?? "",
                marketingUrl: sourceLoc.marketingUrl ?? "",
              },
            });
            setTranslatingLocales((prev) => (prev.includes(locale) ? prev : [...prev, locale]));
            addToast(`Language ${locale} added - translating with AI in background…`, "info");
          } catch {
            addToast(`Language ${locale} added`, "success");
          }
        } else {
          addToast(`Language ${locale} added`, "success");
        }

        setData((current) =>
          current && current.versionId === data.versionId
            ? {
                ...current,
                localizationSummaries: [
                  ...current.localizationSummaries.filter((loc) => loc.locale !== locale),
                  {
                    locale,
                    appInfoLocalizationId: created.appInfoLocalizationId ?? null,
                    versionLocalizationId: created.versionLocalizationId ?? null,
                    isComplete: false,
                  },
                ],
                localizations: current.localizations.some((loc) => loc.locale === locale)
                  ? current.localizations.map((loc) => (loc.locale === locale ? { ...loc, ...newLocalization } : loc))
                  : [...current.localizations, newLocalization],
              }
            : current,
        );
        setActiveLocale(locale);
        loadLocalization(locale, true, false, true);
      } catch (err: any) {
        addToast(`Failed to add language: ${err.message}`, "error");
      } finally {
        setAddingLocale(false);
      }
    },
    [data, addToast, loadLocalization],
  );

  const removeLocale = useCallback(
    async (loc: VersionLocalization) => {
      if (!data?.versionId) return;
      if (!confirm(`Remove ${getLocaleName(loc.locale)} (${loc.locale})?`)) return;
      setRemovingLocale(loc.locale);

      try {
        await apiDelete("/asc/versions/localizations", {
          bundleId: getActiveBundleId(),
          appInfoLocalizationId: loc.appInfoLocalizationId ?? undefined,
          versionLocalizationId: loc.versionLocalizationId ?? undefined,
        });
        addToast(`Language ${loc.locale} removed`, "success");

        const nextActiveLocale = data.localizationSummaries.find((l) => l.locale !== loc.locale)?.locale ?? null;

        setData((current) =>
          current && current.versionId === data.versionId
            ? {
                ...current,
                localizations: current.localizations.filter((l) => l.locale !== loc.locale),
                localizationSummaries: current.localizationSummaries.filter((l) => l.locale !== loc.locale),
                translatingLocales: current.translatingLocales?.filter((l) => l !== loc.locale),
              }
            : current,
        );
        setTranslatingLocales((prev) => prev.filter((l) => l !== loc.locale));
        if (activeLocale === loc.locale) {
          setActiveLocale(nextActiveLocale);
          if (nextActiveLocale) loadLocalization(nextActiveLocale);
        }
      } catch (err: any) {
        addToast(`Failed to remove language: ${err.message}`, "error");
      } finally {
        setRemovingLocale(null);
      }
    },
    [data, activeLocale, addToast, loadLocalization],
  );

  const handleSave = useCallback(
    async (field: string, value: string, loc: VersionLocalization) => {
      try {
        const result = await apiPatch<{ localizationSummary: VersionLocalizationSummary | null }>(
          "/asc/versions/metadata",
          {
            bundleId: getActiveBundleId(),
            versionId: data?.versionId,
            locale: loc.locale,
            appInfoLocalizationId: loc.appInfoLocalizationId,
            versionLocalizationId: loc.versionLocalizationId,
            field,
            value,
          },
        );
        setData((current) =>
          current
            ? {
                ...current,
                localizations: current.localizations.map((l) =>
                  l.locale === loc.locale ? { ...l, [field]: value } : l,
                ),
                localizationSummaries: result.localizationSummary
                  ? current.localizationSummaries.map((summary) =>
                      summary.locale === loc.locale ? result.localizationSummary! : summary,
                    )
                  : current.localizationSummaries,
              }
            : current,
        );
        addToast(`${field} updated`, "success");
      } catch (err: any) {
        addToast(`Failed to update ${field}: ${err.message}`, "error");
        throw err;
      }
    },
    [addToast, data?.versionId],
  );

  if (!versionId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400 dark:text-[#5c6478]">
        <FileText className="w-10 h-10 text-gray-300 dark:text-[#2a2f3d]" />
        <p className="text-sm">Select a version from the sidebar</p>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-gray-400 dark:text-[#5c6478]">
        <div className="spinner" /> Loading version data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400 dark:text-[#5c6478]">
        <AlertCircle className="w-8 h-8 text-red-300" />
        <p className="text-sm">{error}</p>
        <button onClick={refetch} className="text-[#D94412] text-sm font-medium hover:underline">
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const localizationSummaries = data.localizationSummaries;
  const activeLoc = activeLocale ? data.localizations.find((l) => l.locale === activeLocale) : data.localizations[0];
  const isActive = submitStatus?.active === true;
  const isActiveLocaleTranslating = activeLoc ? translatingLocales.includes(activeLoc.locale) : false;
  const canSubmitForReview =
    data.isEditable && (data.appStoreState === "PREPARE_FOR_SUBMISSION" || data.appStoreState === "DEVELOPER_REJECTED");

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2.5 flex-wrap">
          {data.versionString && <h1 className={`${pageTitle}`}>Version {data.versionString}</h1>}
          {data.appStoreState && <StateBadge state={data.appStoreState} />}
          {!data.isEditable &&
            (data.appStoreState === "READY_FOR_SALE" || data.appStoreState === "REPLACED_WITH_NEW_VERSION") && (
              <span className={badgeOutline("readonly")}>Read-only</span>
            )}
          {!canWrite && <span className={badgeOutline("readonly")}>Viewer</span>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canWrite && (
            <ActionButton
              canSubmitForReview={canSubmitForReview}
              submitting={submitting}
              isActive={isActive}
              onSubmitForReview={() => runSubmission("review")}
              onPushMetadata={() => runSubmission("metadata")}
              onUploadBinary={() => runSubmission("binary")}
              onRefetch={refetch}
              onSync={syncFromAppStore}
            />
          )}
        </div>
      </div>

      {!canWrite && (
        <div className="mb-4 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-900/40 text-[12px] text-amber-800 dark:text-amber-300">
          Viewer role: editing is disabled. Contact a team admin or member to make changes.
        </div>
      )}

      <fieldset disabled={!canWrite} className="contents">
        {submitStatus && submitStatus.status !== "idle" && (
          <div className={`${cardCls} mb-5 py-3.5`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {(() => {
                  const c = SUBMIT_STATUS_COLORS[submitStatus.status] ?? SUBMIT_STATUS_DEFAULT;
                  return (
                    <>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                      <span className={`text-[13px] font-medium capitalize ${c.text}`}>
                        Status - {submitStatus.status}
                      </span>
                    </>
                  );
                })()}
              </div>
              <button
                onClick={() => setShowLogs((v) => !v)}
                className={`text-[11px] ${textMuted} hover:text-[#6b7280] dark:hover:text-[#8b93a5] transition-colors font-medium`}
              >
                {showLogs ? "Hide" : "Show"} logs
              </button>
            </div>
            {submitStatus.errors.length > 0 && (
              <div className="mt-2.5 p-2.5 bg-red-50 rounded-lg border border-red-100">
                {submitStatus.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">
                    {e}
                  </p>
                ))}
              </div>
            )}
            {showLogs && submitStatus.logs.length > 0 && (
              <div className="mt-3 bg-[#0f0f1a] rounded-xl p-4 max-h-52 overflow-y-auto font-mono text-xs text-gray-400 border border-[#1e1e2e]">
                {submitStatus.logs.map((line, i) => (
                  <div
                    key={i}
                    className={`py-0.5 leading-relaxed ${
                      line.startsWith("[stderr]")
                        ? "text-yellow-400"
                        : line.toLowerCase().includes("error")
                          ? "text-red-400"
                          : line.toLowerCase().includes("success") || line.toLowerCase().includes("completed")
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

        <LatestBuildCard bundleId={data.bundleId} appName={data.appName} />

        {activeLoc ? (
          <div className={`${cardCls} flex flex-col gap-5`}>
            {(localizationSummaries.length > 1 || data.isEditable) && (
              <div className="-mx-5 -mt-5 px-5 pt-4 pb-4 border-b border-[#f3f4f6] dark:border-[#2a2f3d]">
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 flex-wrap flex-1 min-w-0">
                    {[...localizationSummaries]
                      .sort((a, b) => getLocaleName(a.locale).localeCompare(getLocaleName(b.locale)))
                      .map((loc) => {
                        const localeTranslating = translatingLocales.includes(loc.locale);
                        const localeLoading = visibleLoadingLocale === loc.locale;
                        const isComplete = loc.isComplete;
                        const isActive = loc.locale === activeLocale;
                        return (
                          <div key={loc.locale} className="relative group">
                            <button
                              onClick={() => selectLocale(loc.locale)}
                              className={`flex items-center gap-2 px-3.5 py-[7px] rounded-xl transition-all whitespace-nowrap ${
                                isActive
                                  ? "bg-[#111827] dark:bg-[#e8eaf0]/10 dark:border dark:border-[#e8eaf0]/20 border text-white shadow-sm"
                                  : isComplete
                                    ? `bg-emerald-50/70 dark:bg-emerald-900/15 border border-emerald-200/60 dark:border-emerald-800/40 ${textPrimary} hover:border-emerald-300 dark:hover:border-emerald-700/60`
                                    : `bg-[#fafbfc] dark:bg-[#252b38] border border-[#eef0f3] dark:border-[#2a2f3d] ${textPrimary} hover:border-[#d1d5db] dark:hover:border-[#3a4050]`
                              }`}
                            >
                              <LocaleFlag locale={loc.locale} />
                              <span className="text-[13px] font-medium">{getLocaleName(loc.locale)}</span>
                              {(localeTranslating || localeLoading) && <div className="spinner !w-3 !h-3" />}
                            </button>
                            {data.isEditable && localizationSummaries.length > 1 && !localeTranslating && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeLocale({
                                    ...EMPTY_LOCALIZATION_FIELDS,
                                    locale: loc.locale,
                                    appInfoLocalizationId: loc.appInfoLocalizationId,
                                    versionLocalizationId: loc.versionLocalizationId,
                                  });
                                }}
                                disabled={removingLocale === loc.locale}
                                className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm ${
                                  loc.locale === activeLocale
                                    ? "bg-white/20 hover:bg-white/40 text-white"
                                    : "bg-[#f3f4f6] dark:bg-[#2a2f3d] hover:bg-red-100 dark:hover:bg-red-900/30 text-[#9ca3af] hover:text-[#D94412]"
                                }`}
                                title="Remove language"
                              >
                                {removingLocale === loc.locale ? (
                                  <div className="spinner !w-3.5 !h-3.5" />
                                ) : (
                                  <X className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                  {data.isEditable && data.versionId && (
                    <div ref={addLocaleRef} className="relative shrink-0 self-start">
                      <button
                        onClick={() => setShowAddLocale((v) => !v)}
                        disabled={addingLocale}
                        className={`flex items-center gap-1.5 px-3 py-[7px] rounded-xl border border-dashed border-[#d1d5db] dark:border-[#3a4050] ${textSecondary} hover:border-[#D94412] hover:text-[#D94412] transition-all text-[13px] font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {addingLocale ? <div className="spinner !w-3.5 !h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        Add Language
                      </button>
                      {showAddLocale && (
                        <div
                          className={`absolute right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#1c2028] border ${borderDefault} rounded-xl shadow-lg py-1 min-w-[235px] max-h-64 overflow-y-auto`}
                        >
                          {(ascLocales ?? [])
                            .filter((l) => !localizationSummaries.some((loc) => loc.locale === l))
                            .sort((a, b) => getLocaleName(a).localeCompare(getLocaleName(b)))
                            .map((locale) => (
                              <button
                                key={locale}
                                onClick={() => createLocalization(locale)}
                                className={`w-full flex items-center justify-between gap-2 px-4 py-2 text-[13px] ${textPrimary} hover:bg-[#fafbfc] dark:hover:bg-[#252b38] transition-colors text-left`}
                              >
                                <span className="flex items-center gap-2">
                                  <LocaleFlag locale={locale} className="w-5 h-4 rounded-xs" />
                                  {getLocaleName(locale)}
                                </span>
                                <span className={`text-[11px] font-mono ${textMuted}`}>{locale}</span>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pb-3 border-b border-[#f3f4f6] dark:border-[#2a2f3d]">
              <div className="flex items-start gap-2.5">
                <LocaleFlag
                  locale={activeLoc.locale}
                  className="w-auto h-[17px] rounded-xs object-cover shrink-0 mt-1"
                />
                <div>
                  <div className={`text-[16px] font-semibold ${textPrimary} leading-tight`}>
                    {getLocaleName(activeLoc.locale)}
                  </div>
                  <div className={`text-[11px] ${textMuted} mt-0.5`}>Locale: {activeLoc.locale}</div>
                </div>
              </div>
              {isActiveLocaleTranslating ? (
                <span className={`${badgeOutline("running")} uppercase tracking-wide flex items-center gap-1.5`}>
                  <div className="spinner !w-3 !h-3" /> Translating…
                </span>
              ) : data.isEditable ? (
                <span className={`${badgeOutline("editable")} uppercase tracking-wide`}>Editable</span>
              ) : (
                <span className={`${badgeOutline("")} uppercase tracking-wide`}>Read-only</span>
              )}
            </div>
            {data.appId && <ScreenshotsPanel appId={data.appId} activeLocale={activeLocale} addToast={addToast} />}

            <div className={`text-[14px] font-bold -mb-1 ${textPrimary}`}>App Metadata</div>

            {FIELD_META.map((field) => (
              <EditableField
                key={field.key}
                field={field}
                value={(activeLoc as any)[field.key] ?? ""}
                localization={activeLoc}
                isEditable={
                  canWrite && !isActiveLocaleTranslating && (data.isEditable || field.key === "promotionalText")
                }
                onSave={handleSave}
              />
            ))}
            <div className="pt-4 border-t border-[#f3f4f6] dark:border-[#2a2f3d]">
              <div className={`text-[11px] font-bold uppercase tracking-widest ${textMuted} mb-4`}>Version Info</div>
              <div className="flex flex-col gap-5">
                <InlineEditField
                  label="Copyright"
                  value={data.copyright ?? ""}
                  isEditable={canWrite && data.isEditable}
                  onSave={async (val) => {
                    await apiPatch("/asc/versions/metadata", {
                      bundleId: getActiveBundleId(),
                      versionId: data.versionId,
                      field: "copyright",
                      value: val,
                    });
                    setData((current) => (current ? { ...current, copyright: val } : current));
                    addToast("Copyright updated", "success");
                  }}
                />
                {data.ageRating !== undefined && (
                  <div className="group">
                    <div className={`text-[12px] font-semibold ${textSecondary} uppercase tracking-wide mb-1.5 flex items-center gap-2`}>
                      Age Rating
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[13px] ${textPrimary} px-3.5 py-[9px] border ${borderDefault} bg-[#fafbfc] dark:bg-[#252b38] rounded-xl`}
                      >
                        {data.ageRating || <span className="text-[#c8cdd3] dark:text-[#3a4050] italic">Not set</span>}
                      </span>
                      <a
                        href="https://appstoreconnect.apple.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-[11px] ${textMuted} hover:text-[#D94412] transition-colors`}
                      >
                        Edit in ASC ↗
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : localizationSummaries.length > 0 && activeLocale ? (
          <div className={`${cardCls} flex items-center justify-center py-12 gap-3 text-gray-400 dark:text-[#5c6478]`}>
            <div className="spinner" /> Loading {activeLocale}…
          </div>
        ) : localizationSummaries.length === 0 ? (
          <div className={`${cardCls} flex flex-col items-center justify-center py-12 text-center`}>
            <FileText className="w-10 h-10 text-gray-300 mb-3" />
            <p className={`text-sm ${textMuted}`}>No localizations found for this version.</p>
          </div>
        ) : null}

        {data.versionId && <ReviewerInfoPanel data={data} addToast={addToast} onRefetch={refetch} />}
      </fieldset>
    </div>
  );
}
