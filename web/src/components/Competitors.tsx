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
          <div className="text-4xl flex justify-center mb-3 opacity-30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-12"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
              />
            </svg>
          </div>
          <div className="text-md font-medium text-gray-500 mb-1">
            No competitors discovered yet
          </div>
          <div className="text-sm text-gray-400">
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
