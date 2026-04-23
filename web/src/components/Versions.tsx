import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  useApi,
  apiPost,
  authHeaders,
  getActiveBundleId,
} from "../hooks/useApi";
import { cardCls, inputCls, textareaCls } from "../styles";
import type { VersionsData, VersionLocalization } from "../types";
import {
  Send,
  ChevronDown,
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

const ALL_ASC_LOCALES = [
  "ar-SA",
  "bn-IN",
  "ca",
  "cs",
  "da",
  "de-DE",
  "el",
  "en-AU",
  "en-CA",
  "en-GB",
  "en-US",
  "es-ES",
  "es-MX",
  "fi",
  "fr-CA",
  "fr-FR",
  "gu-IN",
  "he",
  "hi",
  "hr",
  "hu",
  "id",
  "it",
  "ja",
  "kn-IN",
  "ko",
  "ml-IN",
  "mr-IN",
  "ms",
  "nl-NL",
  "no",
  "or-IN",
  "pa-IN",
  "pl",
  "pt-BR",
  "pt-PT",
  "ro",
  "ru",
  "sk",
  "sl",
  "sv",
  "ta-IN",
  "te-IN",
  "th",
  "tr",
  "uk",
  "ur-IN",
  "vi",
  "zh-Hans",
  "zh-Hant",
];

const _localeNames = new Intl.DisplayNames(["en"], { type: "language" });

function getLocaleName(locale: string): string {
  try {
    const full = _localeNames.of(locale) ?? locale;
    return full.replace(/\s*\(.*\)$/, "");
  } catch {
    return locale;
  }
}

const LOCALE_FLAG_OVERRIDES: Record<string, string> = {
  ar: "sa",
  ca: "es",
  cs: "cz",
  da: "dk",
  el: "gr",
  en: "us",
  he: "il",
  hi: "in",
  ja: "jp",
  ko: "kr",
  ms: "my",
  no: "no",
  sl: "si",
  sv: "se",
  uk: "ua",
  vi: "vn",
  zh: "cn",
  "zh-Hant": "tw",
  "pt-PT": "pt",
  "pt-BR": "br",
  "es-MX": "mx",
  "es-ES": "es",
  "fr-CA": "ca",
  "fr-FR": "fr",
  "en-AU": "au",
  "en-CA": "ca",
  "en-GB": "gb",
  "en-US": "us",
  "de-DE": "de",
  "nl-NL": "nl",
  "ar-SA": "sa",
  "zh-Hans": "cn",
};

function getLocaleFlag(locale: string): string {
  if (LOCALE_FLAG_OVERRIDES[locale]) return LOCALE_FLAG_OVERRIDES[locale];
  const parts = locale.split("-");
  if (parts.length > 1) return parts[1].toLowerCase();
  const lang = parts[0];
  if (LOCALE_FLAG_OVERRIDES[lang]) return LOCALE_FLAG_OVERRIDES[lang];
  return lang.toLowerCase();
}

function LocaleFlag({
  locale,
  className,
}: {
  locale: string;
  className?: string;
}) {
  return (
    <img
      src={`/app/country-flags/${getLocaleFlag(locale)}.svg`}
      alt=""
      className={className ?? "w-4 h-3 rounded-xs object-cover shrink-0"}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

const DEVICE_PATTERNS: [RegExp, string][] = [
  [/6\.9|69[_-]?inch|iphone[_-]?15[_-]?pro/i, 'iPhone 6.9"'],
  [/6\.7|67[_-]?inch|iphone[_-]?1[45]/i, 'iPhone 6.7"'],
  [/6\.5|65[_-]?inch|xs[_-]?max|xsmax/i, 'iPhone 6.5"'],
  [/5\.5|55[_-]?inch|iphone[_-]?8[_-]?plus|plus/i, 'iPhone 5.5"'],
  [/ipad[_-]?pro[_-]?13|13[_-]?inch/i, 'iPad 13"'],
  [/ipad[_-]?pro[_-]?12|12\.9/i, 'iPad 12.9"'],
  [/ipad/i, "iPad"],
];

function getDeviceLabel(url: string): string {
  const filename = decodeURIComponent(url.split("/").pop() ?? url);
  for (const [re, label] of DEVICE_PATTERNS) {
    if (re.test(filename)) return label;
  }
  return "Other";
}

const stateColors: Record<string, string> = {
  READY_FOR_SALE:
    "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40",
  REPLACED_WITH_NEW_VERSION:
    "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40",
  PREPARE_FOR_SUBMISSION:
    "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40",
  WAITING_FOR_REVIEW:
    "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/40",
  IN_REVIEW:
    "bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-900/40",
  REJECTED:
    "bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40",
  DEVELOPER_REJECTED:
    "bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40",
  METADATA_REJECTED:
    "bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40",
};

function StateBadge({ state }: { state: string }) {
  const cls = stateColors[state] ?? "bg-gray-50 text-gray-600 border-gray-100";
  const label = state
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}
    >
      {label}
    </span>
  );
}

function ActionButton({
  canSubmitForReview,
  submitting,
  isActive,
  onSubmitForReview,
  onPushMetadata,
  onRefetch,
  onSync,
}: {
  canSubmitForReview: boolean;
  submitting: string | null;
  isActive: boolean;
  onSubmitForReview: () => void;
  onPushMetadata: () => void;
  onRefetch: () => void;
  onSync: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const busy = !!submitting || isActive;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

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
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#1c2028] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-xl shadow-lg py-1 min-w-[180px]">
            <button
              onClick={() => {
                setOpen(false);
                onPushMetadata();
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#111827] dark:text-[#e8eaf0] hover:bg-[#fafbfc] dark:hover:bg-[#252b38] transition-colors text-left"
            >
              <Upload className="w-4 h-4 text-[#6b7280] dark:text-[#8b93a5]" />
              Push Metadata
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onRefetch();
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#111827] dark:text-[#e8eaf0] hover:bg-[#fafbfc] dark:hover:bg-[#252b38] transition-colors text-left"
            >
              <RefreshCw className="w-4 h-4 text-[#6b7280] dark:text-[#8b93a5]" />
              Reload
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onSync();
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#111827] dark:text-[#e8eaf0] hover:bg-[#fafbfc] dark:hover:bg-[#252b38] transition-colors text-left"
            >
              <RefreshCcw className="w-4 h-4 text-[#6b7280] dark:text-[#8b93a5]" />
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
        className="inline-flex items-center gap-2 pl-3.5 pr-3 py-[8px] rounded-l-xl text-[13px] font-medium border border-[#eef0f3] dark:border-[#2a2f3d] bg-white dark:bg-[#1c2028] text-[#111827] dark:text-[#e8eaf0] hover:border-[#D94412] hover:text-[#D94412] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
        className="px-2.5 rounded-r-xl border border-l-0 border-[#eef0f3] dark:border-[#2a2f3d] bg-white dark:bg-[#1c2028] text-[#6b7280] dark:text-[#8b93a5] hover:border-[#D94412] hover:text-[#D94412] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="More actions"
      >
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#1c2028] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-xl shadow-lg py-1 min-w-[160px]">
          <button
            onClick={() => {
              setOpen(false);
              onRefetch();
            }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#111827] dark:text-[#e8eaf0] hover:bg-[#fafbfc] dark:hover:bg-[#252b38] transition-colors text-left"
          >
            <RefreshCw className="w-4 h-4 text-[#6b7280] dark:text-[#8b93a5]" />
            Reload
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onSync();
            }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#111827] dark:text-[#e8eaf0] hover:bg-[#fafbfc] dark:hover:bg-[#252b38] transition-colors text-left"
          >
            <RefreshCcw className="w-4 h-4 text-[#6b7280] dark:text-[#8b93a5]" />
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
  const nearLimit = field.maxLength ? charCount > field.maxLength * 0.9 : false;

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <label className="text-[12px] font-semibold text-[#6b7280] dark:text-[#8b93a5] uppercase tracking-wide">
            {field.label}
          </label>
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
              className="px-3 py-[6px] rounded-xl text-xs font-medium border border-[#eef0f3] dark:border-[#2a2f3d] bg-white dark:bg-[#1c2028] text-[#6b7280] dark:text-[#8b93a5] hover:bg-gray-50 dark:hover:bg-[#252b38] transition-all"
            >
              Cancel
            </button>
            {field.type === "textarea" && (
              <span className="text-[10px] text-[#c8cdd3] dark:text-[#3a4050] ml-auto">
                ⌘+Enter to save
              </span>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={() => isEditable && setEditing(true)}
          className={`text-[13px] text-[#111827] dark:text-[#e8eaf0] whitespace-pre-wrap break-words rounded-xl px-3.5 py-[9px] border border-[#eef0f3] dark:border-[#2a2f3d] bg-[#fafbfc] dark:bg-[#252b38] min-h-[38px] ${
            isEditable
              ? "cursor-pointer hover:border-[#d1d5db] dark:hover:border-[#3a4050] hover:bg-white dark:hover:bg-[#1c2028] transition-colors"
              : ""
          }`}
        >
          {value || (
            <span className="text-[#c8cdd3] dark:text-[#3a4050] italic">
              Empty
            </span>
          )}
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
        <label className="text-[12px] font-semibold text-[#6b7280] dark:text-[#8b93a5] uppercase tracking-wide">
          {label}
        </label>
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
              className="px-3 py-[6px] rounded-xl text-xs font-medium border border-[#eef0f3] dark:border-[#2a2f3d] bg-white dark:bg-[#1c2028] text-[#6b7280] dark:text-[#8b93a5] hover:bg-gray-50 dark:hover:bg-[#252b38] transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => isEditable && setEditing(true)}
          className={`text-[13px] text-[#111827] dark:text-[#e8eaf0] rounded-xl px-3.5 py-[9px] border border-[#eef0f3] dark:border-[#2a2f3d] bg-[#fafbfc] dark:bg-[#252b38] min-h-[38px] ${
            isEditable
              ? "cursor-pointer hover:border-[#d1d5db] dark:hover:border-[#3a4050] hover:bg-white dark:hover:bg-[#1c2028] transition-colors"
              : ""
          }`}
        >
          {value || (
            <span className="text-[#c8cdd3] dark:text-[#3a4050] italic">
              Empty
            </span>
          )}
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

function LatestBuildCard({
  bundleId,
  appName,
}: {
  bundleId: string;
  appName: string;
}) {
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
      <div className="text-[14px] font-bold mb-3">{/*tracking-widest text-[#9ca3af] dark:text-[#5c6478] uppercase */}
        Latest Build
      </div>
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          {build.iconUrl ? (
            <img
              src={build.iconUrl}
              alt={appName}
              className="w-16 h-16 rounded-[16px] border border-[#eef0f3] dark:border-[#2a2f3d] shadow-sm object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-[16px] bg-[#f3f4f6] dark:bg-[#252b38] border border-[#eef0f3] dark:border-[#2a2f3d] flex items-center justify-center">
              <Store className="w-6 h-6 text-[#9ca3af]" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[14px] font-semibold text-[#111827] dark:text-[#e8eaf0] leading-tight">
                {appName}
              </div>
              <div className="text-[11px] text-[#9ca3af] dark:text-[#5c6478] font-mono mt-0.5">
                {build.bundleId}
              </div>
            </div>
            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-900/40 uppercase tracking-wide">
              {build.exportMethod}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="flex items-center gap-1 text-[12px] text-[#6b7280] dark:text-[#8b93a5]">
              <FileText className="w-3.5 h-3.5 shrink-0" />
              {sizeMb} MB
            </span>
            <span className="flex items-center gap-1 text-[12px] text-[#6b7280] dark:text-[#8b93a5]">
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
  const { data, loading, refetch } = useApi<{ job: FramedJob | null }>(
    `/github/screenshots/latest-framed/${appId}`,
    [appId],
  );
  const [deleting, setDeleting] = useState<string | null>(null);

  const deleteScreenshot = async (jobId: string, url: string) => {
    if (!confirm("Remove this screenshot?")) return;
    setDeleting(url);
    try {
      const res = await fetch(`/api/github/screenshots/framed/${jobId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      addToast("Screenshot removed", "success");
      refetch();
    } catch (err: any) {
      addToast(`Failed to remove: ${err.message}`, "error");
    } finally {
      setDeleting(null);
    }
  };

  const job = data?.job;
  const framedByLocale = job?.framedByLocale ?? {};
  const locales = Object.keys(framedByLocale).filter(
    (l) => (framedByLocale[l]?.length ?? 0) > 0,
  );

  const effectiveLocale =
    activeLocale && locales.includes(activeLocale)
      ? activeLocale
      : (locales[0] ?? null);

  if (loading || !job || locales.length === 0) return null;

  const screenshots = effectiveLocale
    ? (framedByLocale[effectiveLocale] ?? [])
    : [];

  const grouped = new Map<string, string[]>();
  for (const url of screenshots) {
    const label = getDeviceLabel(url);
    if (!grouped.has(label)) grouped.set(label, []);
    grouped.get(label)!.push(url);
  }
  const DEVICE_ORDER = [
    'iPhone 6.9"',
    'iPhone 6.7"',
    'iPhone 6.5"',
    'iPhone 5.5"',
    'iPad 13"',
    'iPad 12.9"',
    "iPad",
    "Other",
  ];
  const sortedGroups = [...grouped.entries()].sort(
    ([a], [b]) =>
      (DEVICE_ORDER.indexOf(a) === -1 ? 99 : DEVICE_ORDER.indexOf(a)) -
      (DEVICE_ORDER.indexOf(b) === -1 ? 99 : DEVICE_ORDER.indexOf(b)),
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-[14px] font-bold">{/*uppercase tracking-widest text-[#9ca3af] dark:text-[#5c6478]*/}
          Screenshots
        </div>
        <span className="text-[11px] text-[#9ca3af] dark:text-[#5c6478] font-mono">
          {job.commitSha.slice(0, 7)}
          {job.branch ? ` · ${job.branch}` : ""}
        </span>
      </div>

      {screenshots.length === 0 ? (
        <p className="text-[12px] text-[#9ca3af] py-3 text-center">
          No screenshots for {effectiveLocale}.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {sortedGroups.map(([label, urls]) => (
            <div key={label}>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#9ca3af] dark:text-[#5c6478]">
                  {label}
                </div>
                <span className="text-[10px] text-[#c8cdd3] dark:text-[#3a4050]">
                  — max 10
                </span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {urls.map((url) => (
                  <div key={url} className="relative shrink-0 group/img">
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={url}
                        alt={`${label} screenshot`}
                        className="h-[200px] w-auto rounded-xl border border-[#eef0f3] object-cover shadow-sm group-hover/img:shadow-md group-hover/img:opacity-90 transition-all"
                      />
                    </a>
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
                      {deleting === url ? (
                        <div className="spinner !w-3.5 !h-3.5" />
                      ) : (
                        <X className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
  const [showAddLocale, setShowAddLocale] = useState(false);
  const [addingLocale, setAddingLocale] = useState(false);
  const [removingLocale, setRemovingLocale] = useState<string | null>(null);
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

  useEffect(() => {
    setActiveLocale(null);
  }, [versionId]);

  useEffect(() => {
    if (data?.localizations?.length && !activeLocale) {
      const enUs = data.localizations.find((l) => l.locale === "en-US");
      setActiveLocale(enUs?.locale ?? data.localizations[0].locale);
    }
  }, [data, activeLocale]);

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

  const syncFromAppStore = async () => {
    try {
      const res = await apiPost("/actions/sync", {
        bundleId: getActiveBundleId(),
      });
      addToast(res.message || "Sync started", "success");
    } catch (e: any) {
      addToast(e.message, "error");
    }
  };

  useEffect(() => {
    if (!showAddLocale) return;
    const handler = (e: MouseEvent) => {
      if (
        addLocaleRef.current &&
        !addLocaleRef.current.contains(e.target as Node)
      )
        setShowAddLocale(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAddLocale]);

  const createLocalization = useCallback(
    async (locale: string) => {
      if (!data?.versionId) return;
      setAddingLocale(true);
      setShowAddLocale(false);
      try {
        const res = await fetch("/api/asc/versions/localizations", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            bundleId: getActiveBundleId(),
            versionId: data.versionId,
            locale,
            name: data.appName,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        const created = await res.json();

        const sourceLoc =
          data.localizations.find((l) => l.locale === "en-US") ??
          data.localizations[0];

        if (
          sourceLoc &&
          (created.appInfoLocalizationId || created.versionLocalizationId)
        ) {
          addToast(`Language ${locale} added — translating with AI…`, "info");
          try {
            const translateRes = await fetch(
              "/api/asc/versions/localizations/translate",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...authHeaders(),
                },
                body: JSON.stringify({
                  targetLocale: locale,
                  sourceLocale: sourceLoc.locale,
                  sourceFields: {
                    name: sourceLoc.name || data.appName || "",
                    subtitle: sourceLoc.subtitle ?? "",
                    keywords: sourceLoc.keywords ?? "",
                    description: sourceLoc.description ?? "",
                    promotionalText: sourceLoc.promotionalText ?? "",
                    whatsNew: sourceLoc.whatsNew ?? "",
                  },
                }),
              },
            );

            if (translateRes.ok) {
              const { fields } = await translateRes.json();
              const mergedFields: Record<string, string> = {
                ...(fields as Record<string, string>),
              };
              if (sourceLoc.privacyPolicyUrl)
                mergedFields.privacyPolicyUrl = sourceLoc.privacyPolicyUrl;
              if (sourceLoc.supportUrl)
                mergedFields.supportUrl = sourceLoc.supportUrl;
              if (sourceLoc.marketingUrl)
                mergedFields.marketingUrl = sourceLoc.marketingUrl;
              const appInfoFields = ["name", "subtitle", "privacyPolicyUrl"];
              const savePromises = Object.entries(mergedFields)
                .filter(([, v]) => v && v.trim())
                .map(([field, value]) => {
                  const isAppInfoField = appInfoFields.includes(field);
                  if (isAppInfoField && !created.appInfoLocalizationId)
                    return null;
                  if (!isAppInfoField && !created.versionLocalizationId)
                    return null;
                  return fetch("/api/asc/versions/metadata", {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                      ...authHeaders(),
                    },
                    body: JSON.stringify({
                      bundleId: getActiveBundleId(),
                      appInfoLocalizationId: isAppInfoField
                        ? created.appInfoLocalizationId
                        : undefined,
                      versionLocalizationId: !isAppInfoField
                        ? created.versionLocalizationId
                        : undefined,
                      field,
                      value,
                    }),
                  });
                })
                .filter(Boolean);

              await Promise.allSettled(savePromises);
              await new Promise((r) => setTimeout(r, 1500));
              addToast(
                `Language ${locale} added and pre-filled with AI`,
                "success",
              );
            } else {
              addToast(`Language ${locale} added`, "success");
            }
          } catch {
            addToast(`Language ${locale} added`, "success");
          }
        } else {
          addToast(`Language ${locale} added`, "success");
        }

        refetch();
        setActiveLocale(locale);
      } catch (err: any) {
        addToast(`Failed to add language: ${err.message}`, "error");
      } finally {
        setAddingLocale(false);
      }
    },
    [data, addToast, refetch],
  );

  const removeLocale = useCallback(
    async (loc: VersionLocalization) => {
      if (!data?.versionId) return;
      if (!confirm(`Remove ${getLocaleName(loc.locale)} (${loc.locale})?`))
        return;
      setRemovingLocale(loc.locale);
      try {
        const res = await fetch("/api/asc/versions/localizations", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            bundleId: getActiveBundleId(),
            appInfoLocalizationId: loc.appInfoLocalizationId ?? undefined,
            versionLocalizationId: loc.versionLocalizationId ?? undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        addToast(`Language ${loc.locale} removed`, "success");
        if (activeLocale === loc.locale)
          setActiveLocale(
            data.localizations.find((l) => l.locale !== loc.locale)?.locale ??
              null,
          );
        refetch();
      } catch (err: any) {
        addToast(`Failed to remove language: ${err.message}`, "error");
      } finally {
        setRemovingLocale(null);
      }
    },
    [data, activeLocale, addToast, refetch],
  );

  const handleSave = useCallback(
    async (field: string, value: string, loc: VersionLocalization) => {
      try {
        const res = await fetch("/api/asc/versions/metadata", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            bundleId: getActiveBundleId(),
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
        addToast(`${field} updated`, "success");
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
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400 dark:text-[#5c6478]">
        <FileText className="w-10 h-10 text-gray-300 dark:text-[#2a2f3d]" />
        <p className="text-sm">Select a version from the sidebar</p>
      </div>
    );
  }

  if (loading) {
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
        <button
          onClick={refetch}
          className="text-[#D94412] text-sm font-medium hover:underline"
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
  const isActive = submitStatus?.active === true;
  const canSubmitForReview =
    data.isEditable &&
    (data.appStoreState === "PREPARE_FOR_SUBMISSION" ||
      data.appStoreState === "DEVELOPER_REJECTED");

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2.5 flex-wrap">
          {data.versionString && (
            <h1 className="text-3xl font-semibold tracking-tight text-[#111827] dark:text-[#e8eaf0]">
              Version {data.versionString}
            </h1>
          )}
          {data.appStoreState && <StateBadge state={data.appStoreState} />}
          {!data.isEditable &&
            (data.appStoreState === "READY_FOR_SALE" ||
              data.appStoreState === "REPLACED_WITH_NEW_VERSION") && (
              <span className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full font-medium">
                Read-only
              </span>
            )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ActionButton
            canSubmitForReview={canSubmitForReview}
            submitting={submitting}
            isActive={isActive}
            onSubmitForReview={submitForReview}
            onPushMetadata={submitMetadata}
            onRefetch={refetch}
            onSync={syncFromAppStore}
          />
        </div>
      </div>

      {submitStatus && submitStatus.status !== "idle" && (
        <div className={`${cardCls} mb-5 py-3.5`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
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
                className={`text-[13px] font-medium capitalize ${
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
                Fastlane — {submitStatus.status}
              </span>
            </div>
            <button
              onClick={() => setShowLogs((v) => !v)}
              className="text-[11px] text-[#9ca3af] dark:text-[#5c6478] hover:text-[#6b7280] dark:hover:text-[#8b93a5] transition-colors font-medium"
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

      <LatestBuildCard bundleId={data.bundleId} appName={data.appName} />

      {activeLoc ? (
        <div className={`${cardCls} flex flex-col gap-5`}>

          {/* Language selector */}
          {(data.localizations.length > 1 || data.isEditable) && (
            <div className="-mx-5 -mt-5 px-5 pt-4 pb-4 border-b border-[#f3f4f6] dark:border-[#2a2f3d]">
              <div className="flex items-start gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 flex-wrap flex-1 min-w-0">
                  {data.localizations.map((loc) => (
                    <div key={loc.locale} className="relative group">
                      <button
                        onClick={() => setActiveLocale(loc.locale)}
                        className={`flex items-center gap-2 px-3.5 py-[7px] rounded-xl transition-all whitespace-nowrap ${
                          loc.locale === activeLocale
                            ? "bg-[#111827] dark:bg-[#e8eaf0] text-white dark:text-[#111827] shadow-sm"
                            : "bg-[#fafbfc] dark:bg-[#252b38] border border-[#eef0f3] dark:border-[#2a2f3d] text-[#111827] dark:text-[#e8eaf0] hover:border-[#d1d5db] dark:hover:border-[#3a4050]"
                        }`}
                      >
                        <LocaleFlag locale={loc.locale} />
                        <span className="text-[13px] font-medium">
                          {getLocaleName(loc.locale)}
                        </span>
                        {/*<Check
                          className={`w-3.5 h-3.5 shrink-0 ${
                            loc.locale === activeLocale ? "opacity-100" : "opacity-30"
                          }`}
                        />*/}
                      </button>
                      {data.isEditable && data.localizations.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeLocale(loc);
                          }}
                          disabled={removingLocale === loc.locale}
                          className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm ${
                            loc.locale === activeLocale
                              ? "bg-white/20 hover:bg-white/40 text-white"
                              : "bg-[#f3f4f6] dark:bg-[#2a2f3d] hover:bg-red-100 dark:hover:bg-red-900/30 text-[#9ca3af] hover:text-[#D94412]"
                          }`}
                          title="Remove language"
                        >
                          {removingLocale === loc.locale ? (
                            <div className="spinner !w-2.5 !h-2.5" />
                          ) : (
                            <X className="w-2 h-2" />
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {data.isEditable && data.versionId && (
                  <div ref={addLocaleRef} className="relative shrink-0 self-start">
                    <button
                      onClick={() => setShowAddLocale((v) => !v)}
                      disabled={addingLocale}
                      className="flex items-center gap-1.5 px-3 py-[7px] rounded-xl border border-dashed border-[#d1d5db] dark:border-[#3a4050] text-[#6b7280] dark:text-[#8b93a5] hover:border-[#D94412] hover:text-[#D94412] transition-all text-[13px] font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {addingLocale ? (
                        <div className="spinner !w-3.5 !h-3.5" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      Add Language
                    </button>
                    {showAddLocale && (
                      <div className="absolute right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#1c2028] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-xl shadow-lg py-1 min-w-[200px] max-h-64 overflow-y-auto">
                        {ALL_ASC_LOCALES.filter(
                          (l) => !data.localizations.some((loc) => loc.locale === l),
                        ).map((locale) => (
                          <button
                            key={locale}
                            onClick={() => createLocalization(locale)}
                            className="w-full flex items-center justify-between gap-2 px-4 py-2 text-[13px] text-[#111827] dark:text-[#e8eaf0] hover:bg-[#fafbfc] dark:hover:bg-[#252b38] transition-colors text-left"
                          >
                            <span className="flex items-center gap-2">
                              <LocaleFlag locale={locale} />
                              {getLocaleName(locale)}
                            </span>
                            <span className="text-[11px] font-mono text-[#9ca3af] dark:text-[#5c6478]">
                              {locale}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Active locale header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#f3f4f6] dark:border-[#2a2f3d]">
            <div className="flex items-start gap-2.5">
              <LocaleFlag
                locale={activeLoc.locale}
                className="w-5 h-4 rounded-xs object-cover shrink-0 mt-1"
              />
              <div>
                <div className="text-[16px] font-semibold text-[#111827] dark:text-[#e8eaf0] leading-tight">
                  {getLocaleName(activeLoc.locale)}
                </div>
                <div className="text-[11px] text-[#9ca3af] dark:text-[#5c6478] mt-0.5">
                  Locale: {activeLoc.locale}
                </div>
              </div>
            </div>
            {data.isEditable ? (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide">
                Editable
              </span>
            ) : (
              <span className="text-[10px] text-[#9ca3af] dark:text-[#5c6478] bg-[#f3f4f6] dark:bg-[#252b38] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide">
                Read-only
              </span>
            )}
          </div>
          {data.appId && (
            <ScreenshotsPanel
              appId={data.appId}
              activeLocale={activeLocale}
              addToast={addToast}
            />
          )}

          <div className="text-[14px] font-bold pt-4 border-t border-[#f3f4f6] dark:border-[#2a2f3d] -mb-1">{/*uppercase tracking-widest text-[#9ca3af] dark:text-[#5c6478]*/}
            App Metadata
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
          {(data.copyright !== undefined || data.ageRating !== undefined) && (
            <div className="pt-4 border-t border-[#f3f4f6]">
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#9ca3af] dark:text-[#5c6478] mb-4">
                Version Info
              </div>
              <div className="flex flex-col gap-5">
                {data.copyright !== undefined && (
                  <InlineEditField
                    label="Copyright"
                    value={data.copyright ?? ""}
                    isEditable={data.isEditable}
                    onSave={async (val) => {
                      const res = await fetch("/api/asc/versions/metadata", {
                        method: "PATCH",
                        headers: {
                          "Content-Type": "application/json",
                          ...authHeaders(),
                        },
                        body: JSON.stringify({
                          bundleId: getActiveBundleId(),
                          versionId: data.versionId,
                          field: "copyright",
                          value: val,
                        }),
                      });
                      if (!res.ok) throw new Error(`HTTP ${res.status}`);
                      addToast("Copyright updated", "success");
                      refetch();
                    }}
                  />
                )}
                {data.ageRating !== undefined && (
                  <div className="group">
                    <div className="text-[12px] font-semibold text-[#6b7280] uppercase tracking-wide mb-1.5 flex items-center gap-2">
                      Age Rating
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-[#111827] dark:text-[#e8eaf0] px-3.5 py-[9px] border border-[#eef0f3] dark:border-[#2a2f3d] bg-[#fafbfc] dark:bg-[#252b38] rounded-xl">
                        {data.ageRating || (
                          <span className="text-[#c8cdd3] dark:text-[#3a4050] italic">
                            Not set
                          </span>
                        )}
                      </span>
                      <a
                        href="https://appstoreconnect.apple.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-[#9ca3af] dark:text-[#5c6478] hover:text-[#D94412] transition-colors"
                      >
                        Edit in ASC ↗
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : data.localizations.length === 0 ? (
        <div
          className={`${cardCls} flex flex-col items-center justify-center py-12 text-center`}
        >
          <FileText className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm text-[#9ca3af] dark:text-[#5c6478]">
            No localizations found for this version.
          </p>
        </div>
      ) : null}
    </div>
  );
}
