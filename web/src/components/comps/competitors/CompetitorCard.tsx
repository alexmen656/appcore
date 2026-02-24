import AppIcon from "./AppIcon";
import { AppItem } from "./OwnAppCard";

interface Props {
  competitor: AppItem;
}

export default function CompetitorCard({ competitor: c }: Props) {
  return (
    <div className="bg-white border border-[#eef0f3] rounded-2xl p-5 flex items-center gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <AppIcon url={c.iconUrl} name={c.name} />
      <div className="min-w-0">
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
    </div>
  );
}
