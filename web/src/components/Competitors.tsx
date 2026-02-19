import { useApi } from "../hooks/useApi";
import OwnAppCard, { AppItem } from "./comps/competitors/OwnAppCard";
import CompetitorCard from "./comps/competitors/CompetitorCard";

export default function Competitors() {
  const { data, loading } = useApi<AppItem[]>("/apps");

  if (loading)
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
        <div className="spinner" /> Loading competitors…
      </div>
    );

  const apps = data || [];
  const ownApp = apps.find((a) => a.isOwnApp);
  const competitors = apps.filter((a) => !a.isOwnApp);

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-[#1a1a2e] mb-1">
        Competitors
      </h1>
      <p className="text-base text-gray-500 mb-7">
        {competitors.length} competitor{competitors.length !== 1 ? "s" : ""}{" "}
        discovered and tracked
      </p>

      {ownApp && <OwnAppCard app={ownApp} />}

      <div className="text-sm font-semibold text-[#1a1a2e] mb-3">
        Competitor Apps
      </div>
      {competitors.length === 0 ? (
        <div className="py-16 text-center">
          <div className="text-4xl mb-3 opacity-30">👥</div>
          <div className="text-sm font-medium text-gray-500 mb-1">
            No competitors discovered yet
          </div>
          <div className="text-xs text-gray-400">
            Run a scrape from the Actions page
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {competitors.map((c) => (
            <CompetitorCard key={c.id} competitor={c} />
          ))}
        </div>
      )}
    </div>
  );
}
