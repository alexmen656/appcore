const card = "bg-white border border-[#e5e7eb] rounded-lg p-5";

export interface AppInfo {
  name: string;
  bundleId: string;
  title: string;
  subtitle: string;
  keywords: string;
  rating: number;
  ratingsCount: number;
  iconUrl: string;
}

interface Props {
  app: AppInfo;
}

export default function AppInfoCard({ app }: Props) {
  return (
    <div className={`${card} mb-5`}>
      <div className="text-sm font-semibold text-[#1a1a2e] mb-4">Your App</div>
      <div className="flex gap-5 items-start">
        {app.iconUrl && (
          <img
            src={app.iconUrl}
            alt=""
            className="w-16 h-16 rounded-2xl shrink-0"
          />
        )}
        <div>
          <div className="font-semibold text-base text-[#1a1a2e] mb-1">
            {app.title || app.name}
          </div>
          {app.subtitle && (
            <div className="text-sm text-gray-500 mb-1">{app.subtitle}</div>
          )}
          <div className="text-xs text-gray-400 mb-2">{app.bundleId}</div>
          {app.rating != null && (
            <div className="text-sm text-[#1a1a2e]">
              ⭐ {app.rating.toFixed(1)} ({app.ratingsCount?.toLocaleString()}{" "}
              ratings)
            </div>
          )}
          {app.keywords && (
            <div className="mt-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                Keywords
              </div>
              <div className="text-xs text-gray-500 leading-relaxed">
                {app.keywords}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
