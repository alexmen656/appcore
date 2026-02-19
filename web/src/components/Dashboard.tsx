import { useApi } from "../hooks/useApi";
import StatsGrid, { Stats } from "./comps/dashboard/StatsGrid";
import AppInfoCard, { AppInfo } from "./comps/dashboard/AppInfoCard";
import ConfigurationTable, {
  Config,
} from "./comps/dashboard/ConfigurationTable";
import RecentSuggestionsTable, {
  RecentSuggestion,
} from "./comps/dashboard/RecentSuggestionsTable";
import LastJobStatus, { LastJob } from "./comps/dashboard/LastJobStatus";

interface DashboardData {
  app: AppInfo | null;
  stats: Stats;
  config: Config;
  lastJob: LastJob | null;
  recentSuggestions: RecentSuggestion[];
}

export default function Dashboard() {
  const { data, loading, error } = useApi<DashboardData>("/dashboard");

  if (loading)
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
        <div className="spinner" /> Loading dashboard…
      </div>
    );
  if (error)
    return <div className="py-20 text-center text-gray-400">{error}</div>;
  if (!data) return null;
  const { app, stats, config, lastJob, recentSuggestions } = data;

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-[#1a1a2e] mb-1">
        Dashboard
      </h1>
      <p className="text-base text-gray-500 mb-7">
        Overview of your ASO engine
      </p>

      <StatsGrid stats={stats} />

      {app && <AppInfoCard app={app} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <ConfigurationTable config={config} />
        <RecentSuggestionsTable suggestions={recentSuggestions} />
      </div>

      {lastJob && <LastJobStatus lastJob={lastJob} />}
    </div>
  );
}
