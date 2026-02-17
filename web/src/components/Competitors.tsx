import { useApi } from "../hooks/useApi";

interface AppItem {
  id: string; bundleId: string; name: string; isOwnApp: boolean;
  rating: number | null; ratingsCount: number | null;
  iconUrl: string | null; subtitle: string | null;
  competitorCount: number; updatedAt: string;
}

function AppIcon({ url, name, own }: { url: string | null; name: string; own?: boolean }) {
  return url ? (
    <img src={url} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
  ) : (
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base shrink-0 ${own ? "bg-[#ea0e2b] text-white" : "bg-gray-200 text-gray-500"}`}>
      {name.charAt(0)}
    </div>
  );
}

export default function Competitors() {
  const { data, loading } = useApi<AppItem[]>("/apps");

  if (loading) return (
    <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
      <div className="spinner" /> Loading competitors…
    </div>
  );

  const apps = data || [];
  const ownApp = apps.find((a) => a.isOwnApp);
  const competitors = apps.filter((a) => !a.isOwnApp);

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-[#1a1a2e] mb-1">Competitors</h1>
      <p className="text-base text-gray-500 mb-7">
        {competitors.length} competitor{competitors.length !== 1 ? "s" : ""} discovered and tracked
      </p>

      {/* Own App */}
      {ownApp && (
        <div className="mb-6">
          <div className="text-sm font-semibold text-[#1a1a2e] mb-3">Your App</div>
          <div className="bg-white border-2 border-[#ea0e2b] rounded-lg p-5 inline-flex items-center gap-3">
            <AppIcon url={ownApp.iconUrl} name={ownApp.name} own />
            <div>
              <div className="text-sm font-semibold text-[#1a1a2e]">{ownApp.name}</div>
              <div className="text-xs text-gray-400">{ownApp.bundleId}</div>
              {ownApp.rating != null && (
                <div className="text-xs text-gray-500 mt-0.5">
                  ⭐ {ownApp.rating.toFixed(1)} ({ownApp.ratingsCount?.toLocaleString()})
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Competitor Grid */}
      <div className="text-sm font-semibold text-[#1a1a2e] mb-3">Competitor Apps</div>
      {competitors.length === 0 ? (
        <div className="py-16 text-center">
          <div className="text-4xl mb-3 opacity-30">👥</div>
          <div className="text-sm font-medium text-gray-500 mb-1">No competitors discovered yet</div>
          <div className="text-xs text-gray-400">Run a scrape from the Actions page</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {competitors.map((c) => (
            <div key={c.id} className="bg-white border border-[#e5e7eb] rounded-lg p-5 flex items-center gap-3">
              <AppIcon url={c.iconUrl} name={c.name} />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#1a1a2e] truncate">{c.name}</div>
                <div className="text-[11px] text-gray-400 truncate">{c.bundleId}</div>
                {c.rating != null && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    ⭐ {c.rating.toFixed(1)} {c.ratingsCount != null && `(${c.ratingsCount.toLocaleString()})`}
                  </div>
                )}
                {c.subtitle && (
                  <div className="text-[11px] text-gray-400 mt-0.5 truncate">{c.subtitle}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
