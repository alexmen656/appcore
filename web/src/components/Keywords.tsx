import { useState } from "react";
import { useApi, apiPost, apiDelete, authHeaders, getActiveBundleId } from "../hooks/useApi";
import KeywordForm, { COUNTRIES } from "./comps/keywords/KeywordForm";
import KeywordTable, { Keyword } from "./comps/keywords/KeywordTable";
import RankingHistoryChart, {
  HistoryData,
} from "./comps/keywords/RankingHistoryChart";

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function Keywords({ addToast }: Props) {
  const { data, loading, refetch } = useApi<Keyword[]>("/keywords");
  const [newTerm, setNewTerm] = useState("");
  const [newCountry, setNewCountry] = useState("de");
  const [adding, setAdding] = useState(false);
  const [sortBy, setSortBy] = useState<"popularity" | "term" | "rank">(
    "popularity",
  );
  const [selectedKeyword, setSelectedKeyword] = useState<Keyword | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
        <div className="spinner" /> Loading keywords…
      </div>
    );

  const keywords = data || [];
  const sorted = [...keywords].sort((a, b) => {
    if (sortBy === "popularity")
      return (b.popularity ?? -1) - (a.popularity ?? -1);
    if (sortBy === "rank") return (a.ourRank ?? 999) - (b.ourRank ?? 999);
    return a.term.localeCompare(b.term);
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerm.trim()) return;
    setAdding(true);
    const country =
      COUNTRIES.find((c) => c.code === newCountry) ?? COUNTRIES[0];
    try {
      await apiPost("/keywords", {
        term: newTerm.trim(),
        country: country.code,
        language: country.lang,
      });
      addToast(
        `Keyword "${newTerm.trim()}" (${country.code.toUpperCase()}) added`,
        "success",
      );
      setNewTerm("");
      refetch();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string, term: string) => {
    try {
      await apiDelete(`/keywords/${id}`);
      addToast(`Keyword "${term}" removed`, "info");
      refetch();
    } catch (e: any) {
      addToast(e.message, "error");
    }
  };

  const loadHistory = async (kw: Keyword) => {
    if (selectedKeyword?.id === kw.id) {
      setSelectedKeyword(null);
      setHistory(null);
      return;
    }
    setSelectedKeyword(kw);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/keywords/${kw.id}/history`, { headers: authHeaders() });
      setHistory(await res.json());
    } catch {
      addToast("Failed to load history", "error");
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-[#111827] mb-1">
        Keywords
      </h1>
      <p className="text-sm text-[#9ca3af] mb-8">
        Track keyword rankings and discover new opportunities
      </p>

      <KeywordForm
        newTerm={newTerm}
        setNewTerm={setNewTerm}
        newCountry={newCountry}
        setNewCountry={setNewCountry}
        adding={adding}
        sortBy={sortBy}
        setSortBy={setSortBy}
        onSubmit={handleAdd}
      />

      {sorted.length === 0 ? (
        <div className="py-20 text-center">
          <div className="flex justify-center mb-3 opacity-20">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-[#9ca3af]">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <div className="text-sm font-medium text-[#6b7280] mb-1">
            No keywords tracked yet
          </div>
          <div className="text-xs text-[#9ca3af]">
            Add keywords above or run a competitor keyword extraction
          </div>
        </div>
      ) : (
        <KeywordTable
          keywords={sorted}
          selectedKeyword={selectedKeyword}
          onRowClick={loadHistory}
          onDelete={handleDelete}
        />
      )}

      {selectedKeyword && (
        <RankingHistoryChart
          keyword={selectedKeyword}
          history={history}
          loading={historyLoading}
          ownBundleId={getActiveBundleId()}
          onClose={() => {
            setSelectedKeyword(null);
            setHistory(null);
          }}
        />
      )}

      <div className="text-xs text-gray-400 mt-2">
        {sorted.length} keyword{sorted.length !== 1 ? "s" : ""} tracked
      </div>
    </div>
  );
}
