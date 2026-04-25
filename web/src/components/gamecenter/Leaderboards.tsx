import { useState, useCallback, useEffect } from "react";
import { Plus, RefreshCw, Pencil, Trash2, X, Check, ChevronDown, Trophy, Globe, Archive } from "lucide-react";
import { authHeaders, getActiveBundleId } from "../../hooks/useApi";
import {
  TD,
  TH,
  borderDefault,
  btnPrimary,
  btnSecSm,
  btnSecondary,
  cardCls,
  inputCls,
  pageTitle,
  textMuted,
  textPrimary,
  textSecondary,
} from "../../styles";

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

interface Leaderboard {
  id: string;
  referenceName: string;
  vendorIdentifier: string;
  defaultFormatter: string;
  archived: boolean;
  scoreSortType: string;
  submissionType: string;
}

interface LeaderboardLocalization {
  id: string;
  locale: string;
  name: string;
  formatterSuffix: string;
  formatterSuffixSingular: string;
}

const FORMATTER_LABELS: Record<string, string> = {
  INTEGER: "Integer",
  DECIMAL: "Decimal",
  FRACTION: "Fraction",
  ELAPSED_TIME_MILLISECONDS: "Time (ms)",
  ELAPSED_TIME_SECONDS: "Time (s)",
  ELAPSED_TIME_MINUTES: "Time (min)",
  ELAPSED_TIME_HOURS: "Time (h)",
  ELAPSED_TIME: "Elapsed Time",
  MONEY: "Money",
  FIXED_POINT: "Fixed Point",
};

const SORT_LABELS: Record<string, string> = {
  HIGH_TO_LOW: "High to Low",
  LOW_TO_HIGH: "Low to High",
};

const FORMATTERS = Object.keys(FORMATTER_LABELS);

const COMMON_LOCALES = [
  "en-US",
  "de-DE",
  "fr-FR",
  "es-ES",
  "it-IT",
  "ja-JP",
  "zh-Hans",
  "zh-Hant",
  "ko-KR",
  "pt-BR",
  "ru-RU",
  "nl-NL",
  "sv-SE",
  "no-NO",
  "da-DA",
  "fi-FI",
  "pl-PL",
  "tr-TR",
  "ar-SA",
];

interface LbFormState {
  referenceName: string;
  vendorIdentifier: string;
  defaultFormatter: string;
  scoreSortType: string;
  submissionType: string;
}

const emptyLbForm = (): LbFormState => ({
  referenceName: "",
  vendorIdentifier: "",
  defaultFormatter: "INTEGER",
  scoreSortType: "HIGH_TO_LOW",
  submissionType: "INDIVIDUAL",
});

interface LbFormProps {
  initial?: Partial<LbFormState>;
  onSave: (v: LbFormState) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  title: string;
  lockVendorId?: boolean;
}

