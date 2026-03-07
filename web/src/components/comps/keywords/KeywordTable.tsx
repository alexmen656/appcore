import { TH, TD, btnSecSm } from "../../../styles";
import type { Keyword } from "../../../types";

export type { Keyword };

const rankColor = (rank: number | null) => {
  if (rank == null) return "text-gray-400 dark:text-[#5c6478]";
  if (rank <= 5) return "text-emerald-600 font-semibold";
  if (rank <= 20) return "text-amber-600 font-semibold";
  return "text-red-500 font-semibold";
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
    <div className="bg-white dark:bg-[#1c2028] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-2xl overflow-hidden mb-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
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
              className={`cursor-pointer hover:bg-gray-50/60 dark:hover:bg-white/[0.03] ${selectedKeyword?.id === k.id ? "!bg-blue-50/60 dark:!bg-blue-900/20" : ""}`}
            >
              <td className={`${TD} font-medium text-[#111827] dark:text-[#e8eaf0]`}>{k.term}</td>
              <td className={`${TD} text-[#6b7280] dark:text-[#8b93a5]`}>{k.country}</td>
              <td className={TD}>
                {k.popularity != null ? (
                  <span className="flex items-center gap-1.5 text-[#111827] dark:text-[#e8eaf0]">
                    {k.popularity.toFixed(0)}
                    <span className="inline-block h-1 w-8 bg-[#e5e7eb] dark:bg-[#2a2f3d] rounded-sm overflow-hidden align-middle ml-1.5">
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
              <td className={`${TD} text-[#6b7280] dark:text-[#8b93a5]`}>
                {k.searchVolume != null ? (
                  k.searchVolume
                ) : (
                  <span className="text-[#9ca3af] dark:text-[#5c6478]">--</span>
                )}
              </td>
              <td className={TD}>
                {k.ourRank != null ? (
                  <span className={rankColor(k.ourRank)}>#{k.ourRank}</span>
                ) : (
                  <span className="text-[#9ca3af] dark:text-[#5c6478] text-xs">not ranked</span>
                )}
              </td>
              <td className={TD}>
                {k.topCompetitor ? (
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
                )}
              </td>
              <td className={`${TD} text-[#9ca3af] dark:text-[#5c6478] text-xs`}>
                {k.trackingCount}×
              </td>
              <td className={TD}>
                <button
                  className={`${btnSecSm} !text-red-500 !border-red-100 hover:!bg-red-50`}
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
