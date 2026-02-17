import { useState, useEffect } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { useApi, getToken, setToken } from "./hooks/useApi";
import { useToast, ToastContainer } from "./hooks/useToast";
import Dashboard from "./components/Dashboard";
import Suggestions from "./components/Suggestions";
import Keywords from "./components/Keywords";
import Competitors from "./components/Competitors";
import Actions from "./components/Actions";
import Settings from "./components/Settings";
import Login, { AuthUser } from "./components/Login";

const IconDashboard = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);
const IconSuggestions = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5" />
    <path d="M2 12l10 5 10-5" />
  </svg>
);
const IconKeywords = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);
const IconCompetitors = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconActions = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);
const IconSettings = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        setUser(u);
        setAuthLoading(false);
      })
      .catch(() => setAuthLoading(false));
  }, []);

  const handleLogout = () => {
    setToken(null);
    setUser(null);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <Login onAuth={(u) => setUser(u)} />;
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-[9px] rounded-[6px] text-sm font-medium mb-0.5 transition-all [&_svg]:w-[18px] [&_svg]:h-[18px] ${
      isActive
        ? "bg-white text-[#1a1a2e] shadow-sm [&_svg]:opacity-100 [&_svg]:text-[#ea0e2b]"
        : "text-[#6b7280] hover:bg-black/[0.04] hover:text-[#1a1a2e] [&_svg]:opacity-60"
    }`;

  return (
    <div className="flex h-screen overflow-hidden">
      <ToastContainer toasts={toasts} />
      <aside className="w-[260px] min-w-[260px] bg-[#eff3f6] border-r border-[#e5e7eb] flex flex-col overflow-y-auto">
        <div className="px-5 pt-6 pb-5 flex items-center gap-2.5">
          <img
            className="w-[42px] h-[42px] rounded-[6px]"
            src="/logo.png"
            alt="Fringelo Logo"
          />
          <div>
            <div className="text-2xl font-bold text-[#ea0e2b] tracking-[-0.3px]">
              AppCore
            </div>
            <div className="text-sm text-[#9ca3af] font-medium">
              ASO Engine by Fringelo
            </div>
          </div>
        </div>
        {dash?.app && (
          <div className="mx-3 mb-4 px-3 py-2.5 bg-white border border-[#e5e7eb] rounded-lg flex items-center gap-2.5">
            {dash.app.iconUrl ? (
              <img
                src={dash.app.iconUrl}
                alt=""
                className="w-9 h-9 rounded-lg object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-[#ea0e2b] flex items-center justify-center text-white font-bold text-base shrink-0">
                {dash.app.name?.charAt(0) || "K"}
              </div>
            )}
            <div className="overflow-hidden">
              <div className="text-[15px] font-semibold text-[#1a1a2e] truncate">
                {dash.app.name}
              </div>
              <div className="text-xs text-[#9ca3af] truncate">
                {dash.app.bundleId}
              </div>
            </div>
          </div>
        )}
        <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.8px] text-[#9ca3af]">
          Navigation
        </div>
        <nav className="px-2 flex-1">
          <NavLink to="/dashboard" className={navLinkClass}>
            <IconDashboard /> Dashboard
          </NavLink>
          <NavLink to="/suggestions" className={navLinkClass}>
            <IconSuggestions /> Suggestions
          </NavLink>
          <NavLink to="/keywords" className={navLinkClass}>
            <IconKeywords /> Keywords
          </NavLink>
          <NavLink to="/competitors" className={navLinkClass}>
            <IconCompetitors /> Competitors
          </NavLink>
          <div className="px-3 pb-1 pt-2 mt-4 text-xs font-semibold uppercase tracking-[0.8px] text-[#9ca3af]">
            Operations
          </div>
          <NavLink to="/actions" className={navLinkClass}>
            <IconActions /> Actions
          </NavLink>
          <NavLink to="/settings" className={navLinkClass}>
            <IconSettings /> Settings
          </NavLink>
        </nav>
        <div className="px-4 py-4 border-t border-[#e5e7eb] text-xs text-[#9ca3af] text-center">
          <div className="mb-1.5">
            {user.name || user.email}
            {user.role === "ADMIN" && (
              <span className="ml-1.5 text-[10px] bg-[#ea0e2b] text-white rounded px-[5px] py-px">
                admin
              </span>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="border border-[#e5e7eb] text-[#9ca3af] rounded-[6px] px-2.5 py-1 text-xs hover:border-gray-300 hover:text-[#6b7280] transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto px-8 py-6 bg-white">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route
            path="/suggestions"
            element={<Suggestions addToast={addToast} />}
          />
          <Route path="/keywords" element={<Keywords addToast={addToast} />} />
          <Route path="/competitors" element={<Competitors />} />
          <Route path="/actions" element={<Actions addToast={addToast} />} />
          <Route path="/settings" element={<Settings addToast={addToast} />} />
        </Routes>
      </main>
    </div>
  );
}
