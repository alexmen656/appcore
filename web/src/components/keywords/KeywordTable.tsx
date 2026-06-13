import { TD, TH, borderDefault, btnSecSm, textMuted, textPrimary, textSecondary } from "../../styles";
import type { Keyword } from "../../types";
import { TrendingUp, TrendingDown, ChevronUp, ChevronDown, Check } from "lucide-react";

export type { Keyword };
export type SortKey = "term" | "country" | "popularity" | "difficulty" | "opportunity" | "rank";

export const opportunityScore = (popularity: number | null, difficulty: number | null): number | null => {
  if (popularity == null || difficulty == null) return null;
  return (popularity * (100 - difficulty)) / 100;
};

const oppTagCls = (s: number) =>
  s > 50
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-300 dark:ring-emerald-800/50"
    : s > 25
      ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/25 dark:text-amber-300 dark:ring-amber-800/50"
      : "bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/25 dark:text-red-300 dark:ring-red-800/50";

const rankColor = (rank: number | null) => {
  if (rank == null) return "text-gray-400 dark:text-[#5c6478]";
  if (rank <= 5) return "text-emerald-600 font-semibold";
  if (rank <= 20) return "text-amber-600 font-semibold";
  return "text-red-500 font-semibold";
};

const trendDisplay = (trend: number | null) => {
  if (trend == null) return <span className="text-gray-400 dark:text-[#5c6478]">—</span>;
  if (trend === 0) return <span className="text-gray-400 dark:text-[#5c6478] text-xs">±0</span>;
  if (trend > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-600 font-medium text-xs">
        <TrendingUp className="w-3 h-3" />+{trend}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-red-500 font-medium text-xs">
      <TrendingDown className="w-3 h-3" />
      {trend}
    </span>
  );
};

const diffColor = (d: number | null) =>
  d == null
    ? "text-gray-400 dark:text-[#5c6478]"
    : d > 60
      ? "text-red-500 font-medium"
      : d > 30
        ? "text-amber-500 font-medium"
        : "text-emerald-600 font-medium";

interface Props {
  keywords: Keyword[];
  coveredIds: Set<string>;
  selectedKeyword: Keyword | null;
  sortBy: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  onRowClick: (k: Keyword) => void;
  onDelete: (id: string, term: string) => void;
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <span className={`inline-flex flex-col ml-1 leading-none ${active ? "opacity-100" : "opacity-25"}`}>
      <ChevronUp className={`w-4 h-4 -mb-1.5 ${active && dir === "asc" ? "text-[#D94412]" : "text-current"}`} />
      <ChevronDown className={`w-4 h-4 -mt-1 ${active && dir === "desc" ? "text-[#D94412]" : "text-current"}`} />
    </span>
  );
}

