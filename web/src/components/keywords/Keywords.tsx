import { useState, useRef, useCallback } from "react";
import {
  borderDefault,
  pageTitle,
  textMuted,
  textPrimary,
  textSecondary,
} from "../../styles";
import { ChevronDown, Search } from "lucide-react";
import {
  useApi,
  apiPost,
  apiDelete,
  authHeaders,
  getActiveBundleId,
} from "../../hooks/useApi";
import { useClickOutside } from "../../hooks/useClickOutside";
import KeywordForm, { COUNTRIES } from "./KeywordForm";
import KeywordTable, { Keyword, SortKey } from "./KeywordTable";
import RankingHistoryChart, { HistoryData } from "./RankingHistoryChart";

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function Keywords({ addToast }: Props) {
  const { data, loading, refetch } = useApi<Keyword[]>("/keywords");
  const [newTerm, setNewTerm] = useState("");
  const [newCountry, setNewCountry] = useState("de");
  const [adding, setAdding] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("popularity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterCountry, setFilterCountry] = useState("");
  const [selectedKeyword, setSelectedKeyword] = useState<Keyword | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(
    menuRef,
    useCallback(() => setMenuOpen(false), []),
  );

  const triggerAction = async (endpoint: string, label: string) => {
    setRunning(endpoint);
    try {
      const res = await apiPost(`/actions/${endpoint}`, {
        bundleId: getActiveBundleId(),
      });
      addToast(res.message || `${label} started`, "success");
      setTimeout(refetch, 2000);
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setRunning(null);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-gray-400 dark:text-[#5c6478]">
        <div className="spinner" /> Loading keywords…
      </div>
    );

  const handleSort = (key: SortKey) => {
    if (key === sortBy) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir(key === "rank" ? "asc" : "desc");
    }
  };

  const keywords = data || [];
  const availableCountries = [
    ...new Set(keywords.map((k) => k.country)),
  ].sort();
  const filtered = filterCountry
    ? keywords.filter((k) => k.country === filterCountry)
    : keywords;
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "popularity")
      cmp = (a.popularity ?? -1) - (b.popularity ?? -1);
    else if (sortBy === "rank") cmp = (a.ourRank ?? 999) - (b.ourRank ?? 999);
    else if (sortBy === "difficulty")
      cmp = (a.difficulty ?? -1) - (b.difficulty ?? -1);
    else if (sortBy === "tracked")
      cmp = (a.trackingCount ?? 0) - (b.trackingCount ?? 0);
    else if (sortBy === "country") cmp = a.country.localeCompare(b.country);
    else cmp = a.term.localeCompare(b.term);
    return sortDir === "asc" ? cmp : -cmp;
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
        bundleId: getActiveBundleId(),
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
    setHistory(null);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/keywords/${kw.id}/history`, {
        headers: authHeaders(),
      });
      setHistory(await res.json());
    } catch {
      addToast("Failed to load history", "error");
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-1">
        <h1 className={`${pageTitle}`}>Keywords</h1>
        <div ref={menuRef} className="relative flex items-stretch">
          <button
            onClick={() =>
              triggerAction("discover-keywords", "Discover Keywords")
            }
            disabled={!!running}
            className="inline-flex items-center gap-1.5 pl-3.5 pr-3 py-2 rounded-l-xl text-sm font-semibold bg-[#D94412] text-white hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running === "discover-keywords" ? (
              <>
                <div className="spinner !w-3.5 !h-3.5" /> Discovering…
              </>
            ) : (
              "Discover Keywords"
            )}
          </button>
          <div className="w-px bg-[#c80b24] opacity-40" />
          <button
            onClick={() => setMenuOpen((o) => !o)}
            disabled={!!running}
            className="px-2.5 rounded-r-xl bg-[#D94412] text-white hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="More actions"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`}
            />
          </button>
          {menuOpen && (
            <div
              className={`absolute right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#1c2028] border ${borderDefault} rounded-xl shadow-lg py-1 min-w-[170px]`}
            >
              <button
                onClick={() => {
                  setMenuOpen(false);
                  triggerAction("track-keywords", "Track Rankings");
                }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] ${textPrimary} hover:bg-[#fafbfc] dark:hover:bg-[#252b38] transition-colors text-left`}
              >
                Track Rankings
              </button>
            </div>
          )}
        </div>
      </div>
      <p className={`text-sm ${textMuted} mb-8`}>
        Track keyword rankings and discover new opportunities
      </p>

      <KeywordForm
        newTerm={newTerm}
        setNewTerm={setNewTerm}
        newCountry={newCountry}
        setNewCountry={setNewCountry}
        adding={adding}
        filterCountry={filterCountry}
        setFilterCountry={setFilterCountry}
        availableCountries={availableCountries}
        onSubmit={handleAdd}
      />

      {sorted.length === 0 ? (
        <div className="py-20 text-center">
          <div className="flex justify-center mb-3 opacity-20">
            <Search className="w-12 h-12 text-[#9ca3af]" />
          </div>
          <div className={`text-sm font-medium ${textSecondary} mb-1`}>
            No keywords tracked yet
          </div>
          <div className={`text-xs ${textMuted}`}>
            Add keywords above or run a competitor keyword extraction
          </div>
        </div>
      ) : (
        <KeywordTable
          keywords={sorted}
          selectedKeyword={selectedKeyword}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
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

      <div className="text-xs text-gray-400 dark:text-[#5c6478] mt-2">
        {sorted.length}
        {filterCountry ? ` of ${keywords.length}` : ""} keyword
        {sorted.length !== 1 ? "s" : ""} tracked
      </div>
    </div>
  );
}
