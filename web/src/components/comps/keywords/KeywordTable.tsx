const TH =
  "text-left text-[11px] font-semibold uppercase tracking-[0.5px] text-gray-400 px-3.5 py-2.5 border-b border-[#e5e7eb] whitespace-nowrap";
const TD = "px-3.5 py-3 border-b border-[#f0f0f0] text-[13px] align-middle";
const btnSecSm =
  "inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-lg text-xs font-medium border border-[#e5e7eb] bg-white text-[#1a1a2e] hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

export interface Keyword {
  id: string;
  term: string;
  country: string;
  language: string;
  popularity: number | null;
  difficulty: number | null;
  searchVolume: number | null;
  ourRank: number | null;
  topCompetitor: { name: string; rank: number } | null;
  trackingCount: number;
  suggestionCount: number;
  updatedAt: string;
}

const rankColor = (rank: number | null) => {
  if (rank == null) return "text-gray-400";
  if (rank <= 5) return "text-emerald-600 font-semibold";
  if (rank <= 20) return "text-amber-600 font-semibold";
  return "text-red-500 font-semibold";
};

const diffColor = (d: number | null) =>
  d == null
    ? "text-gray-400"
    : d > 60
      ? "text-red-500 font-medium"
      : d > 30
        ? "text-amber-500 font-medium"
        : "text-emerald-600 font-medium";

interface Props {
  keywords: Keyword[];
  selectedKeyword: Keyword | null;
  onRowClick: (k: Keyword) => void;
  onDelete: (id: string, term: string) => void;
}

export default function KeywordTable({
  keywords,
  selectedKeyword,
  onRowClick,
  onDelete,
}: Props) {
  return (
    <div className="bg-white border border-[#e5e7eb] rounded-lg overflow-hidden mb-5">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={TH}>Keyword</th>
            <th className={TH}>Country</th>
            <th className={TH}>Popularity</th>
            <th className={TH}>Difficulty</th>
            <th className={TH}>Results</th>
            <th className={TH}>Our Rank</th>
            <th className={TH}>Top Competitor</th>
            <th className={TH}>Tracked</th>
            <th className={TH}></th>
          </tr>
        </thead>
        <tbody>
          {keywords.map((k) => (
            <tr
              key={k.id}
              onClick={() => onRowClick(k)}
              className={`cursor-pointer hover:bg-gray-50/60 ${selectedKeyword?.id === k.id ? "!bg-blue-50/60" : ""}`}
            >
              <td className={`${TD} font-medium text-[#1a1a2e]`}>{k.term}</td>
              <td className={`${TD} text-gray-500`}>{k.country}</td>
              <td className={TD}>
                {k.popularity != null ? (
                  <span className="flex items-center gap-1.5">
                    {k.popularity.toFixed(0)}
                    <span className="inline-block h-1 w-8 bg-[#e5e7eb] rounded-sm overflow-hidden align-middle ml-1.5">
                      <span
                        className="block h-full rounded-sm"
                        style={{
                          width: `${Math.min(k.popularity, 100)}%`,
                          background:
                            k.popularity > 60
                              ? "#10b981"
                              : k.popularity > 30
                                ? "#f59e0b"
                                : "#ef4444",
                        }}
                      />
                    </span>
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className={TD}>
                <span className={diffColor(k.difficulty)}>
                  {k.difficulty != null ? (
                    k.difficulty.toFixed(0)
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </span>
              </td>
              <td className={`${TD} text-gray-500`}>
                {k.searchVolume != null ? (
                  k.searchVolume
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className={TD}>
                {k.ourRank != null ? (
                  <span className={rankColor(k.ourRank)}>#{k.ourRank}</span>
                ) : (
                  <span className="text-gray-400 text-xs">not ranked</span>
                )}
              </td>
              <td className={TD}>
                {k.topCompetitor ? (
                  <span className="text-xs text-gray-500">
                    #{k.topCompetitor.rank}{" "}
                    <span className="text-gray-400">
                      {k.topCompetitor.name.length > 18
                        ? k.topCompetitor.name.substring(0, 18) + "…"
                        : k.topCompetitor.name}
                    </span>
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className={`${TD} text-gray-400 text-xs`}>
                {k.trackingCount}×
              </td>
              <td className={TD}>
                <button
                  className={`${btnSecSm} !text-red-500 !border-red-200 hover:!bg-red-50`}
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
