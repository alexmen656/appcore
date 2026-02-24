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
      <h1 className="text-2xl font-semibold tracking-tight text-[#111827] mb-1">
        ASO Suggestions
      </h1>
      <p className="text-sm text-[#9ca3af] mb-8">
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-12 h-12 text-[#9ca3af]"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"
              />
            </svg>
          </div>
          <div className="text-sm font-medium text-[#6b7280] mb-1">
            No suggestions found
          </div>
          <div className="text-xs text-[#9ca3af]">
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
