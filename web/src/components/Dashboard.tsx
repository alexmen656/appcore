import { useApi } from "../hooks/useApi";
import StatsGrid from "./comps/dashboard/StatsGrid";
import AppInfoCard from "./comps/dashboard/AppInfoCard";
import RecentSuggestionsTable from "./comps/dashboard/RecentSuggestionsTable";
import DownloadsChart from "./analytics/DownloadsChart";
import type { DashboardData, DownloadsData } from "../types";

export default function Dashboard() {
  const { data, loading, error } = useApi<DashboardData>("/dashboard");
  const { data: downloads } = useApi<DownloadsData>(
    "/analytics/downloads?days=90",
  );

  if (loading)
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-gray-400 dark:text-[#5c6478]">
        <div className="spinner" /> Loading dashboard…
      </div>
    );
  if (error)
    return (
      <div className="py-20 text-center text-gray-400 dark:text-[#5c6478]">
        {error}
      </div>
    );
  if (!data) return null;
  const { app, stats, lastJob, recentSuggestions } = data;

  return (
    <div>
      {app && <AppInfoCard app={app} />}

      <StatsGrid stats={stats} />

      {downloads && (
        <div className="mb-5">
          <DownloadsChart data={downloads.byDay} />
        </div>
      )}

      <div className="mb-5">
        <RecentSuggestionsTable suggestions={recentSuggestions} lastJob={lastJob ?? undefined} />
      </div>
    </div>
  );
}
