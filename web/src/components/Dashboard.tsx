import { useApi } from "../hooks/useApi";
import StatsGrid from "./comps/dashboard/StatsGrid";
import AppInfoCard from "./comps/dashboard/AppInfoCard";
import ConfigurationTable from "./comps/dashboard/ConfigurationTable";
import RecentSuggestionsTable from "./comps/dashboard/RecentSuggestionsTable";
import LastJobStatus from "./comps/dashboard/LastJobStatus";
import DownloadsChart from "./comps/analytics/DownloadsChart";
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
    return <div className="py-20 text-center text-gray-400 dark:text-[#5c6478]">{error}</div>;
  if (!data) return null;
  const { app, stats, config, lastJob, recentSuggestions } = data;

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-[#111827] dark:text-[#e8eaf0] mb-1">
        Dashboard
      </h1>
      <p className="text-sm text-[#9ca3af] dark:text-[#5c6478] mb-8">
        Overview of your ASO engine
      </p>

      <StatsGrid stats={stats} />

      {app && <AppInfoCard app={app} />}

      {downloads && (
        <div className="mb-5">
          <DownloadsChart data={downloads.byDay} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <ConfigurationTable config={config} />
        <RecentSuggestionsTable suggestions={recentSuggestions} />
      </div>

      {lastJob && <LastJobStatus lastJob={lastJob} />}
    </div>
  );
}
