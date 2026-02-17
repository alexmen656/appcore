import { useState } from "react";
import { apiPost, useApi } from "../hooks/useApi";

interface Job {
  id: string;
  type: string;
  status: string;
  result: string | null;
  error: string | null;
  itemsCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function Actions({ addToast }: Props) {
  const { data: jobs, refetch } = useApi<Job[]>("/actions/jobs");
  const [running, setRunning] = useState<string | null>(null);

  const triggerAction = async (
    endpoint: string,
    label: string,
    body?: any
  ) => {
    setRunning(endpoint);
    try {
      const res = await apiPost(`/actions/${endpoint}`, body);
      addToast(res.message || `${label} started`, "success");
      setTimeout(refetch, 2000); // Refresh jobs after delay
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setRunning(null);
    }
  };

  return (
    <div>
      <h1 className="page-title">Actions</h1>
      <p className="page-subtitle">Manually trigger scraping, analysis, and sync operations</p>

      {/* Action Buttons */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => !running && triggerAction("scrape", "Competitor Scrape")}>
          <div className="stat-card-label">Scrape</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
            {running === "scrape" ? "Running…" : "Discover Competitors"}
          </div>
          <div className="stat-card-sub">
            Scrape iTunes API for competitor apps and save snapshots
          </div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginTop: 12 }}
            disabled={running === "scrape"}
          >
            {running === "scrape" ? "⏳ Running…" : "▶ Run Scrape"}
          </button>
        </div>

        <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => !running && triggerAction("analyze", "AI Analysis")}>
          <div className="stat-card-label">Analyze</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
            {running === "analyze" ? "Running…" : "AI ASO Analysis"}
          </div>
          <div className="stat-card-sub">
            Generate multi-locale ASO suggestions using AI
          </div>
          <button
            className="btn btn-primary btn-sm"
            style={{ marginTop: 12 }}
            disabled={running === "analyze"}
          >
            {running === "analyze" ? "⏳ Running…" : "▶ Run Analysis"}
          </button>
        </div>

        <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => !running && triggerAction("sync", "ASC Sync")}>
          <div className="stat-card-label">Sync</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
            {running === "sync" ? "Running…" : "Sync with App Store Connect"}
          </div>
          <div className="stat-card-sub">
            Pull current ASO state (title, subtitle, keywords) from ASC
          </div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginTop: 12 }}
            disabled={running === "sync"}
          >
            {running === "sync" ? "⏳ Running…" : "▶ Sync Now"}
          </button>
        </div>

        <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => !running && triggerAction("track-keywords", "Keyword Tracking")}>
          <div className="stat-card-label">Track</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
            {running === "track-keywords" ? "Running…" : "Track Keywords"}
          </div>
          <div className="stat-card-sub">
            Check current rankings for all tracked keywords
          </div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginTop: 12 }}
            disabled={running === "track-keywords"}
          >
            {running === "track-keywords" ? "⏳ Running…" : "▶ Track Now"}
          </button>
        </div>
      </div>

      {/* Job History */}
      <div className="section" style={{ marginTop: 32 }}>
        <div className="section-header">
          <div className="section-title">Job History</div>
          <button className="btn btn-secondary btn-sm" onClick={refetch}>
            Refresh
          </button>
        </div>

        {!jobs || jobs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-text">No jobs recorded yet</div>
            <div className="empty-state-sub">Trigger an action above to create a job</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Items</th>
                <th>Started</th>
                <th>Completed</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td style={{ fontWeight: 500 }}>{j.type}</td>
                  <td>
                    <span
                      className={`badge badge-${
                        j.status === "COMPLETED"
                          ? "approved"
                          : j.status === "FAILED"
                          ? "rejected"
                          : j.status === "RUNNING"
                          ? "applied"
                          : "pending"
                      }`}
                    >
                      {j.status}
                    </span>
                  </td>
                  <td>{j.itemsCount}</td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {j.startedAt ? new Date(j.startedAt).toLocaleString() : "—"}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {j.completedAt
                      ? new Date(j.completedAt).toLocaleString()
                      : "—"}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--danger)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {j.error || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
