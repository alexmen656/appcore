import { useState, useCallback, useEffect, useRef } from "react";
import {
  Plus,
  RefreshCw,
  ChevronDown,
  Pencil,
  Trash2,
  X,
  Check,
  Repeat2,
  Globe,
  DollarSign,
} from "lucide-react";
import { authHeaders, getActiveBundleId } from "../hooks/useApi";
import {
  cardCls,
  inputCls,
  btnPrimary,
  btnSecondary,
  btnSecSm,
} from "../styles";
import type {
  SubscriptionGroup,
  SubscriptionItem,
  SubscriptionLocalization,
  SubscriptionPrice,
  SubscriptionPricePoint,
} from "../types";

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

const PERIOD_LABELS: Record<string, string> = {
  ONE_WEEK: "1 Week",
  ONE_MONTH: "1 Month",
  TWO_MONTHS: "2 Months",
  THREE_MONTHS: "3 Months",
  SIX_MONTHS: "6 Months",
  ONE_YEAR: "1 Year",
};

const PERIODS = Object.keys(PERIOD_LABELS);

const STATE_COLORS: Record<string, string> = {
  APPROVED:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  READY_TO_SUBMIT:
    "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  MISSING_METADATA:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  WAITING_FOR_REVIEW:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  IN_REVIEW:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  REJECTED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  DEVELOPER_ACTION_NEEDED:
    "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  DEVELOPER_REMOVED_FROM_SALE:
    "bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400",
  REMOVED_FROM_SALE:
    "bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400",
  PENDING_BINARY_APPROVAL:
    "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
};

const STATE_SHORT: Record<string, string> = {
  APPROVED: "Approved",
  READY_TO_SUBMIT: "Ready",
  MISSING_METADATA: "Missing Metadata",
  WAITING_FOR_REVIEW: "In Review Queue",
  IN_REVIEW: "In Review",
  REJECTED: "Rejected",
  DEVELOPER_ACTION_NEEDED: "Action Needed",
  DEVELOPER_REMOVED_FROM_SALE: "Removed",
  REMOVED_FROM_SALE: "Removed",
  PENDING_BINARY_APPROVAL: "Pending",
};

function StateTag({ state }: { state: string }) {
  const cls =
    STATE_COLORS[state] ??
    "bg-gray-100 text-gray-500 dark:bg-[#252b38] dark:text-[#8b93a5]";
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}
    >
      {STATE_SHORT[state] ?? state}
    </span>
  );
}

interface SubFormState {
  name: string;
  productId: string;
  familySharable: boolean;
  subscriptionPeriod: string;
  reviewNote: string;
  groupLevel: string;
}

const emptySubForm = (): SubFormState => ({
  name: "",
  productId: "",
  familySharable: false,
  subscriptionPeriod: "ONE_MONTH",
  reviewNote: "",
  groupLevel: "1",
});

interface SubFormProps {
  initial?: Partial<SubFormState>;
  onSave: (v: SubFormState) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  title: string;
}

