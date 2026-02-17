import { useApi } from "../hooks/useApi";

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
      <div className="loading">
        <div className="spinner" /> Loading dashboard…
      </div>
    );
  if (error)
    return (
      <div className="empty-state">
        <div className="empty-state-text">Error: {error}</div>
      </div>
    );
  if (!data) return null;

  const { app, stats, config, lastJob, recentSuggestions } = data;

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">Overview of your ASO engine</p>

      {/* Stats Grid */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-label">Tracked Apps</div>
          <div className="stat-card-value">{stats.apps}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Snapshots</div>
          <div className="stat-card-value">{stats.snapshots}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Keywords</div>
          <div className="stat-card-value">{stats.keywords}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Pending Suggestions</div>
          <div
            className="stat-card-value"
            style={{
              color:
                stats.pendingSuggestions > 0 ? "var(--warning)" : undefined,
            }}
          >
            {stats.pendingSuggestions}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Applied Suggestions</div>
          <div className="stat-card-value" style={{ color: "var(--success)" }}>
            {stats.appliedSuggestions}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Rankings</div>
          <div className="stat-card-value">{stats.rankings}</div>
        </div>
      </div>

      {/* App Info */}
      {app && (
        <div className="section">
          <div className="section-header">
            <div className="section-title">Your App</div>
          </div>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            {app.iconUrl && (
              <img
                src={app.iconUrl}
                alt=""
                style={{ width: 64, height: 64, borderRadius: 14 }}
              />
            )}
            <div>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
                {app.title || app.name}
              </div>
              {app.subtitle && (
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    marginBottom: 4,
                  }}
                >
                  {app.subtitle}
                </div>
              )}
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginBottom: 8,
                }}
              >
                {app.bundleId}
              </div>
              {app.rating != null && (
                <div style={{ fontSize: 13 }}>
                  ⭐ {app.rating.toFixed(1)} (
                  {app.ratingsCount?.toLocaleString()} ratings)
                </div>
              )}
              {app.keywords && (
                <div style={{ marginTop: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Keywords
                  </span>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      marginTop: 4,
                      lineHeight: 1.6,
                    }}
                  >
                    {app.keywords}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Config & Status */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="section">
          <div className="section-title" style={{ marginBottom: 12 }}>
            Configuration
          </div>
          <table className="data-table">
            <tbody>
              <tr>
                <td style={{ fontWeight: 500 }}>AI Provider</td>
                <td>{config.aiProvider}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 500 }}>Country</td>
                <td>{config.country}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 500 }}>Locales</td>
                <td>{config.locales}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 500 }}>Scrape Interval</td>
                <td>{config.scrapeInterval}h</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 500 }}>Integrations</td>
                <td>
                  {config.hasOpenAI && (
                    <span
                      className="badge badge-applied"
                      style={{ marginRight: 4 }}
                    >
                      OpenAI
                    </span>
                  )}
                  {config.hasAnthropic && (
                    <span
                      className="badge badge-approved"
                      style={{ marginRight: 4 }}
                    >
                      Anthropic
                    </span>
                  )}
                  {config.hasASC && (
                    <span
                      className="badge badge-title"
                      style={{ marginRight: 4 }}
                    >
                      ASC
                    </span>
                  )}
                  {config.hasSearchAds && (
                    <span className="badge badge-keywords">Search Ads</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="section">
          <div className="section-title" style={{ marginBottom: 12 }}>
            Recent Suggestions
          </div>
          {recentSuggestions.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-state-text">No suggestions yet</div>
              <div className="empty-state-sub">
                Run an analysis to generate ASO suggestions
              </div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Locale</th>
                  <th>Confidence</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentSuggestions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className={`badge badge-${s.type.toLowerCase()}`}>
                        {s.type}
                      </span>
                    </td>
                    <td>{s.locale}</td>
                    <td>
                      {s.confidence != null ? (
                        <>
                          {Math.round(s.confidence * 100)}%
                          <div className="confidence-bar">
                            <div
                              className="confidence-fill"
                              style={{ width: `${s.confidence * 100}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span className={`badge badge-${s.status.toLowerCase()}`}>
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
        <div className="section">
          <div className="section-title" style={{ marginBottom: 8 }}>
            Last Job
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            <span
              className={`badge badge-${lastJob.status === "COMPLETED" ? "approved" : lastJob.status === "FAILED" ? "rejected" : "pending"}`}
            >
              {lastJob.status}
            </span>{" "}
            {lastJob.type} &middot; {lastJob.itemsCount} items &middot;{" "}
            {new Date(lastJob.createdAt).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
