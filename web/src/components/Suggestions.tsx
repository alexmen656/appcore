import { useState } from "react";
import { useApi, apiPost } from "../hooks/useApi";
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

  if (loading)
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
        <div className="spinner" /> Loading suggestions…
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
      <h1 className="text-3xl font-bold tracking-tight text-[#1a1a2e] mb-1">
        ASO Suggestions
      </h1>
      <p className="text-base text-gray-500 mb-7">
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
          <div className="text-5xl mb-3 opacity-30">📋</div>
          <div className="text-sm font-medium text-gray-500 mb-1">
            No suggestions found
          </div>
          <div className="text-xs text-gray-400">
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
