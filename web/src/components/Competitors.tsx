import { useApi } from "../hooks/useApi";

interface AppItem {
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

export default function Competitors() {
  const { data, loading } = useApi<AppItem[]>("/apps");

  if (loading)
    return (
      <div className="loading">
        <div className="spinner" /> Loading competitors…
      </div>
    );

  const apps = data || [];
  const ownApp = apps.find((a) => a.isOwnApp);
  const competitors = apps.filter((a) => !a.isOwnApp);

  return (
    <div>
      <h1 className="page-title">Competitors</h1>
      <p className="page-subtitle">
        {competitors.length} competitor{competitors.length !== 1 ? "s" : ""}{" "}
        discovered and tracked
      </p>

      {/* Own App */}
      {ownApp && (
        <div className="section">
          <div className="section-title" style={{ marginBottom: 12 }}>
            Your App
          </div>
          <div
            className="competitor-card"
            style={{ borderColor: "var(--accent)", borderWidth: 2 }}
          >
            {ownApp.iconUrl ? (
              <img
                src={ownApp.iconUrl}
                alt=""
                className="competitor-card-icon"
              />
            ) : (
              <div
                className="competitor-card-icon"
                style={{
                  background: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 700,
                }}
              >
                {ownApp.name.charAt(0)}
              </div>
            )}
            <div>
              <div className="competitor-card-name">{ownApp.name}</div>
              <div className="competitor-card-bundle">{ownApp.bundleId}</div>
              {ownApp.rating != null && (
                <div className="competitor-card-rating">
                  ⭐ {ownApp.rating.toFixed(1)} (
                  {ownApp.ratingsCount?.toLocaleString()})
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Competitor Grid */}
      <div className="section">
        <div className="section-title" style={{ marginBottom: 12 }}>
          Competitor Apps
        </div>
        {competitors.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-text">
              No competitors discovered yet
            </div>
            <div className="empty-state-sub">
              Run a scrape from the Actions page to discover competitors
            </div>
          </div>
        ) : (
          <div className="competitor-grid">
            {competitors.map((c) => (
              <div key={c.id} className="competitor-card">
                {c.iconUrl ? (
                  <img
                    src={c.iconUrl}
                    alt=""
                    className="competitor-card-icon"
                  />
                ) : (
                  <div
                    className="competitor-card-icon"
                    style={{
                      background: "#e5e7eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-muted)",
                      fontWeight: 700,
                      fontSize: 16,
                    }}
                  >
                    {c.name.charAt(0)}
                  </div>
                )}
                <div style={{ overflow: "hidden" }}>
                  <div
                    className="competitor-card-name"
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {c.name}
                  </div>
                  <div
                    className="competitor-card-bundle"
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {c.bundleId}
                  </div>
                  {c.rating != null && (
                    <div className="competitor-card-rating">
                      ⭐ {c.rating.toFixed(1)}{" "}
                      {c.ratingsCount != null &&
                        `(${c.ratingsCount.toLocaleString()})`}
                    </div>
                  )}
                  {c.subtitle && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginTop: 2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.subtitle}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