function LbForm({ initial, onSave, onCancel, saving, title, lockVendorId }: LbFormProps) {
  const [form, setForm] = useState<LbFormState>({
    ...emptyLbForm(),
    ...initial,
  });
  const set = (k: keyof LbFormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className={`rounded-xl border ${borderDefault} bg-[#fafbfc] dark:bg-[#1c2028] p-4 flex flex-col gap-3`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wider ${textSecondary}`}>{title}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={`text-[11px] ${textSecondary} font-medium`}>Reference Name</label>
          <input
            className={inputCls}
            value={form.referenceName}
            onChange={(e) => set("referenceName", e.target.value)}
            placeholder="e.g. All-Time High Score"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={`text-[11px] ${textSecondary} font-medium`}>Vendor Identifier</label>
          <input
            className={inputCls}
            value={form.vendorIdentifier}
            onChange={(e) => set("vendorIdentifier", e.target.value)}
            placeholder="e.g. com.app.leaderboard.alltime"
            disabled={lockVendorId}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={`text-[11px] ${textSecondary} font-medium`}>Score Format</label>
          <select
            className={inputCls}
            value={form.defaultFormatter}
            onChange={(e) => set("defaultFormatter", e.target.value)}
          >
            {FORMATTERS.map((f) => (
              <option key={f} value={f}>
                {FORMATTER_LABELS[f]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={`text-[11px] ${textSecondary} font-medium`}>Sort Order</label>
          <select
            className={inputCls}
            value={form.scoreSortType}
            onChange={(e) => set("scoreSortType", e.target.value)}
          >
            <option value="HIGH_TO_LOW">High to Low</option>
            <option value="LOW_TO_HIGH">Low to High</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={`text-[11px] ${textSecondary} font-medium`}>Submission Type</label>
          <select
            className={inputCls}
            value={form.submissionType}
            onChange={(e) => set("submissionType", e.target.value)}
          >
            <option value="INDIVIDUAL">Individual</option>
            <option value="TEAM">Team</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 justify-end mt-1">
        <button onClick={onCancel} disabled={saving} className={btnSecondary}>
          Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.referenceName.trim() || !form.vendorIdentifier.trim()}
          className={btnPrimary}
        >
          {saving ? (
            <>
              <div className="spinner !w-3.5 !h-3.5" /> Saving…
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5" /> Save
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function LocalizationsPanel({ leaderboard, addToast }: { leaderboard: Leaderboard; addToast: Props["addToast"] }) {
  const [locs, setLocs] = useState<LeaderboardLocalization[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newLocale, setNewLocale] = useState("en-US");
  const [newName, setNewName] = useState("");
  const [newSuffix, setNewSuffix] = useState("");
  const [newSuffixSingular, setNewSuffixSingular] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSuffix, setEditSuffix] = useState("");
  const [editSuffixSingular, setEditSuffixSingular] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const bundleId = getActiveBundleId();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = bundleId ? `?bundleId=${encodeURIComponent(bundleId)}` : "";
      const res = await fetch(`/api/asc/gamecenter/leaderboards/${leaderboard.id}/localizations${params}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setLocs(await res.json());
    } catch (err: any) {
      addToast(err.message, "error");
      setLocs([]);
    } finally {
      setLoading(false);
    }
  }, [leaderboard.id, bundleId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    if (!newName.trim() || !newLocale) return;
    setSaving(true);
    try {
      const res = await fetch("/api/asc/gamecenter/leaderboard-localizations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          bundleId,
          leaderboardId: leaderboard.id,
          locale: newLocale,
          name: newName.trim(),
          ...(newSuffix.trim() ? { formatterSuffix: newSuffix.trim() } : {}),
          ...(newSuffixSingular.trim() ? { formatterSuffixSingular: newSuffixSingular.trim() } : {}),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const created = await res.json();
      setLocs((prev) => [...(prev ?? []), created]);
      setShowAdd(false);
      setNewLocale("en-US");
      setNewName("");
      setNewSuffix("");
      setNewSuffixSingular("");
      addToast("Localization added", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (loc: LeaderboardLocalization) => {
    setEditingId(loc.id);
    setEditName(loc.name);
    setEditSuffix(loc.formatterSuffix);
    setEditSuffixSingular(loc.formatterSuffixSingular);
  };

  const handleEdit = async (id: string) => {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/asc/gamecenter/leaderboard-localizations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          bundleId,
          name: editName.trim(),
          formatterSuffix: editSuffix.trim(),
          formatterSuffixSingular: editSuffixSingular.trim(),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setLocs(
        (prev) =>
          prev?.map((l) =>
            l.id === id
              ? {
                  ...l,
                  name: editName.trim(),
                  formatterSuffix: editSuffix.trim(),
                  formatterSuffixSingular: editSuffixSingular.trim(),
                }
              : l,
          ) ?? null,
      );
      setEditingId(null);
      addToast("Localization updated", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(
        `/api/asc/gamecenter/leaderboard-localizations/${id}?bundleId=${encodeURIComponent(bundleId ?? "")}`,
        { method: "DELETE", headers: authHeaders() },
      );
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setLocs((prev) => prev?.filter((l) => l.id !== id) ?? null);
      addToast("Localization deleted", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-4 flex items-center justify-center">
        <div className="spinner w-4 h-4" />
      </div>
    );
  }

  const existingLocales = new Set(locs?.map((l) => l.locale) ?? []);

  return (
    <div className="flex flex-col gap-3 py-2">
      <div className="flex items-center justify-between">
        <span
          className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${textSecondary}`}
        >
          <Globe className="w-3.5 h-3.5" />
          Localizations
        </span>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)} className={btnSecSm}>
            <Plus className="w-3 h-3" /> Add
          </button>
        )}
      </div>

      {showAdd && (
        <div className={`rounded-xl border ${borderDefault} bg-[#fafbfc] dark:bg-[#1c2028] p-3 flex flex-col gap-2`}>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className={`text-[11px] ${textSecondary} font-medium`}>Locale</label>
              <select className={inputCls} value={newLocale} onChange={(e) => setNewLocale(e.target.value)}>
                {COMMON_LOCALES.filter((l) => !existingLocales.has(l)).map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={`text-[11px] ${textSecondary} font-medium`}>Display Name</label>
              <input
                className={inputCls}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. High Score"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={`text-[11px] ${textSecondary} font-medium`}>Score Suffix (plural)</label>
              <input
                className={inputCls}
                value={newSuffix}
                onChange={(e) => setNewSuffix(e.target.value)}
                placeholder="e.g. points"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={`text-[11px] ${textSecondary} font-medium`}>Score Suffix (singular)</label>
              <input
                className={inputCls}
                value={newSuffixSingular}
                onChange={(e) => setNewSuffixSingular(e.target.value)}
                placeholder="e.g. point"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} disabled={saving} className={btnSecondary}>
              Cancel
            </button>
            <button onClick={handleAdd} disabled={saving || !newName.trim()} className={btnPrimary}>
              {saving ? (
                <>
                  <div className="spinner !w-3.5 !h-3.5" /> Saving…
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> Add
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {!locs || locs.length === 0 ? (
        <p className={`text-[12px] ${textMuted}`}>No localizations yet.</p>
      ) : (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className={TH}>Locale</th>
              <th className={TH}>Name</th>
              <th className={TH}>Suffix (plural)</th>
              <th className={TH}>Suffix (singular)</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {locs.map((loc) =>
              editingId === loc.id ? (
                <tr key={loc.id}>
                  <td className={TD}>
                    <span className={`text-[12px] font-mono ${textSecondary}`}>{loc.locale}</span>
                  </td>
                  <td className={TD}>
                    <input className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </td>
                  <td className={TD}>
                    <input
                      className={inputCls}
                      value={editSuffix}
                      onChange={(e) => setEditSuffix(e.target.value)}
                      placeholder="points"
                    />
                  </td>
                  <td className={TD}>
                    <input
                      className={inputCls}
                      value={editSuffixSingular}
                      onChange={(e) => setEditSuffixSingular(e.target.value)}
                      placeholder="point"
                    />
                  </td>
                  <td className={TD}>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleEdit(loc.id)}
                        disabled={savingEdit || !editName.trim()}
                        className={btnPrimary}
                      >
                        {savingEdit ? <div className="spinner !w-3.5 !h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setEditingId(null)} disabled={savingEdit} className={btnSecSm}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={loc.id}>
                  <td className={TD}>
                    <span className={`text-[12px] font-mono ${textSecondary}`}>{loc.locale}</span>
                  </td>
                  <td className={`${TD} ${textPrimary} font-medium text-[13px]`}>{loc.name}</td>
                  <td className={`${TD} ${textSecondary} text-[12px]`}>{loc.formatterSuffix || "—"}</td>
                  <td className={`${TD} ${textSecondary} text-[12px]`}>{loc.formatterSuffixSingular || "—"}</td>
                  <td className={TD}>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => startEdit(loc)} className={btnSecSm}>
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(loc.id)}
                        disabled={deletingId === loc.id}
                        className={`${btnSecSm} hover:!text-red-600 hover:!border-red-200`}
                      >
                        {deletingId === loc.id ? <div className="spinner !w-3 !h-3" /> : <Trash2 className="w-3 h-3" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Leaderboards({ addToast }: Props) {
  const [leaderboards, setLeaderboards] = useState<Leaderboard[] | null>(null);
  const [gcDetailId, setGcDetailId] = useState<string | null>(null);
  const [gcEnabled, setGcEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLb, setEditingLb] = useState<Leaderboard | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const bundleId = getActiveBundleId();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = bundleId ? `?bundleId=${encodeURIComponent(bundleId)}` : "";
      const res = await fetch(`/api/asc/gamecenter/leaderboards${params}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const data = await res.json();
      setLeaderboards(data.leaderboards ?? []);
      setGcDetailId(data.gcDetailId ?? null);
      setGcEnabled(data.gcEnabled ?? false);
    } catch (err: any) {
      addToast(err.message, "error");
      setLeaderboards([]);
    } finally {
      setLoading(false);
    }
  }, [bundleId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("app-changed", handler);
    return () => window.removeEventListener("app-changed", handler);
  }, [load]);

  const handleCreate = async (form: LbFormState) => {
    if (!gcDetailId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/asc/gamecenter/leaderboards", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ bundleId, gcDetailId, ...form }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const created: Leaderboard = await res.json();
      setLeaderboards((prev) => [...(prev ?? []), created]);
      setShowCreate(false);
      addToast("Leaderboard created", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (lb: Leaderboard) => {
    setEditingId(lb.id);
    setEditingLb(lb);
  };

  const handleEdit = async (form: LbFormState) => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/asc/gamecenter/leaderboards/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          bundleId,
          referenceName: form.referenceName,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setLeaderboards(
        (prev) => prev?.map((lb) => (lb.id === editingId ? { ...lb, referenceName: form.referenceName } : lb)) ?? null,
      );
      setEditingId(null);
      setEditingLb(null);
      addToast("Leaderboard updated", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const params = bundleId ? `?bundleId=${encodeURIComponent(bundleId)}` : "";
      const res = await fetch(`/api/asc/gamecenter/leaderboards/${id}${params}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setLeaderboards((prev) => prev?.filter((lb) => lb.id !== id) ?? null);
      if (expandedId === id) setExpandedId(null);
      addToast("Leaderboard deleted", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleArchiveToggle = async (lb: Leaderboard) => {
    try {
      const res = await fetch(`/api/asc/gamecenter/leaderboards/${lb.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ bundleId, archived: !lb.archived }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setLeaderboards((prev) => prev?.map((l) => (l.id === lb.id ? { ...l, archived: !lb.archived } : l)) ?? null);
      addToast(lb.archived ? "Unarchived" : "Archived", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={pageTitle}>Leaderboards</h1>
          <p className={`text-sm mt-0.5 ${textSecondary}`}>Manage Game Center leaderboards for this app.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className={btnSecSm} title="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          {gcEnabled && gcDetailId && !showCreate && (
            <button onClick={() => setShowCreate(true)} className={btnPrimary}>
              <Plus className="w-4 h-4" /> New Leaderboard
            </button>
          )}
        </div>
      </div>

      {showCreate && gcDetailId && (
        <LbForm title="New Leaderboard" onSave={handleCreate} onCancel={() => setShowCreate(false)} saving={creating} />
      )}

      {loading && !leaderboards ? (
        <div className={`${cardCls} flex items-center justify-center py-12`}>
          <div className="spinner w-5 h-5" />
        </div>
      ) : gcEnabled === false ? (
        <div className={`${cardCls} flex flex-col items-center justify-center py-12 gap-3`}>
          <Trophy className="w-10 h-10 text-[#9ca3af] dark:text-[#5c6478]" />
          <p className={`text-sm font-medium ${textSecondary}`}>Game Center is not enabled for this app.</p>
          <p className={`text-xs ${textMuted} text-center max-w-sm`}>
            Enable Game Center in App Store Connect under your app's Features tab, then refresh.
          </p>
        </div>
      ) : leaderboards && leaderboards.length === 0 ? (
        <div className={`${cardCls} flex flex-col items-center justify-center py-12 gap-3`}>
          <Trophy className="w-10 h-10 text-[#9ca3af] dark:text-[#5c6478]" />
          <p className={`text-sm font-medium ${textSecondary}`}>No leaderboards yet.</p>
          {gcDetailId && (
            <button onClick={() => setShowCreate(true)} className={btnPrimary}>
              <Plus className="w-4 h-4" /> Create First Leaderboard
            </button>
          )}
        </div>
      ) : (
        <div className={cardCls}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className={TH}>Reference Name</th>
                <th className={TH}>Vendor Identifier</th>
                <th className={TH}>Format</th>
                <th className={TH}>Sort</th>
                <th className={TH}>Status</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {(leaderboards ?? []).map((lb) => (
                <>
                  {editingId === lb.id && editingLb ? (
                    <tr key={`edit-${lb.id}`}>
                      <td colSpan={6} className="px-4 py-3">
                        <LbForm
                          title="Edit Leaderboard"
                          initial={{
                            referenceName: editingLb.referenceName,
                            vendorIdentifier: editingLb.vendorIdentifier,
                            defaultFormatter: editingLb.defaultFormatter,
                            scoreSortType: editingLb.scoreSortType,
                            submissionType: editingLb.submissionType,
                          }}
                          onSave={handleEdit}
                          onCancel={() => {
                            setEditingId(null);
                            setEditingLb(null);
                          }}
                          saving={saving}
                          lockVendorId
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={lb.id}
                      className="hover:bg-[#fafbfc] dark:hover:bg-[#1a1f2a] transition-colors cursor-pointer"
                      onClick={() => setExpandedId((prev) => (prev === lb.id ? null : lb.id))}
                    >
                      <td className={`${TD} ${textPrimary} font-medium`}>
                        <div className="flex items-center gap-2">
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${expandedId === lb.id ? "rotate-180" : ""}`}
                          />
                          {lb.referenceName}
                        </div>
                      </td>
                      <td className={`${TD} font-mono text-[12px] ${textSecondary}`}>{lb.vendorIdentifier}</td>
                      <td className={`${TD} text-[12px] ${textSecondary}`}>
                        {FORMATTER_LABELS[lb.defaultFormatter] ?? lb.defaultFormatter}
                      </td>
                      <td className={`${TD} text-[12px] ${textSecondary}`}>
                        {SORT_LABELS[lb.scoreSortType] ?? lb.scoreSortType}
                      </td>
                      <td className={TD}>
                        {lb.archived ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-[#252b38] dark:text-[#8b93a5]">
                            <Archive className="w-3 h-3" /> Archived
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        )}
                      </td>
                      <td className={TD} onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleArchiveToggle(lb)}
                            className={btnSecSm}
                            title={lb.archived ? "Unarchive" : "Archive"}
                          >
                            <Archive className="w-3 h-3" />
                          </button>
                          <button onClick={() => startEdit(lb)} className={btnSecSm}>
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDelete(lb.id)}
                            disabled={deletingId === lb.id}
                            className={`${btnSecSm} hover:!text-red-600 hover:!border-red-200`}
                          >
                            {deletingId === lb.id ? (
                              <div className="spinner !w-3 !h-3" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {expandedId === lb.id && editingId !== lb.id && (
                    <tr key={`expanded-${lb.id}`}>
                      <td
                        colSpan={6}
                        className="px-6 pb-4 bg-[#fafbfc] dark:bg-[#161b24] border-b border-[#f3f4f6] dark:border-[#2a2f3d]"
                      >
                        <LocalizationsPanel leaderboard={lb} addToast={addToast} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
