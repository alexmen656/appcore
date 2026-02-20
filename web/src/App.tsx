import { useState, useEffect, useRef } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import {
  useApi,
  getToken,
  setToken,
  setActiveBundleId,
  getActiveBundleId,
} from "./hooks/useApi";
import { useToast, ToastContainer } from "./hooks/useToast";
import Dashboard from "./components/Dashboard";
import Suggestions from "./components/Suggestions";
import Keywords from "./components/Keywords";
import Competitors from "./components/Competitors";
import Actions from "./components/Actions";
import Settings from "./components/Settings";
import Analytics from "./components/Analytics";
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
const IconAnalytics = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
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

interface AppItem {
  id: string;
  name: string;
  bundleId: string;
  iconUrl: string | null;
  isOwnApp: boolean;
}

// ─── App icon helper ──────────────────────────────────────────────────────────
function AppAvatar({
  url,
  name,
  size = 9,
  accent,
}: {
  url?: string | null;
  name: string;
  size?: number;
  accent?: boolean;
}) {
  const cls = `shrink-0 rounded-lg object-cover flex items-center justify-center font-bold text-white`;
  const px = `w-${size} h-${size}`;
  return url ? (
    <img src={url} alt="" className={`${px} ${cls}`} />
  ) : (
    <div
      className={`${px} ${cls} ${accent ? "bg-[#ea0e2b]" : "bg-[#c8cdd3]"} text-sm`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── App Switcher dropdown ────────────────────────────────────────────────────
function AppSwitcher({ current }: { current: DashboardData["app"] }) {
  const { data: apps } = useApi<AppItem[]>("/apps");
  const [open, setOpen] = useState(false);
  const [activeBundleId, setLocalBundle] = useState(getActiveBundleId);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const ownApps = apps?.filter((a) => a.isOwnApp) ?? [];
  const activeBundleResolved = activeBundleId ?? current?.bundleId ?? null;
  const activeApp =
    ownApps.find((a) => a.bundleId === activeBundleResolved) ??
    (ownApps[0] || null);

  const handleSelect = (a: AppItem) => {
    setActiveBundleId(a.bundleId);
    setLocalBundle(a.bundleId);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative mx-3 mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2.5 bg-white border border-[#e5e7eb] rounded-lg flex items-center gap-2.5 hover:border-[#d1d5db] transition-colors group"
      >
        {activeApp ? (
          <AppAvatar
            url={activeApp.iconUrl}
            name={activeApp.name}
            size={9}
            accent
          />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-gray-200 shrink-0" />
        )}
        <div className="overflow-hidden flex-1 text-left">
          <div className="text-[15px] font-semibold text-[#1a1a2e] truncate leading-tight">
            {activeApp?.name ?? current?.name ?? "No app"}
          </div>
          <div className="text-[11px] text-[#9ca3af] truncate font-mono">
            {activeApp?.bundleId ?? current?.bundleId ?? "—"}
          </div>
        </div>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] bg-white border border-[#e5e7eb] rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            Your Apps
          </div>
          {ownApps.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400">No apps found</div>
          )}
          {ownApps.map((a) => (
            <button
              key={a.id}
              onClick={() => handleSelect(a)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#f7f8fa] transition-colors text-left ${a.bundleId === activeBundleResolved ? "bg-[#fef2f3]" : ""}`}
            >
              <AppAvatar url={a.iconUrl} name={a.name} size={8} accent />
              <div className="overflow-hidden">
                <div className="text-[13px] font-medium text-[#1a1a2e] truncate">
                  {a.name}
                </div>
                <div className="text-[10px] text-gray-400 font-mono truncate">
                  {a.bundleId}
                </div>
              </div>
              {a.bundleId === activeBundleResolved && (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-3.5 h-3.5 shrink-0 text-[#ea0e2b] ml-auto"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Profile dropdown ─────────────────────────────────────────────────────────
function ProfileMenu({
  user,
  onLogout,
}: {
  user: AuthUser;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const displayName = user.name || user.email || "User";
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div ref={ref} className="relative px-3 py-3 border-t border-[#e5e7eb]">
      {/* Dropdown — opens UPWARD */}
      {open && (
        <div className="absolute left-3 right-3 bottom-[calc(100%-8px)] bg-white border border-[#e5e7eb] rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            Account
          </div>
          <NavLink
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#f7f8fa] transition-colors text-[13px] text-[#1a1a2e] font-medium"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4 text-gray-400 shrink-0"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Profil
          </NavLink>
          <button
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-red-50 transition-colors text-[13px] text-red-500 font-medium"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4 shrink-0"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
          <div className="h-1" />
        </div>
      )}

      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-black/[0.04] transition-colors group"
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-[#ea0e2b] flex items-center justify-center text-white text-xs font-bold shrink-0">
          {initials}
        </div>
        <div className="flex-1 overflow-hidden text-left">
          <div className="text-[13px] font-semibold text-[#1a1a2e] truncate">
            {displayName}
          </div>
          {user.role === "ADMIN" && (
            <div className="text-[10px] text-[#ea0e2b] font-medium uppercase tracking-wide">
              Admin
            </div>
          )}
        </div>
        {/* chevron */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`w-3.5 h-3.5 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </div>
  );
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
        {/* Logo */}
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

        {/* App Switcher */}
        <AppSwitcher current={dash?.app ?? null} />

        {/* Nav */}
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
          <NavLink to="/analytics" className={navLinkClass}>
            <IconAnalytics /> Analytics
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

        {/* Profile */}
        <ProfileMenu user={user} onLogout={handleLogout} />
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
          <Route path="/analytics" element={<Analytics addToast={addToast} />} />
          <Route path="/actions" element={<Actions addToast={addToast} />} />
          <Route path="/settings" element={<Settings addToast={addToast} />} />
        </Routes>
      </main>
    </div>
  );
}