function SubForm({ initial, onSave, onCancel, saving, title }: SubFormProps) {
  const [form, setForm] = useState<SubFormState>({
    ...emptySubForm(),
    ...initial,
  });
  const set = (k: keyof SubFormState, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="rounded-xl border border-[#eef0f3] dark:border-[#2a2f3d] bg-[#fafbfc] dark:bg-[#1c2028] p-4 flex flex-col gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280] dark:text-[#8b93a5]">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-[#6b7280] dark:text-[#8b93a5] font-medium">
            Display Name
          </label>
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Pro Monthly"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-[#6b7280] dark:text-[#8b93a5] font-medium">
            Product ID
          </label>
          <input
            className={inputCls}
            value={form.productId}
            onChange={(e) => set("productId", e.target.value)}
            placeholder="e.g. com.app.pro.monthly"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-[#6b7280] dark:text-[#8b93a5] font-medium">
            Period
          </label>
          <select
            className={inputCls}
            value={form.subscriptionPeriod}
            onChange={(e) => set("subscriptionPeriod", e.target.value)}
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-[#6b7280] dark:text-[#8b93a5] font-medium">
            Group Level
          </label>
          <input
            className={inputCls}
            type="number"
            min={1}
            max={10}
            value={form.groupLevel}
            onChange={(e) => set("groupLevel", e.target.value)}
            placeholder="1"
          />
        </div>
        <div className="flex flex-col gap-1 col-span-2">
          <label className="text-[11px] text-[#6b7280] dark:text-[#8b93a5] font-medium">
            Review Note (optional)
          </label>
          <input
            className={inputCls}
            value={form.reviewNote}
            onChange={(e) => set("reviewNote", e.target.value)}
            placeholder="Notes for App Review"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="familySharable"
          type="checkbox"
          checked={form.familySharable}
          onChange={(e) => set("familySharable", e.target.checked)}
          className="w-4 h-4 accent-[#C4001E]"
        />
        <label
          htmlFor="familySharable"
          className="text-[12px] text-[#374151] dark:text-[#c4cad8]"
        >
          Family sharing enabled
        </label>
      </div>
      <div className="flex gap-2 justify-end mt-1">
        <button onClick={onCancel} disabled={saving} className={btnSecondary}>
          Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.name.trim() || !form.productId.trim()}
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

function LocalizationsPanel({
  subscriptionId,
  addToast,
}: {
  subscriptionId: string;
  addToast: Props["addToast"];
}) {
  const [locs, setLocs] = useState<SubscriptionLocalization[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newLocale, setNewLocale] = useState("en-US");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/asc/subscriptions/${subscriptionId}/localizations`, {
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
  }, [subscriptionId]);

  useEffect(() => { load(); }, [load]);

  const addLoc = async () => {
    if (!newLocale.trim() || !newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/asc/subscriptions/localizations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          subscriptionId,
          locale: newLocale.trim(),
          name: newName.trim(),
          description: newDesc.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setLocs((l) => [...(l ?? []), json]);
      setShowAdd(false);
      setNewLocale("en-US");
      setNewName("");
      setNewDesc("");
      addToast("Localization added", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (id: string) => {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/asc/subscriptions/localizations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name: editName, description: editDesc }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setLocs((l) =>
        l?.map((loc) =>
          loc.id === id ? { ...loc, name: editName, description: editDesc } : loc,
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

  const deleteLoc = async (id: string) => {
    if (!confirm("Delete this localization?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/asc/subscriptions/localizations/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setLocs((l) => l?.filter((loc) => loc.id !== id) ?? null);
      addToast("Localization deleted", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading && !locs) {
    return (
      <div className="flex items-center gap-1.5 py-3 text-[12px] text-[#9ca3af] dark:text-[#5c6478]">
        <div className="spinner !w-3 !h-3" /> Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {locs?.length === 0 && !showAdd && (
        <p className="text-[12px] text-[#9ca3af] dark:text-[#5c6478] py-2">
          No localizations yet.
        </p>
      )}
      {locs?.map((loc) =>
        editingId === loc.id ? (
          <div
            key={loc.id}
            className="rounded-lg border border-[#eef0f3] dark:border-[#2a2f3d] bg-[#fafbfc] dark:bg-[#1c2028] p-3 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-semibold text-[#6b7280] dark:text-[#8b93a5] uppercase">
                {loc.locale}
              </span>
            </div>
            <input
              className={inputCls}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Display name"
            />
            <input
              className={inputCls}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Description (optional)"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingId(null)} className={btnSecSm}>
                Cancel
              </button>
              <button
                onClick={() => saveEdit(loc.id)}
                disabled={savingEdit || !editName.trim()}
                className={btnSecSm}
              >
                {savingEdit ? <div className="spinner !w-3 !h-3" /> : <Check className="w-3 h-3" />}
                Save
              </button>
            </div>
          </div>
        ) : (
          <div
            key={loc.id}
            className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-white dark:bg-[#1c2028] border border-[#eef0f3] dark:border-[#2a2f3d]"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-semibold text-[#6b7280] dark:text-[#8b93a5] uppercase shrink-0">
                  {loc.locale}
                </span>
                <span className="text-[13px] font-medium text-[#111827] dark:text-[#e8eaf0] truncate">
                  {loc.name}
                </span>
              </div>
              {loc.description && (
                <p className="text-[11px] text-[#9ca3af] dark:text-[#5c6478] mt-0.5 truncate">
                  {loc.description}
                </p>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => {
                  setEditingId(loc.id);
                  setEditName(loc.name);
                  setEditDesc(loc.description ?? "");
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-[#C4001E] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={() => deleteLoc(loc.id)}
                disabled={deletingId === loc.id}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all disabled:opacity-50"
              >
                {deletingId === loc.id ? <div className="spinner !w-3 !h-3" /> : <Trash2 className="w-3 h-3" />}
              </button>
            </div>
          </div>
        ),
      )}

      {showAdd ? (
        <div className="rounded-lg border border-[#eef0f3] dark:border-[#2a2f3d] bg-[#fafbfc] dark:bg-[#1c2028] p-3 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-[#6b7280] dark:text-[#8b93a5] font-medium">Locale</label>
              <input
                className={inputCls}
                value={newLocale}
                onChange={(e) => setNewLocale(e.target.value)}
                placeholder="en-US"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-[#6b7280] dark:text-[#8b93a5] font-medium">Display Name</label>
              <input
                className={inputCls}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Pro"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-[#6b7280] dark:text-[#8b93a5] font-medium">Description (optional)</label>
            <input
              className={inputCls}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Unlock all features"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className={btnSecSm}>
              Cancel
            </button>
            <button
              onClick={addLoc}
              disabled={saving || !newLocale.trim() || !newName.trim()}
              className={btnSecSm}
            >
              {saving ? <div className="spinner !w-3 !h-3" /> : <Plus className="w-3 h-3" />}
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-[12px] text-[#9ca3af] dark:text-[#5c6478] hover:text-[#C4001E] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add localization
        </button>
      )}
    </div>
  );
}

function PricingPanel({
  subscriptionId,
  addToast,
}: {
  subscriptionId: string;
  addToast: Props["addToast"];
}) {
  const [prices, setPrices] = useState<SubscriptionPrice[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [territory, setTerritory] = useState("USA");
  const [pricePoints, setPricePoints] = useState<SubscriptionPricePoint[] | null>(null);
  const [loadingPP, setLoadingPP] = useState(false);
  const [selectedPP, setSelectedPP] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPrices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/asc/subscriptions/${subscriptionId}/prices`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setPrices(await res.json());
    } catch (err: any) {
      addToast(err.message, "error");
      setPrices([]);
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => { loadPrices(); }, [loadPrices]);

  const loadPricePoints = useCallback(async (terr: string) => {
    if (!terr.trim()) return;
    setLoadingPP(true);
    setPricePoints(null);
    setSelectedPP("");
    try {
      const res = await fetch(
        `/api/asc/subscriptions/${subscriptionId}/price-points?territory=${encodeURIComponent(terr.trim())}`,
        { headers: authHeaders() },
      );
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const data: SubscriptionPricePoint[] = await res.json();
      setPricePoints(data);
      if (data.length > 0) setSelectedPP(data[0].id);
    } catch (err: any) {
      addToast(err.message, "error");
      setPricePoints([]);
    } finally {
      setLoadingPP(false);
    }
  }, [subscriptionId]);

  const handleTerritoryChange = (val: string) => {
    setTerritory(val);
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(() => loadPricePoints(val), 600);
  };

  const openAdd = () => {
    setShowAdd(true);
    loadPricePoints(territory);
  };

  const addPrice = async () => {
    if (!selectedPP) return;
    setSaving(true);
    try {
      const res = await fetch("/api/asc/subscriptions/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ subscriptionId, pricePointId: selectedPP, territory }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setShowAdd(false);
      await loadPrices();
      addToast("Price set", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const deletePrice = async (id: string) => {
    if (!confirm("Remove this price?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/asc/subscriptions/prices/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setPrices((p) => p?.filter((pr) => pr.id !== id) ?? null);
      addToast("Price removed", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading && !prices) {
    return (
      <div className="flex items-center gap-1.5 py-3 text-[12px] text-[#9ca3af] dark:text-[#5c6478]">
        <div className="spinner !w-3 !h-3" /> Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {prices?.length === 0 && !showAdd && (
        <p className="text-[12px] text-[#9ca3af] dark:text-[#5c6478] py-2">
          No prices set yet.
        </p>
      )}
      {prices && prices.length > 0 && (
        <div className="rounded-lg border border-[#eef0f3] dark:border-[#2a2f3d] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#f3f4f6] dark:border-[#2a2f3d] bg-[#fafbfc] dark:bg-[#1c2028]">
                <th className="text-left text-[11px] font-medium uppercase tracking-wide text-[#9ca3af] dark:text-[#5c6478] px-3 py-2">Territory</th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wide text-[#9ca3af] dark:text-[#5c6478] px-3 py-2">Currency</th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wide text-[#9ca3af] dark:text-[#5c6478] px-3 py-2">Customer Price</th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wide text-[#9ca3af] dark:text-[#5c6478] px-3 py-2">Proceeds</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {prices.map((p) => (
                <tr key={p.id} className="border-b border-[#f3f4f6] dark:border-[#2a2f3d] last:border-0 bg-white dark:bg-[#1c2028]">
                  <td className="px-3 py-2.5 text-[12px] font-mono font-medium text-[#111827] dark:text-[#e8eaf0]">{p.territory ?? "—"}</td>
                  <td className="px-3 py-2.5 text-[12px] text-[#6b7280] dark:text-[#8b93a5]">{p.currency ?? "—"}</td>
                  <td className="px-3 py-2.5 text-[12px] font-semibold text-[#111827] dark:text-[#e8eaf0]">
                    {p.customerPrice != null ? `${p.currency ?? ""} ${p.customerPrice}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-[#6b7280] dark:text-[#8b93a5]">{p.proceeds ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={() => deletePrice(p.id)}
                      disabled={deletingId === p.id}
                      className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all disabled:opacity-50"
                    >
                      {deletingId === p.id ? <div className="spinner !w-3 !h-3" /> : <Trash2 className="w-3 h-3" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd ? (
        <div className="rounded-lg border border-[#eef0f3] dark:border-[#2a2f3d] bg-[#fafbfc] dark:bg-[#1c2028] p-3 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-[#6b7280] dark:text-[#8b93a5] font-medium">Territory (3-letter code)</label>
              <input
                className={inputCls}
                value={territory}
                onChange={(e) => handleTerritoryChange(e.target.value.toUpperCase())}
                placeholder="USA"
                maxLength={3}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-[#6b7280] dark:text-[#8b93a5] font-medium">
                Price Tier
                {loadingPP && <span className="ml-1 text-[10px] text-[#9ca3af]">loading…</span>}
              </label>
              {pricePoints && pricePoints.length > 0 ? (
                <select
                  className={inputCls}
                  value={selectedPP}
                  onChange={(e) => setSelectedPP(e.target.value)}
                >
                  {pricePoints.map((pp) => (
                    <option key={pp.id} value={pp.id}>
                      {pp.currency} {pp.customerPrice} (proceeds: {pp.proceeds})
                    </option>
                  ))}
                </select>
              ) : (
                <div className={`${inputCls} text-[#9ca3af] dark:text-[#5c6478]`}>
                  {loadingPP ? "Loading tiers…" : pricePoints !== null ? "No tiers found" : "Enter territory first"}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className={btnSecSm}>Cancel</button>
            <button
              onClick={addPrice}
              disabled={saving || !selectedPP}
              className={btnSecSm}
            >
              {saving ? <div className="spinner !w-3 !h-3" /> : <Check className="w-3 h-3" />}
              Set Price
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 text-[12px] text-[#9ca3af] dark:text-[#5c6478] hover:text-[#C4001E] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Set price for territory
        </button>
      )}
    </div>
  );
}

interface GroupRowProps {
  group: SubscriptionGroup;
  onGroupUpdated: (id: string, referenceName: string) => void;
  onGroupDeleted: (id: string) => void;
  onSubCreated: (groupId: string, sub: SubscriptionItem) => void;
  onSubUpdated: (groupId: string, sub: SubscriptionItem) => void;
  onSubDeleted: (groupId: string, subId: string) => void;
  addToast: Props["addToast"];
}

function GroupRow({
  group,
  onGroupUpdated,
  onGroupDeleted,
  onSubCreated,
  onSubUpdated,
  onSubDeleted,
  addToast,
}: GroupRowProps) {
  const [expanded, setExpanded] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(group.referenceName);
  const [savingName, setSavingName] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [addingSubForm, setAddingSubForm] = useState(false);
  const [openDetailSub, setOpenDetailSub] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<Record<string, "localizations" | "pricing">>({});
  const [savingSub, setSavingSub] = useState(false);
  const [editingSub, setEditingSub] = useState<string | null>(null);
  const [savingSubEdit, setSavingSubEdit] = useState(false);
  const [deletingSub, setDeletingSub] = useState<string | null>(null);

  const saveName = async () => {
    if (!nameVal.trim()) return;
    setSavingName(true);
    try {
      const res = await fetch(`/api/asc/subscriptions/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ referenceName: nameVal.trim() }),
      });
      if (!res.ok)
        throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      onGroupUpdated(group.id, nameVal.trim());
      setEditingName(false);
      addToast("Group name updated", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setSavingName(false);
    }
  };

  const deleteGroup = async () => {
    if (
      !confirm(`Delete group "${group.referenceName}"? This cannot be undone.`)
    )
      return;
    setDeletingGroup(true);
    try {
      const res = await fetch(`/api/asc/subscriptions/groups/${group.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok)
        throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      onGroupDeleted(group.id);
      addToast("Group deleted", "success");
    } catch (err: any) {
      addToast(err.message, "error");
      setDeletingGroup(false);
    }
  };

  const createSub = async (form: SubFormState) => {
    setSavingSub(true);
    try {
      const res = await fetch("/api/asc/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          groupId: group.id,
          name: form.name,
          productId: form.productId,
          familySharable: form.familySharable,
          subscriptionPeriod: form.subscriptionPeriod,
          reviewNote: form.reviewNote || undefined,
          groupLevel: parseInt(form.groupLevel) || 1,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      onSubCreated(group.id, json as SubscriptionItem);
      setAddingSubForm(false);
      addToast("Subscription created", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setSavingSub(false);
    }
  };

  const updateSub = async (subId: string, form: SubFormState) => {
    setSavingSubEdit(true);
    try {
      const res = await fetch(`/api/asc/subscriptions/${subId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name: form.name,
          familySharable: form.familySharable,
          subscriptionPeriod: form.subscriptionPeriod,
          reviewNote: form.reviewNote || undefined,
          groupLevel: parseInt(form.groupLevel) || undefined,
        }),
      });
      if (!res.ok)
        throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      onSubUpdated(group.id, {
        ...group.subscriptions.find((s) => s.id === subId)!,
        name: form.name,
        familySharable: form.familySharable,
        subscriptionPeriod: form.subscriptionPeriod,
        reviewNote: form.reviewNote || null,
        groupLevel: parseInt(form.groupLevel) || null,
      });
      setEditingSub(null);
      addToast("Subscription updated", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setSavingSubEdit(false);
    }
  };

  const deleteSub = async (subId: string) => {
    const sub = group.subscriptions.find((s) => s.id === subId);
    if (!confirm(`Delete "${sub?.name}"? This cannot be undone.`)) return;
    setDeletingSub(subId);
    try {
      const res = await fetch(`/api/asc/subscriptions/${subId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok)
        throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      onSubDeleted(group.id, subId);
      addToast("Subscription deleted", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setDeletingSub(null);
    }
  };

  return (
    <div className={cardCls}>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 flex-1 min-w-0"
        >
          <ChevronDown
            className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${expanded ? "" : "-rotate-90"}`}
          />
          {editingName ? (
            <input
              className={`${inputCls} py-1 text-sm font-semibold`}
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") setEditingName(false);
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <span className="text-[15px] font-semibold text-[#111827] dark:text-[#e8eaf0] truncate">
              {group.referenceName}
            </span>
          )}
        </button>
        <span className="text-[11px] text-[#9ca3af] dark:text-[#5c6478] shrink-0">
          {group.subscriptions.length}{" "}
          {group.subscriptions.length === 1 ? "product" : "products"}
        </span>
        {editingName ? (
          <div className="flex gap-1 shrink-0">
            <button
              onClick={saveName}
              disabled={savingName}
              className={btnSecSm}
            >
              {savingName ? (
                <div className="spinner !w-3 !h-3" />
              ) : (
                <Check className="w-3 h-3" />
              )}
            </button>
            <button
              onClick={() => {
                setEditingName(false);
                setNameVal(group.referenceName);
              }}
              className={btnSecSm}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => setEditingName(true)}
              title="Rename group"
              className="p-1.5 rounded-lg text-gray-400 hover:text-[#C4001E] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={deleteGroup}
              disabled={deletingGroup}
              title="Delete group"
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all disabled:opacity-50"
            >
              {deletingGroup ? (
                <div className="spinner !w-3.5 !h-3.5" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="mt-4 flex flex-col gap-2">
          {group.subscriptions.length === 0 && !addingSubForm && (
            <p className="text-[13px] text-[#9ca3af] dark:text-[#5c6478] text-center py-4">
              No subscriptions yet
            </p>
          )}

          {group.subscriptions.map((sub) =>
            editingSub === sub.id ? (
              <SubForm
                key={sub.id}
                title="Edit Subscription"
                initial={{
                  name: sub.name,
                  productId: sub.productId,
                  familySharable: sub.familySharable,
                  subscriptionPeriod: sub.subscriptionPeriod ?? "ONE_MONTH",
                  reviewNote: sub.reviewNote ?? "",
                  groupLevel: String(sub.groupLevel ?? 1),
                }}
                onSave={(form) => updateSub(sub.id, form)}
                onCancel={() => setEditingSub(null)}
                saving={savingSubEdit}
              />
            ) : (
              <div key={sub.id} className="flex flex-col gap-0">
                <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#f7f8fa] dark:bg-[#252b38] border border-[#eef0f3] dark:border-[#2a2f3d]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#1c2028] border border-[#e5e7eb] dark:border-[#2a2f3d] flex items-center justify-center shrink-0">
                      <Repeat2 className="w-4 h-4 text-[#C4001E]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-[#111827] dark:text-[#e8eaf0] truncate">
                          {sub.name}
                        </span>
                        <StateTag state={sub.state} />
                      </div>
                      <div className="text-[11px] text-[#9ca3af] dark:text-[#5c6478] font-mono truncate mt-0.5">
                        {sub.productId}
                        {sub.subscriptionPeriod && (
                          <>
                            {" "}
                            ·{" "}
                            {PERIOD_LABELS[sub.subscriptionPeriod] ??
                              sub.subscriptionPeriod}
                          </>
                        )}
                        {sub.familySharable && <> · Family</>}
                        {sub.groupLevel != null && <> · Level {sub.groupLevel}</>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() =>
                        setOpenDetailSub(openDetailSub === sub.id ? null : sub.id)
                      }
                      title="Manage localizations & pricing"
                      className={`p-1.5 rounded-lg transition-all ${
                        openDetailSub === sub.id
                          ? "text-[#C4001E] bg-white dark:bg-[#1c2028]"
                          : "text-gray-400 hover:text-[#C4001E] hover:bg-white dark:hover:bg-[#1c2028]"
                      }`}
                    >
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${
                          openDetailSub === sub.id ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => setEditingSub(sub.id)}
                      title="Edit"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-[#C4001E] hover:bg-white dark:hover:bg-[#1c2028] transition-all"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteSub(sub.id)}
                      disabled={deletingSub === sub.id}
                      title="Delete"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all disabled:opacity-50"
                    >
                      {deletingSub === sub.id ? (
                        <div className="spinner !w-3.5 !h-3.5" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {openDetailSub === sub.id && (
                  <div className="mt-2 rounded-xl border border-[#eef0f3] dark:border-[#2a2f3d] bg-[#fafbfc] dark:bg-[#1c2028] p-3">
                    <div className="flex gap-1 mb-3">
                      <button
                        onClick={() =>
                          setDetailTab((t) => ({ ...t, [sub.id]: "localizations" }))
                        }
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                          (detailTab[sub.id] ?? "localizations") === "localizations"
                            ? "bg-white dark:bg-[#252b38] text-[#C4001E] border border-[#eef0f3] dark:border-[#2a2f3d] shadow-sm"
                            : "text-[#6b7280] dark:text-[#8b93a5] hover:text-[#C4001E]"
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5" />
                        Localizations
                      </button>
                      <button
                        onClick={() =>
                          setDetailTab((t) => ({ ...t, [sub.id]: "pricing" }))
                        }
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                          detailTab[sub.id] === "pricing"
                            ? "bg-white dark:bg-[#252b38] text-[#C4001E] border border-[#eef0f3] dark:border-[#2a2f3d] shadow-sm"
                            : "text-[#6b7280] dark:text-[#8b93a5] hover:text-[#C4001E]"
                        }`}
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        Pricing
                      </button>
                    </div>
                    {(detailTab[sub.id] ?? "localizations") === "localizations" ? (
                      <LocalizationsPanel
                        subscriptionId={sub.id}
                        addToast={addToast}
                      />
                    ) : (
                      <PricingPanel
                        subscriptionId={sub.id}
                        addToast={addToast}
                      />
                    )}
                  </div>
                )}
              </div>
            ),
          )}

          {addingSubForm ? (
            <SubForm
              title="New Subscription"
              onSave={createSub}
              onCancel={() => setAddingSubForm(false)}
              saving={savingSub}
            />
          ) : (
            <button
              onClick={() => setAddingSubForm(true)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-[#d1d5db] dark:border-[#2a2f3d] text-[13px] text-[#9ca3af] dark:text-[#5c6478] hover:border-[#C4001E] hover:text-[#C4001E] transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add subscription
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function MonetizationSubscriptions({ addToast }: Props) {
  const [groups, setGroups] = useState<SubscriptionGroup[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [showNewGroupForm, setShowNewGroupForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const bundleId = getActiveBundleId();
      const url = bundleId
        ? `/api/asc/subscriptions/groups?bundleId=${encodeURIComponent(bundleId)}`
        : "/api/asc/subscriptions/groups";
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok)
        throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setGroups(await res.json());
    } catch (err: any) {
      addToast(err.message, "error");
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => {
      setGroups(null);
      load();
    };
    window.addEventListener("app-changed", handler);
    return () => window.removeEventListener("app-changed", handler);
  }, [load]);

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);
    try {
      const bundleId = getActiveBundleId();
      const res = await fetch("/api/asc/subscriptions/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ referenceName: newGroupName.trim(), bundleId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setGroups((g) => [...(g ?? []), json as SubscriptionGroup]);
      setNewGroupName("");
      setShowNewGroupForm(false);
      addToast("Subscription group created", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleGroupUpdated = (id: string, referenceName: string) =>
    setGroups(
      (g) =>
        g?.map((group) =>
          group.id === id ? { ...group, referenceName } : group,
        ) ?? null,
    );

  const handleGroupDeleted = (id: string) =>
    setGroups((g) => g?.filter((group) => group.id !== id) ?? null);

  const handleSubCreated = (groupId: string, sub: SubscriptionItem) =>
    setGroups(
      (g) =>
        g?.map((group) =>
          group.id === groupId
            ? { ...group, subscriptions: [...group.subscriptions, sub] }
            : group,
        ) ?? null,
    );

  const handleSubUpdated = (groupId: string, sub: SubscriptionItem) =>
    setGroups(
      (g) =>
        g?.map((group) =>
          group.id === groupId
            ? {
                ...group,
                subscriptions: group.subscriptions.map((s) =>
                  s.id === sub.id ? sub : s,
                ),
              }
            : group,
        ) ?? null,
    );

  const handleSubDeleted = (groupId: string, subId: string) =>
    setGroups(
      (g) =>
        g?.map((group) =>
          group.id === groupId
            ? {
                ...group,
                subscriptions: group.subscriptions.filter(
                  (s) => s.id !== subId,
                ),
              }
            : group,
        ) ?? null,
    );

  return (
    <div className="max-w-[1440px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#111827] dark:text-[#e8eaf0] mb-1">
            Subscriptions
          </h1>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className={btnSecondary}>
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <button
            onClick={() => setShowNewGroupForm(true)}
            className={btnPrimary}
          >
            <Plus className="w-3.5 h-3.5" />
            New Group
          </button>
        </div>
      </div>

      {showNewGroupForm && (
        <div className={`${cardCls} mb-4 flex flex-col gap-3`}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280] dark:text-[#8b93a5]">
            New Subscription Group
          </p>
          <div className="flex gap-2">
            <input
              className={inputCls}
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createGroup();
                if (e.key === "Escape") setShowNewGroupForm(false);
              }}
              placeholder="e.g. Pro Access"
              autoFocus
            />
            <button
              onClick={createGroup}
              disabled={creatingGroup || !newGroupName.trim()}
              className={btnPrimary}
            >
              {creatingGroup ? (
                <div className="spinner !w-3.5 !h-3.5" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Create
            </button>
            <button
              onClick={() => setShowNewGroupForm(false)}
              className={btnSecondary}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {loading && !groups && (
        <div className="flex items-center justify-center py-16 gap-2 text-[#9ca3af] dark:text-[#5c6478] text-sm">
          <div className="spinner" /> Loading subscription groups…
        </div>
      )}

      {groups && groups.length === 0 && (
        <div
          className={`${cardCls} flex flex-col items-center justify-center py-16 gap-4 text-center`}
        >
          <div className="w-12 h-12 rounded-2xl bg-[#fef2f3] dark:bg-[#2a1f23] flex items-center justify-center">
            <Repeat2 className="w-6 h-6 text-[#C4001E]" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-[#111827] dark:text-[#e8eaf0]">
              No subscription groups
            </p>
            <p className="text-sm text-[#6b7280] dark:text-[#8b93a5] mt-1">
              Create your first group to start adding subscriptions.
            </p>
          </div>
          <button
            onClick={() => setShowNewGroupForm(true)}
            className={btnPrimary}
          >
            <Plus className="w-3.5 h-3.5" />
            New Group
          </button>
        </div>
      )}

      {groups && groups.length > 0 && (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              onGroupUpdated={handleGroupUpdated}
              onGroupDeleted={handleGroupDeleted}
              onSubCreated={handleSubCreated}
              onSubUpdated={handleSubUpdated}
              onSubDeleted={handleSubDeleted}
              addToast={addToast}
            />
          ))}
        </div>
      )}
    </div>
  );
}
