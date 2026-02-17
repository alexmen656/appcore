import { useApi } from "../hooks/useApi";

const TH =
  "text-left text-[11px] font-semibold uppercase tracking-[0.5px] text-gray-400 px-3.5 py-2.5 border-b border-[#e5e7eb] whitespace-nowrap";
const TD = "px-3.5 py-3 border-b border-[#f0f0f0] text-[13px] align-middle";
const card = "bg-white border border-[#e5e7eb] rounded-lg p-5";
const badgeVariants: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  applied: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-700",
  title: "bg-violet-100 text-violet-800",
  subtitle: "bg-sky-100 text-sky-800",
  keywords: "bg-pink-100 text-pink-800",
  description: "bg-emerald-50 text-emerald-700",
  running: "bg-blue-100 text-blue-700",
};
const badge = (v: string) =>
  `inline-block px-2 py-0.5 rounded text-[11px] font-semibold tracking-[0.3px] ${badgeVariants[v.toLowerCase()] ?? "bg-gray-100 text-gray-700"}`;

interface DashboardData {
  app: {
    name: string;
    bundleId: string;
    title: string;
    subtitle: string;
    keywords: string;
    rating: number;
    ratingsCount: number;
    iconUrl: string;
  } | null;
  stats: {
    apps: number;
    snapshots: number;
    keywords: number;
    rankings: number;
    pendingSuggestions: number;
    appliedSuggestions: number;
    jobs: number;
  };
  config: {
    bundleId: string;
    country: string;
    locales: string;
    aiProvider: string;
    hasOpenAI: boolean;
    hasAnthropic: boolean;
    hasASC: boolean;
    hasSearchAds: boolean;
    scrapeInterval: number;
  };
  lastJob: {
    type: string;
    status: string;
    createdAt: string;
    itemsCount: number;
  } | null;
  recentSuggestions: {
    id: string;
    type: string;
    locale: string;
    value: string;
    confidence: number;
    status: string;
    createdAt: string;
  }[];
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

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {[
          { label: "Tracked Apps", value: stats.apps, color: "" },
          { label: "Snapshots", value: stats.snapshots, color: "" },
          { label: "Keywords", value: stats.keywords, color: "" },
          {
            label: "Pending Suggestions",
            value: stats.pendingSuggestions,
            color: stats.pendingSuggestions > 0 ? "text-amber-500" : "",
          },
          {
            label: "Applied Suggestions",
            value: stats.appliedSuggestions,
            color: "text-emerald-500",
          },
          { label: "Rankings", value: stats.rankings, color: "" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-white border border-[#e5e7eb] rounded-lg px-5 py-[18px]"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
              {label}
            </div>
            <div
              className={`text-[28px] font-bold tracking-tight ${color || "text-[#1a1a2e]"}`}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* App Info */}
      {app && (
        <div className={`${card} mb-5`}>
          <div className="text-sm font-semibold text-[#1a1a2e] mb-4">
            Your App
          </div>
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
                  ⭐ {app.rating.toFixed(1)} (
                  {app.ratingsCount?.toLocaleString()} ratings)
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
      )}

      {/* Config + Recent Suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className={card}>
          <div className="text-sm font-semibold text-[#1a1a2e] mb-4">
            Configuration
          </div>
          <table className="w-full border-collapse">
            <tbody>
              {(
                [
                  "AI Provider",
                  "Country",
                  "Locales",
                  "Scrape Interval",
                ] as const
              ).map((label, i) => {
                const val = [
                  config.aiProvider,
                  config.country,
                  config.locales,
                  `${config.scrapeInterval}h`,
                ][i];
                return (
                  <tr
                    key={label}
                    className="border-b border-[#f0f0f0] last:border-0"
                  >
                    <td className="w-40 py-3 pr-4 text-[13px] font-medium text-[#1a1a2e]">
                      {label}
                    </td>
                    <td className="py-3 text-[13px] text-gray-600">{val}</td>
                  </tr>
                );
              })}
              <tr>
                <td className="py-3 pr-4 text-[13px] font-medium text-[#1a1a2e]">
                  Integrations
                </td>
                <td className="py-3 flex gap-1.5 flex-wrap">
                  {config.hasOpenAI && (
                    <span className={badge("applied")}>OpenAI</span>
                  )}
                  {config.hasAnthropic && (
                    <span className={badge("approved")}>Anthropic</span>
                  )}
                  {config.hasASC && <span className={badge("title")}>ASC</span>}
                  {config.hasSearchAds && (
                    <span className={badge("keywords")}>Search Ads</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={card}>
          <div className="text-sm font-semibold text-[#1a1a2e] mb-4">
            Recent Suggestions
          </div>
          {recentSuggestions.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">
              No suggestions yet — run an AI analysis first
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={TH}>Type</th>
                  <th className={TH}>Locale</th>
                  <th className={TH}>Confidence</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentSuggestions.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/60">
                    <td className={TD}>
                      <span className={badge(s.type.toLowerCase())}>
                        {s.type}
                      </span>
                    </td>
                    <td className={`${TD} text-gray-500`}>{s.locale}</td>
                    <td className={TD}>
                      {s.confidence != null ? (
                        <span className="flex items-center gap-1.5">
                          {Math.round(s.confidence * 100)}%
                          <span className="inline-block h-1 w-[60px] bg-[#e5e7eb] rounded-sm overflow-hidden align-middle ml-1.5">
                            <span
                              className="block h-full bg-emerald-500 rounded-sm"
                              style={{ width: `${s.confidence * 100}%` }}
                            />
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={TD}>
                      <span className={badge(s.status.toLowerCase())}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Last Job */}
      {lastJob && (
        <div className={card}>
          <div className="text-sm font-semibold text-[#1a1a2e] mb-2">
            Last Job
          </div>
          <div className="text-sm text-gray-500 flex items-center gap-2">
            <span
              className={badge(
                lastJob.status === "COMPLETED"
                  ? "approved"
                  : lastJob.status === "FAILED"
                    ? "rejected"
                    : "pending",
              )}
            >
              {lastJob.status}
            </span>
            {lastJob.type} &middot; {lastJob.itemsCount} items &middot;{" "}
            {new Date(lastJob.createdAt).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
