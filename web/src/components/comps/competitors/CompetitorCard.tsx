import AppIcon from "./AppIcon";
import { AppItem } from "./OwnAppCard";

interface Props {
  competitor: AppItem;
}

export default function CompetitorCard({ competitor: c }: Props) {
  return (
    <div className="bg-white border border-[#e5e7eb] rounded-lg p-5 flex items-center gap-3">
      <AppIcon url={c.iconUrl} name={c.name} />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[#1a1a2e] truncate">
          {c.name}
        </div>
        <div className="text-[11px] text-gray-400 truncate">{c.bundleId}</div>
        {c.rating != null && (
          <div className="text-xs text-gray-500 mt-0.5">
            ⭐ {c.rating.toFixed(1)}{" "}
            {c.ratingsCount != null && `(${c.ratingsCount.toLocaleString()})`}
          </div>
        )}
        {c.subtitle && (
          <div className="text-[11px] text-gray-400 mt-0.5 truncate">
            {c.subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
