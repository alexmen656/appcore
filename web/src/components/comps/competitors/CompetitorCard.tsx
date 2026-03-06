import AppIcon from "./AppIcon";
import { AppItem } from "./OwnAppCard";

interface Props {
  competitor: AppItem;
  ownAppId?: string;
  onRemove?: (competitorId: string) => void;
}

export default function CompetitorCard({ competitor: c, ownAppId, onRemove }: Props) {
  return (
    <div className="bg-white border border-[#eef0f3] rounded-2xl p-5 flex items-center gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <AppIcon url={c.iconUrl} name={c.name} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-[#111827] truncate">
          {c.name}
        </div>
        <div className="text-[11px] text-[#9ca3af] truncate">{c.bundleId}</div>
        {c.rating != null && (
          <div className="text-xs text-[#6b7280] mt-0.5 flex items-center gap-1">
            <span className="text-amber-400">&#9733;</span> {c.rating.toFixed(1)}{" "}
            {c.ratingsCount != null && `(${c.ratingsCount.toLocaleString()})`}
          </div>
        )}
        {c.subtitle && (
          <div className="text-[11px] text-[#9ca3af] mt-0.5 truncate">
            {c.subtitle}
          </div>
        )}
      </div>
      {onRemove && ownAppId && (
        <button
          onClick={() => onRemove(c.id)}
          title="Remove competitor"
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
