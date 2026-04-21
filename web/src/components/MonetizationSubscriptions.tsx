import { useState, useCallback, useEffect } from "react";
import {
  Plus,
  RefreshCw,
  ChevronDown,
  Pencil,
  Trash2,
  X,
  Check,
  Repeat2,
} from "lucide-react";
import { authHeaders, getActiveBundleId } from "../hooks/useApi";
import {
  cardCls,
  inputCls,
  btnPrimary,
  btnSecondary,
  btnSecSm,
} from "../styles";
import type { SubscriptionGroup, SubscriptionItem } from "../types";

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
              <div
                key={sub.id}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#f7f8fa] dark:bg-[#252b38] border border-[#eef0f3] dark:border-[#2a2f3d]"
              >
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
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#111827] dark:text-[#e8eaf0]">
            Subscriptions
          </h1>
          <p className="text-sm text-[#6b7280] dark:text-[#8b93a5] mt-0.5">
            Manage your auto-renewable subscription groups and products.
          </p>
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
