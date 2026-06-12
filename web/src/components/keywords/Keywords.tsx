import { useState, useRef, useCallback, useEffect } from "react";
import { borderDefault, pageTitle, textMuted, textPrimary, textSecondary } from "../../styles";
import { ChevronDown, LayoutGrid, List, MoreHorizontal, Plus, Search, Target, Upload } from "lucide-react";
import { useApi, apiGet, apiPost, apiDelete, authHeaders, getActiveBundleId } from "../../hooks/useApi";
import { useClickOutside } from "../../hooks/useClickOutside";
import { usePermissions } from "../../hooks/usePermissions";
import { usePostHog } from "@posthog/react";
import { LANGUAGE_BY_COUNTRY } from "./storefronts";
import KeywordTable, { Keyword, SortKey, opportunityScore } from "./KeywordTable";
import KeywordFilters, { emptyFilters, KeywordFilterState } from "./KeywordFilters";
import KeywordMatrix from "./KeywordMatrix";
import MarketSelector from "./MarketSelector";
import AddKeywordsModal from "./AddKeywordsModal";
import ImportKeywordsModal from "./ImportKeywordsModal";
import RankingHistoryChart, { HistoryData } from "./RankingHistoryChart";

type ViewMode = "list" | "matrix";

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function Keywords({ addToast }: Props) {
  const posthog = usePostHog();
  const { canWrite } = usePermissions();
  const writeTip = !canWrite ? "Viewer role cannot perform this action" : undefined;
  const [items, setItems] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    setLoading(true);
    apiGet<{ items: Keyword[]; total: number }>("/keywords")
      .then((res) => setItems(res.items))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refetch();
    const handler = () => refetch();
    window.addEventListener("app-changed", handler);
    return () => window.removeEventListener("app-changed", handler);
  }, [refetch]);
  const { data: keywordFieldsData } = useApi<{
    keywordFields: Record<string, string>;
    indexedText?: Record<string, string>;
  }>("/asc/keyword-fields");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  useClickOutside(
    moreRef,
    useCallback(() => setMoreOpen(false), []),
  );
  const [sortBy, setSortBy] = useState<SortKey>("popularity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterCountry, setFilterCountry] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [filters, setFilters] = useState<KeywordFilterState>(emptyFilters);
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
      if (endpoint === "discover-keywords") {
        posthog?.capture("keyword_discovery_started", { bundle_id: getActiveBundleId() });
      }
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

  const keywords = items;
  const availableCountries = [...new Set(keywords.map((k) => k.country))].sort();
  const filtered = filterCountry ? keywords.filter((k) => k.country === filterCountry) : keywords;

  const keywordFields = keywordFieldsData?.keywordFields ?? {};
  const indexedText = keywordFieldsData?.indexedText ?? {};
  const resolveLocale = (country: string): string | null => {
    const lang = LANGUAGE_BY_COUNTRY[country] ?? "en";
    const exact = `${lang}-${country.toUpperCase()}`;
    if (keywordFields[exact] != null) return exact;
    const prefix = `${lang}-`;
    return Object.keys(keywordFields).find((l) => l.startsWith(prefix)) ?? null;
  };

  const tokenize = (s: string): string[] =>
    s
      .toLowerCase()
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);

  const stemWord = (w: string): string => {
    if (w.length > 3 && w.endsWith("ies")) return w.slice(0, -3) + "y";
    if (w.length > 3 && /(s|x|z|ch|sh)es$/.test(w)) return w.slice(0, -2);
    if (w.length > 2 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
    return w;
  };

  const poolWordsCache = new Map<string, Set<string>>();
  const poolWordsForLocale = (locale: string): Set<string> => {
    let words = poolWordsCache.get(locale);
    if (!words) {
      words = new Set(tokenize(indexedText[locale] ?? keywordFields[locale] ?? "").map(stemWord));
      poolWordsCache.set(locale, words);
    }
    return words;
  };
  const isCovered = (term: string, country: string): boolean => {
    const locale = resolveLocale(country);
    if (!locale) return false;
    const poolWords = poolWordsForLocale(locale);
    if (poolWords.size === 0) return false;
    const words = tokenize(term);
    return words.length > 0 && words.every((w) => poolWords.has(stemWord(w)));
  };
  const coveredIds = new Set(keywords.filter((k) => isCovered(k.term, k.country)).map((k) => k.id));

  const coverageLocale = filterCountry ? resolveLocale(filterCountry) : null;
  const coverageField = coverageLocale ? (keywordFields[coverageLocale] ?? "") : "";
  const coverageTotal = filtered.length;
  const coverageCovered = filterCountry ? filtered.filter((k) => coveredIds.has(k.id)).length : 0;
  const coverageChars = coverageField.length;
  const coverageRatio = coverageTotal > 0 ? coverageCovered / coverageTotal : 0;

  const numOrNull = (s: string): number | null => {
    if (s.trim() === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };
  const inRange = (v: number | null, lo: number | null, hi: number | null): boolean => {
    if (lo == null && hi == null) return true;
    if (v == null) return false;
    if (lo != null && v < lo) return false;
    if (hi != null && v > hi) return false;
    return true;
  };
  const popLo = numOrNull(filters.popMin);
  const popHi = numOrNull(filters.popMax);
  const diffLo = numOrNull(filters.diffMin);
  const diffHi = numOrNull(filters.diffMax);
  const oppLo = numOrNull(filters.oppMin);
  const oppHi = numOrNull(filters.oppMax);

  const userFiltered = filtered.filter((k) => {
    if (!inRange(k.popularity, popLo, popHi)) return false;
    if (!inRange(k.difficulty, diffLo, diffHi)) return false;
    if (!inRange(opportunityScore(k.popularity, k.difficulty), oppLo, oppHi)) return false;

    if (filters.rank !== "all") {
      const r = k.ourRank;
      if (filters.rank === "ranked" && r == null) return false;
      if (filters.rank === "unranked" && r != null) return false;
      if (filters.rank === "top10" && (r == null || r > 10)) return false;
      if (filters.rank === "top20" && (r == null || r > 20)) return false;
      if (filters.rank === "top50" && (r == null || r > 50)) return false;
    }

    if (filters.coverage === "covered" && !coveredIds.has(k.id)) return false;
    if (filters.coverage === "uncovered" && coveredIds.has(k.id)) return false;

    if (filters.trend !== "all") {
      const t = k.rankTrend;
      if (filters.trend === "up" && !(t != null && t > 0)) return false;
      if (filters.trend === "down" && !(t != null && t < 0)) return false;
      if (filters.trend === "flat" && !(t != null && t === 0)) return false;
    }

    return true;
  });

  const sorted = [...userFiltered].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "popularity") cmp = (a.popularity ?? -1) - (b.popularity ?? -1);
    else if (sortBy === "rank") cmp = (a.ourRank ?? 999) - (b.ourRank ?? 999);
    else if (sortBy === "difficulty") cmp = (a.difficulty ?? -1) - (b.difficulty ?? -1);
    else if (sortBy === "opportunity")
      cmp = (opportunityScore(a.popularity, a.difficulty) ?? -1) - (opportunityScore(b.popularity, b.difficulty) ?? -1);
    else if (sortBy === "tracked") cmp = (a.trackingCount ?? 0) - (b.trackingCount ?? 0);
    else if (sortBy === "country") cmp = a.country.localeCompare(b.country);
    else cmp = a.term.localeCompare(b.term);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const handleDelete = async (id: string, term: string) => {
    if (!canWrite) {
      addToast("Viewer role cannot perform this action", "error");
      return;
    }
    try {
      await apiDelete(`/keywords/${id}`);
      posthog?.capture("keyword_deleted", { keyword: term });
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
            onClick={() => triggerAction("discover-keywords", "Discover Keywords")}
            disabled={!!running || !canWrite}
            title={writeTip}
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
            disabled={!!running || !canWrite}
            title={writeTip}
            className="px-2.5 rounded-r-xl bg-[#D94412] text-white hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="More actions"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
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
      <p className={`text-sm ${textMuted} mb-8`}>Track keyword rankings and discover new opportunities</p>

      <div className="flex items-center gap-2.5 flex-wrap mb-6">
        <div className="flex-1" />
        {availableCountries.length > 0 && (
          <MarketSelector value={filterCountry} options={availableCountries} onChange={setFilterCountry} />
        )}
        <KeywordFilters value={filters} onChange={setFilters} />
        <button
          onClick={() => setAddModalOpen(true)}
          disabled={!canWrite}
          title={writeTip ?? "3 new AI suggestions"}
          className={`relative inline-flex items-center gap-1.5 pl-3 pr-3.5 py-[7px] rounded-full border ${borderDefault} bg-white dark:bg-[#1c2028] text-[13px] font-medium ${textPrimary} hover:border-[#D94412] hover:text-[#D94412] transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Plus className="w-3.5 h-3.5" />
          Add keywords
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#D94412] text-white text-[10px] font-bold tabular-nums ring-2 ring-white dark:ring-[#0f1117]">
            3
          </span>
        </button>
        <div
          className={`inline-flex items-center p-1 rounded-full border ${borderDefault} bg-gray-50/60 dark:bg-[#181c24]`}
        >
          <button
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold transition-all ${
              viewMode === "list"
                ? `bg-white dark:bg-[#252b38] ${textPrimary} shadow-[0_1px_2px_rgba(0,0,0,0.06)]`
                : `${textMuted} hover:${textSecondary.replace(/^text-/, "text-")}`
            }`}
          >
            <List className="w-3.5 h-3.5" /> List
          </button>
          <button
            onClick={() => setViewMode("matrix")}
            aria-pressed={viewMode === "matrix"}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold transition-all ${
              viewMode === "matrix"
                ? `bg-white dark:bg-[#252b38] ${textPrimary} shadow-[0_1px_2px_rgba(0,0,0,0.06)]`
                : `${textMuted}`
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Matrix
          </button>
        </div>
        <div ref={moreRef} className="relative">
          <button
            onClick={() => setMoreOpen((o) => !o)}
            title="More actions"
            className={`inline-flex items-center justify-center w-9 h-9 rounded-full border ${borderDefault} bg-white dark:bg-[#1c2028] ${textSecondary} hover:border-gray-300 dark:hover:border-[#3a4050] hover:${textPrimary} transition-all`}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {moreOpen && (
            <div
              className={`absolute right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#1c2028] border ${borderDefault} rounded-xl shadow-lg py-1 min-w-[200px]`}
            >
              <button
                onClick={() => {
                  setMoreOpen(false);
                  setImportModalOpen(true);
                }}
                disabled={!canWrite}
                title={writeTip}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] ${textPrimary} hover:bg-[#fafbfc] dark:hover:bg-[#252b38] transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Upload className={`w-3.5 h-3.5 ${textSecondary}`} />
                Import keywords
              </button>
            </div>
          )}
        </div>
      </div>

      <AddKeywordsModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        defaultCountry={filterCountry}
        onAdded={(count) => {
          posthog?.capture("keyword_added", { count });
          refetch();
        }}
        addToast={addToast}
      />

      <ImportKeywordsModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        defaultCountry={filterCountry}
        onImported={(count) => {
          posthog?.capture("keywords_imported", { count });
          refetch();
        }}
        addToast={addToast}
      />

      {filterCountry && coverageLocale && coverageTotal > 0 && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/15 border border-blue-100 dark:border-blue-900/30">
          <Target className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <div className={`text-[13px] font-medium ${textPrimary} shrink-0`}>
            {coverageCovered} of {coverageTotal} target keyword{coverageTotal === 1 ? "" : "s"} covered in your{" "}
            {coverageLocale} metadata
          </div>
          <div className="flex-1 h-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 overflow-hidden min-w-[60px]">
            <div
              className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all"
              style={{ width: `${Math.round(coverageRatio * 100)}%` }}
            />
          </div>
          <div className={`text-[12px] tabular-nums ${textMuted} shrink-0`}>{coverageChars} / 100 chars</div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="py-20 text-center">
          <div className="flex justify-center mb-3 opacity-20">
            <Search className="w-12 h-12 text-[#9ca3af]" />
          </div>
          <div className={`text-sm font-medium ${textSecondary} mb-1`}>No keywords tracked yet</div>
          <div className={`text-xs ${textMuted}`}>Add keywords above or run a competitor keyword extraction</div>
        </div>
      ) : viewMode === "matrix" ? (
        <KeywordMatrix keywords={sorted} onSelect={loadHistory} />
      ) : (
        <KeywordTable
          keywords={sorted}
          coveredIds={coveredIds}
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
        {sorted.length !== keywords.length ? ` of ${keywords.length}` : ""} keyword
        {sorted.length !== 1 ? "s" : ""} tracked
      </div>
    </div>
  );
}