export default function KeywordTable({
  keywords,
  coveredIds,
  selectedKeyword,
  sortBy,
  sortDir,
  onSort,
  onRowClick,
  onDelete,
}: Props) {
  const col = (key: SortKey, label: string) => (
    <th
      className={`${TH} cursor-pointer select-none hover:text-[#111827] dark:hover:text-[#e8eaf0] transition-colors`}
      onClick={() => onSort(key)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        <SortIcon active={sortBy === key} dir={sortDir} />
      </span>
    </th>
  );

  return (
    <div
      className={`bg-white dark:bg-[#1c2028] border ${borderDefault} rounded-2xl overflow-hidden mb-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)]`}
    >
      <table className="w-full border-collapse table-fixed">
        <colgroup>
          <col style={{ width: "23%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "8%" }} />
        </colgroup>
        <thead>
          <tr>
            {col("term", "Keyword")}
            {col("country", "Store")}
            {col("popularity", "Popularity")}
            {col("difficulty", "Difficulty")}
            {col("opportunity", "Opportunity")}
            {col("rank", "Our Rank")}
            <th className={TH}>Trend</th>
            <th className={TH}>Top Competitors</th>
            <th className={TH}></th>
          </tr>
        </thead>
        <tbody>
          {keywords.map((k) => (
            <tr
              key={k.id}
              onClick={() => onRowClick(k)}
              className={`cursor-pointer hover:bg-gray-50/60 dark:hover:bg-white/[0.03] ${selectedKeyword?.id === k.id ? "!bg-blue-50/60 dark:!bg-blue-900/20" : ""}`}
            >
              <td className={`${TD} font-medium ${textPrimary} truncate`} title={k.term}>
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  {coveredIds.has(k.id) && (
                    <span
                      title="Covered in your app metadata (title, subtitle or keywords)"
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 shrink-0"
                    >
                      <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
                    </span>
                  )}
                  <span className="truncate">{k.term}</span>
                </span>
              </td>
              <td className={`${TD} ${textSecondary}`}>
                <span className="inline-flex items-center gap-1.5">
                  <img
                    src={`/country-flags/${k.country.toLowerCase()}.svg`}
                    alt={k.country}
                    className="w-4 h-3 rounded-xs object-cover shrink-0"
                  />
                  {k.country.toUpperCase()}
                </span>
              </td>
              <td className={TD}>
                {k.popularity != null ? (
                  <span className={`flex items-center gap-1.5 ${textPrimary}`}>
                    {k.popularity.toFixed(0)}
                    <span className="inline-block h-1 w-8 bg-[#e5e7eb] dark:bg-[#2a2f3d] rounded-sm overflow-hidden align-middle ml-1.5">
                      <span
                        className="block h-full rounded-sm"
                        style={{
                          width: `${Math.min(k.popularity, 100)}%`,
                          background: k.popularity > 60 ? "#10b981" : k.popularity > 30 ? "#f59e0b" : "#ef4444",
                        }}
                      />
                    </span>
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-[#5c6478]">—</span>
                )}
              </td>
              <td className={TD}>
                <span className={diffColor(k.difficulty)}>
                  {k.difficulty != null ? (
                    k.difficulty.toFixed(0)
                  ) : (
                    <span className="text-gray-400 dark:text-[#5c6478]">—</span>
                  )}
                </span>
              </td>
              <td className={TD}>
                {(() => {
                  const opp = opportunityScore(k.popularity, k.difficulty);
                  return opp != null ? (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ring-1 ring-inset tabular-nums ${oppTagCls(opp)}`}
                      title="Popularity × (100 − Difficulty) / 100"
                    >
                      {opp.toFixed(0)}
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-[#5c6478]">—</span>
                  );
                })()}
              </td>
              <td className={TD}>
                {k.ourRank != null ? (
                  <span className={rankColor(k.ourRank)}>#{k.ourRank}</span>
                ) : (
                  <span className={`${textMuted} text-xs`}>not ranked</span>
                )}
              </td>
              <td className={TD}>{trendDisplay(k.rankTrend)}</td>
              <td className={TD}>
                {/* {k.topCompetitor ? (
                  <span className="text-xs text-gray-500 dark:text-[#8b93a5]">
                    #{k.topCompetitor.rank}{" "}
                    <span className="text-gray-400 dark:text-[#5c6478]">
                      {k.topCompetitor.name.length > 18
                        ? k.topCompetitor.name.substring(0, 18) + "…"
                        : k.topCompetitor.name}
                    </span>
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-[#5c6478]">—</span>
                )} */}
                {k.topCompetitors.length > 0 ? (
                  <span className="inline-flex items-center -space-x-1.5">
                    {k.topCompetitors.map((c) =>
                      c.iconUrl ? (
                        <img
                          key={c.name + c.rank}
                          src={c.iconUrl}
                          alt={c.name}
                          title={`#${c.rank} ${c.name}`}
                          className="w-6 h-6 rounded-md object-cover ring-2 ring-white dark:ring-[#1c2028] shrink-0"
                        />
                      ) : (
                        <span
                          key={c.name + c.rank}
                          title={`#${c.rank} ${c.name}`}
                          className="w-6 h-6 rounded-md bg-gray-200 dark:bg-[#2a2f3d] ring-2 ring-white dark:ring-[#1c2028] shrink-0"
                        />
                      ),
                    )}
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-[#5c6478]">—</span>
                )}
              </td>
              <td className={TD}>
                <button
                  className={`${btnSecSm} !text-red-500 !border-red-100 dark:!border-red-900/40 hover:!bg-red-50 dark:hover:!bg-red-900/20`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(k.id, k.term);
                  }}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
