import { borderDefault, textMuted, textPrimary, textSecondary } from "../../styles";
import type { Keyword } from "../../types";
import { opportunityScore } from "./KeywordTable";

interface Props {
  keywords: Keyword[];
  onSelect: (k: Keyword) => void;
}

const dotColor = (opp: number | null) =>
  opp == null
    ? "bg-gray-400 dark:bg-[#3a4050]"
    : opp > 50
      ? "bg-emerald-500"
      : opp > 25
        ? "bg-amber-500"
        : "bg-red-500";

export default function KeywordMatrix({ keywords, onSelect }: Props) {
  const plotted = keywords.filter((k) => k.popularity != null && k.difficulty != null);

  return (
    <div
      className={`bg-white dark:bg-[#1c2028] border ${borderDefault} rounded-2xl p-5 mb-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)]`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className={`text-sm font-semibold ${textPrimary}`}>Opportunity Matrix</div>
          <div className={`text-xs ${textMuted} mt-0.5`}>Popularity vs. Difficulty — top-left is the sweet spot</div>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className={textSecondary}>High opportunity</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className={textSecondary}>Medium</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className={textSecondary}>Low</span>
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-col justify-between py-2 pr-1 text-[10px] uppercase tracking-wider font-medium text-gray-400 dark:text-[#5c6478]">
          <span>High pop.</span>
          <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }} className="self-center">
            Popularity
          </span>
          <span>Low pop.</span>
        </div>

        <div className="flex-1">
          <div
            className={`relative w-full h-[420px] rounded-xl border ${borderDefault} overflow-hidden bg-gradient-to-br from-emerald-50/40 via-transparent to-red-50/40 dark:from-emerald-900/10 dark:to-red-900/10`}
          >
            {[25, 50, 75].map((p) => (
              <div
                key={`h-${p}`}
                className="absolute left-0 right-0 border-t border-dashed border-gray-200/70 dark:border-[#2a2f3d]"
                style={{ top: `${p}%` }}
              />
            ))}
            {[25, 50, 75].map((p) => (
              <div
                key={`v-${p}`}
                className="absolute top-0 bottom-0 border-l border-dashed border-gray-200/70 dark:border-[#2a2f3d]"
                style={{ left: `${p}%` }}
              />
            ))}

            {plotted.length === 0 ? (
              <div className={`absolute inset-0 flex items-center justify-center text-xs ${textMuted}`}>
                No keywords with popularity and difficulty data
              </div>
            ) : (
              plotted.map((k) => {
                const opp = opportunityScore(k.popularity, k.difficulty);
                const x = Math.max(0, Math.min(100, k.difficulty ?? 0));
                const y = Math.max(0, Math.min(100, 100 - (k.popularity ?? 0)));
                return (
                  <button
                    key={k.id}
                    onClick={() => onSelect(k)}
                    title={`${k.term} · pop ${k.popularity?.toFixed(0)} · diff ${k.difficulty?.toFixed(0)} · opp ${opp?.toFixed(0)}`}
                    className={`absolute w-3 h-3 rounded-full ${dotColor(opp)} ring-2 ring-white dark:ring-[#1c2028] hover:scale-150 hover:z-10 transition-transform cursor-pointer`}
                    style={{ left: `calc(${x}% - 6px)`, top: `calc(${y}% - 6px)` }}
                  />
                );
              })
            )}
          </div>
          <div className="flex justify-between mt-2 text-[10px] uppercase tracking-wider font-medium text-gray-400 dark:text-[#5c6478]">
            <span>Low diff.</span>
            <span>Difficulty</span>
            <span>High diff.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
