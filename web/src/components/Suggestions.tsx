import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { useApi, apiPost, getActiveBundleId } from "../hooks/useApi";
import FilterBar from "./comps/suggestions/FilterBar";
import LocalePills from "./comps/suggestions/LocalePills";
import SuggestionCard, { Suggestion } from "./comps/suggestions/SuggestionCard";

interface SuggestionsData {
  suggestions: Record<string, Suggestion[]>;
  total: number;
}
interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function Suggestions({ addToast }: Props) {
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const filterQ = [
    statusFilter && `status=${statusFilter}`,
    typeFilter && `type=${typeFilter}`,
  ]
    .filter(Boolean)
    .join("&");
  const { data, loading, refetch } = useApi<SuggestionsData>(
    `/suggestions${filterQ ? `?${filterQ}` : ""}`,
    [statusFilter, typeFilter],
  );
  const [activeLocale, setActiveLocale] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const runAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await apiPost("/actions/analyze", {
        bundleId: getActiveBundleId(),
      });
      addToast(res.message || "AI analysis started", "success");
      setTimeout(refetch, 5000);
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-gray-400 dark:text-[#5c6478]">
        <div className="w-5 h-5 rounded-full border-2 border-gray-200 border-t-blue-500 animate-spin" />
        Loading suggestions…
      </div>
    );

  const groups = data?.suggestions || {};
  const locales = Object.keys(groups);
  const currentLocale = activeLocale || locales[0] || "en-US";
  const items = groups[currentLocale] || [];

  const handleAction = async (
    id: string,
    action: "approve" | "reject" | "apply",
  ) => {
    setActing(id);
    try {
      await apiPost(`/suggestions/${id}/${action}`);
      addToast(
        `Suggestion ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "applied"}`,
        "success",
      );
      refetch();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setActing(null);
    }
  };

  const handleBulkApprove = async () => {
    try {
      await apiPost("/suggestions/bulk-approve", { locale: currentLocale });
      addToast(
        `All pending suggestions for ${currentLocale} approved`,
        "success",
      );
      refetch();
    } catch (e: any) {
      addToast(e.message, "error");
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-3xl font-semibold tracking-tight text-[#111827] dark:text-[#e8eaf0]">
          ASO Suggestions
        </h1>
        <button
          onClick={runAnalyze}
          disabled={analyzing}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium bg-[#D94412] text-white hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {analyzing ? <><div className="spinner" /> Analyzing…</> : "Run AI Analysis"}
        </button>
      </div>
      <p className="text-sm text-[#9ca3af] dark:text-[#5c6478] mb-8">
        AI-generated optimization suggestions across locales
      </p>

      <FilterBar
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        currentLocale={currentLocale}
        onBulkApprove={handleBulkApprove}
      />

      <LocalePills
        locales={locales}
        groups={groups}
        currentLocale={currentLocale}
        onSelect={setActiveLocale}
      />

      {items.length === 0 ? (
        <div className="py-20 text-center">
          <div className="flex justify-center mb-3 opacity-20">
            <ClipboardList className="w-12 h-12 text-[#9ca3af]" />
          </div>
          <div className="text-sm font-medium text-[#6b7280] dark:text-[#8b93a5] mb-1">
            No suggestions found
          </div>
          <div className="text-xs text-[#9ca3af] dark:text-[#5c6478]">
            Run an AI analysis from the Actions page
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              acting={acting}
              onAction={handleAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
