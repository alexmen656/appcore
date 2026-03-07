import { cardCls } from "../../../styles";
import type { AppInfo } from "../../../types";
export type { AppInfo };

interface Props {
  app: AppInfo;
}

export default function AppInfoCard({ app }: Props) {
  return (
    <div className={`${cardCls} mb-5`}>
      <div className="text-xs font-medium uppercase tracking-wide text-[#9ca3af] dark:text-[#5c6478] mb-4">Your App</div>
      <div className="flex gap-5 items-start">
        {app.iconUrl && (
          <img
            src={app.iconUrl}
            alt=""
            className="w-16 h-16 rounded-2xl shrink-0"
          />
        )}
        <div>
          <div className="font-semibold text-base text-[#111827] dark:text-[#e8eaf0] mb-1">
            {app.title || app.name}
          </div>
          {app.subtitle && (
            <div className="text-sm text-[#6b7280] dark:text-[#8b93a5] mb-1">{app.subtitle}</div>
          )}
          <div className="text-xs text-[#9ca3af] dark:text-[#5c6478] mb-2">{app.bundleId}</div>
          {app.rating != null && (
            <div className="text-sm text-[#111827] dark:text-[#e8eaf0] flex items-center gap-1">
              <span className="text-amber-400">&#9733;</span> {app.rating.toFixed(1)} ({app.ratingsCount?.toLocaleString()}{" "}
              ratings)
            </div>
          )}
          {app.keywords && (
            <div className="mt-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-[#9ca3af] dark:text-[#5c6478] mb-1">
                Keywords
              </div>
              <div className="text-xs text-[#6b7280] dark:text-[#8b93a5] leading-relaxed">
                {app.keywords}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
