import type { AppInfo } from "../../types";
import { textMuted, textPrimary, textSecondary } from "../../styles";
export type { AppInfo };

interface Props {
  app: AppInfo;
}

export default function AppInfoCard({ app }: Props) {
  return (
    <div className="flex items-center gap-4 mb-6 pb-5 border-b border-[#f3f4f6] dark:border-[#2a2f3d]">
      {app.iconUrl && <img src={app.iconUrl} alt="" className="w-11 h-11 rounded-xl shrink-0" />}
      <div className="min-w-0">
        <div className={`text-[17px] font-semibold ${textPrimary} leading-snug truncate`}>{app.title || app.name}</div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {app.subtitle && <span className={`text-[13px] ${textSecondary}`}>{app.subtitle}</span>}
          <span className={`text-[12px] ${textMuted} font-mono`}>{app.bundleId}</span>
          {app.rating != null && (
            <span className={`text-[12px] ${textSecondary} flex items-center gap-1`}>
              <span className="text-amber-400">★</span>
              {app.rating.toFixed(1)}
              <span className={`${textMuted}`}>· {app.ratingsCount?.toLocaleString()} ratings</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
