import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { useApi } from "./hooks/useApi";
import { useToast, ToastContainer } from "./hooks/useToast";
import Dashboard from "./components/Dashboard";
import Suggestions from "./components/Suggestions";
import Keywords from "./components/Keywords";
import Competitors from "./components/Competitors";
import Actions from "./components/Actions";

// ─── SVG Icons (inline, small) ──────────────────────────────────────────
const IconDashboard = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);
const IconSuggestions = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
  </svg>
);
const IconKeywords = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
);
const IconCompetitors = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconActions = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

interface DashboardData {
  app: {
    name: string;
    bundleId: string;
    iconUrl?: string;
  } | null;
  stats: Record<string, number>;
  config: Record<string, any>;
}

export default function App() {
  const { data: dash } = useApi<DashboardData>("/dashboard");
  const { toasts, addToast } = useToast();

  return (
    <div className="app-layout">
      <ToastContainer toasts={toasts} />

      {/* ─── Sidebar ──────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">F</div>
          <div>
            <div className="sidebar-logo-text">Fringelo AppCore</div>
            <div className="sidebar-logo-sub">ASO Engine</div>
          </div>
        </div>

        {/* App Selector */}
        {dash?.app && (
          <div className="sidebar-app-selector">
            {dash.app.iconUrl ? (
              <img
                src={dash.app.iconUrl}
                alt=""
                className="sidebar-app-icon"
              />
            ) : (
              <div
                className="sidebar-app-icon"
                style={{
                  background: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                {dash.app.name?.charAt(0) || "K"}
              </div>
            )}
            <div style={{ overflow: "hidden" }}>
              <div className="sidebar-app-name">{dash.app.name}</div>
              <div className="sidebar-app-bundle">{dash.app.bundleId}</div>
            </div>
          </div>
        )}

        <div className="sidebar-section">Navigation</div>
        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            <IconDashboard /> Dashboard
          </NavLink>
          <NavLink to="/suggestions" className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            <IconSuggestions /> Suggestions
          </NavLink>
          <NavLink to="/keywords" className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            <IconKeywords /> Keywords
          </NavLink>
          <NavLink to="/competitors" className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            <IconCompetitors /> Competitors
          </NavLink>

          <div className="sidebar-section" style={{ marginTop: 16 }}>Operations</div>
          <NavLink to="/actions" className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            <IconActions /> Actions
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          AppCore v1.0 &middot; {dash?.config?.aiProvider || "ai"}
        </div>
      </aside>

      {/* ─── Main Content ─────────────────────────── */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/suggestions" element={<Suggestions addToast={addToast} />} />
          <Route path="/keywords" element={<Keywords addToast={addToast} />} />
          <Route path="/competitors" element={<Competitors />} />
          <Route path="/actions" element={<Actions addToast={addToast} />} />
        </Routes>
      </main>
    </div>
  );
}
