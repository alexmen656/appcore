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
      <div className="text-sm font-semibold text-[#1a1a2e] mb-3">Your App</div>
      <div className="bg-white border-2 border-[#ea0e2b] rounded-lg p-5 inline-flex items-center gap-3">
        <AppIcon url={app.iconUrl} name={app.name} own />
        <div>
          <div className="text-sm font-semibold text-[#1a1a2e]">{app.name}</div>
          <div className="text-xs text-gray-400">{app.bundleId}</div>
          {app.rating != null && (
            <div className="text-xs text-gray-500 mt-0.5">
              ⭐ {app.rating.toFixed(1)} ({app.ratingsCount?.toLocaleString()})
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
