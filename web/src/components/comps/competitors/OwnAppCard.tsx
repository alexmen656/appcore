import AppIcon from "./AppIcon";

export interface AppItem {
  id: string;
  bundleId: string;
  name: string;
  isOwnApp: boolean;
  rating: number | null;
  ratingsCount: number | null;
  iconUrl: string | null;
  subtitle: string | null;
  competitorCount: number;
  updatedAt: string;
}

interface Props {
  app: AppItem;
}

export default function OwnAppCard({ app }: Props) {
  return (
    <div className="mb-6">
      <div className="text-xs font-medium uppercase tracking-wide text-[#9ca3af] dark:text-[#5c6478] mb-3">Your App</div>
      <div className="bg-white dark:bg-[#1c2028] border-2 border-[#ea0e2b] rounded-2xl p-5 inline-flex items-center gap-3">
        <AppIcon url={app.iconUrl} name={app.name} own />
        <div>
          <div className="text-sm font-semibold text-[#111827] dark:text-[#e8eaf0]">{app.name}</div>
          <div className="text-xs text-[#9ca3af] dark:text-[#5c6478]">{app.bundleId}</div>
          {app.rating != null && (
            <div className="text-xs text-[#6b7280] dark:text-[#8b93a5] mt-0.5 flex items-center gap-1">
              <span className="text-amber-400">&#9733;</span> {app.rating.toFixed(1)} ({app.ratingsCount?.toLocaleString()})
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
