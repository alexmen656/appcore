import AppIcon from "./AppIcon";
import { AppItem } from "./OwnAppCard";

interface Props {
  competitor: AppItem;
  ownAppId?: string;
  onRemove?: (competitorId: string) => void;
  onClick?: () => void;
}

export default function CompetitorCard({ competitor: c, ownAppId, onRemove, onClick }: Props) {
  return (
    <div
      className="bg-white dark:bg-[#1c2028] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-2xl p-5 flex items-center gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)] cursor-pointer hover:border-[#ea0e2b]/40 transition-colors"
      onClick={onClick}
    >      <AppIcon url={c.iconUrl} name={c.name} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-[#111827] dark:text-[#e8eaf0] truncate">
          {c.name}
        </div>
        <div className="text-[11px] text-[#9ca3af] dark:text-[#5c6478] truncate">{c.bundleId}</div>
        {c.rating != null && (
          <div className="text-xs text-[#6b7280] dark:text-[#8b93a5] mt-0.5 flex items-center gap-1">
            <span className="text-amber-400">&#9733;</span> {c.rating.toFixed(1)}{" "}
            {c.ratingsCount != null && `(${c.ratingsCount.toLocaleString()})`}
          </div>
        )}
        {c.subtitle && (
          <div className="text-[11px] text-[#9ca3af] dark:text-[#5c6478] mt-0.5 truncate">
            {c.subtitle}
          </div>
        )}
      </div>
      {onRemove && ownAppId && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(c.id); }}
          title="Remove competitor"
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 dark:text-[#5c6478] hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
