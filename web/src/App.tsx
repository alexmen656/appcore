import { useState, useEffect, useRef, useCallback } from "react";
import {
  Routes,
  Route,
  NavLink,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  useApi,
  apiPost,
  getToken,
  setToken,
  setActiveBundleId,
  getActiveBundleId,
  authHeaders,
} from "./hooks/useApi";
import { useClickOutside } from "./hooks/useClickOutside";
import { useToast, ToastContainer } from "./hooks/useToast";
import Dashboard from "./components/Dashboard";
import Suggestions from "./components/Suggestions";
import Keywords from "./components/Keywords";
import Competitors from "./components/Competitors";
import CompetitorDetailPage from "./components/CompetitorDetailPage";
import Actions from "./components/Actions";
import Agents from "./components/Agents";
import Settings from "./components/Settings";
import Analytics from "./components/Analytics";
import Versions from "./components/Versions";
import Screenshots from "./components/Screenshots";
import Login from "./components/Login";
import type {
  AuthUser,
  DashboardData,
  AppItem,
  AscApp,
  VersionSummary,
} from "./types";

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
const IconVersions = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);
const IconAgents = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
    <circle cx="12" cy="10" r="3" />
    <path d="M7 10h2M15 10h2" />
  </svg>
);
const IconScreenshots = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="m21 15-5-5L5 21" />
  </svg>
);
const IconMoon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);
const IconSun = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const sidebarLinks = [
  { to: "/dashboard", label: "Dashboard", icon: IconDashboard },
  { to: "/analytics", label: "Analytics", icon: IconAnalytics },
  { to: "/keywords", label: "Keywords", icon: IconKeywords },
  { to: "/competitors", label: "Competitors", icon: IconCompetitors },
  { to: "/suggestions", label: "Suggestions", icon: IconSuggestions },
];

const sidebarOperations = [
  { to: "/agents", label: "Agents", icon: IconAgents },
  { to: "/actions", label: "Actions", icon: IconActions },
  { to: "/screenshots", label: "Screenshots", icon: IconScreenshots },
  { to: "/settings", label: "Settings", icon: IconSettings },
];

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

function AppSwitcher({
  current,
  addToast,
}: {
  current: DashboardData["app"];
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}) {
  const { data: apps, refetch: refetchApps } = useApi<AppItem[]>(
    "/apps",
    [],
    true,
  );
  const [open, setOpen] = useState(false);
  const [activeBundleId, setLocalBundle] = useState(getActiveBundleId);
  const [importOpen, setImportOpen] = useState(false);
  const [ascApps, setAscApps] = useState<AscApp[] | null>(null);
  const [ascLoading, setAscLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const closeDropdown = useCallback(() => setOpen(false), []);
  useClickOutside(ref, closeDropdown);

  const ownApps = apps?.filter((a) => a.isOwnApp) ?? [];
  const activeBundleResolved = activeBundleId ?? current?.bundleId ?? null;
  const activeApp =
    ownApps.find((a) => a.bundleId === activeBundleResolved) ??
    (ownApps[0] || null);
  const importedBundleIds = new Set(ownApps.map((a) => a.bundleId));
  const unimportedAscApps =
    ascApps?.filter((a) => !importedBundleIds.has(a.bundleId)) ?? null;

  const handleSelect = (a: AppItem) => {
    setActiveBundleId(a.bundleId);
    setLocalBundle(a.bundleId);
    setOpen(false);
  };

  const openImport = () => {
    setOpen(false);
    setAscApps(null);
    setImportOpen(true);
    loadAscApps();
  };

  const closeImport = () => {
    setImportOpen(false);
    setAscApps(null);
  };

  const loadAscApps = async () => {
    setAscLoading(true);
    setAscApps(null);
    try {
      const token = getToken();
      const res = await fetch("/api/asc/apps", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? `HTTP ${res.status}`);
      }
      setAscApps(await res.json());
    } catch (err: any) {
      addToast(`Failed to load apps: ${err.message}`, "error");
    } finally {
      setAscLoading(false);
    }
  };

  const importApp = async (app: AscApp) => {
    setImporting(app.ascId);
    try {
      const result = await apiPost<{
        ok: boolean;
        app: { name: string; bundleId: string };
      }>("/asc/import", {
        ascId: app.ascId,
        bundleId: app.bundleId,
        name: app.name,
      });
      addToast(`"${result.app.name}" imported`, "success");
      setActiveBundleId(result.app.bundleId);
      setLocalBundle(result.app.bundleId);
      refetchApps();
      closeImport();
    } catch (err: any) {
      addToast(`Import failed: ${err.message}`, "error");
    } finally {
      setImporting(null);
    }
  };

  return (
    <>
      <div ref={ref} className="relative mx-3 mb-4">
        <button
          onClick={() => setOpen(!open)}
          className="w-full px-3 py-2.5 bg-white dark:bg-[#1c2028] border border-[#e5e7eb] dark:border-[#2a2f3d] rounded-xl flex items-center gap-2.5 hover:border-[#d1d5db] dark:hover:border-[#3a4050] transition-colors group"
        >
          {activeApp ? (
            <AppAvatar
              url={activeApp.iconUrl}
              name={activeApp.name}
              size={9}
              accent
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-[#2a2f3d] shrink-0" />
          )}
          <div className="overflow-hidden flex-1 text-left">
            <div className="text-[15px] font-semibold text-[#1a1a2e] dark:text-[#e8eaf0] truncate leading-tight">
              {activeApp?.name ?? current?.name ?? "No app"}
            </div>
            <div className="text-[11px] text-[#9ca3af] dark:text-[#5c6478] truncate font-mono">
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
            className={`w-4 h-4 shrink-0 text-gray-400 dark:text-[#5c6478] transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] bg-white dark:bg-[#1c2028] border border-[#e5e7eb] dark:border-[#2a2f3d] rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#5c6478]">
              Your Apps
            </div>
            {ownApps.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-400 dark:text-[#5c6478]">
                No apps found
              </div>
            )}
            {ownApps.map((a) => (
              <button
                key={a.id}
                onClick={() => handleSelect(a)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#f7f8fa] dark:hover:bg-[#252b38] transition-colors text-left ${a.bundleId === activeBundleResolved ? "bg-[#fef2f3] dark:bg-[#2a1f23]" : ""}`}
              >
                <AppAvatar url={a.iconUrl} name={a.name} size={8} accent />
                <div className="overflow-hidden">
                  <div className="text-[13px] font-medium text-[#1a1a2e] dark:text-[#e8eaf0] truncate">
                    {a.name}
                  </div>
                  <div className="text-[10px] text-gray-400 dark:text-[#5c6478] font-mono truncate">
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
            <div className="border-t border-gray-100 dark:border-[#2a2f3d] px-2 py-2">
              <button
                onClick={openImport}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#f7f8fa] dark:hover:bg-[#252b38] transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#252b38] flex items-center justify-center shrink-0">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4 text-gray-400 dark:text-[#5c6478]"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <span className="text-[13px] font-medium text-gray-500 dark:text-[#8b93a5]">
                  Add project
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {importOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 dark:bg-black/60"
          onClick={closeImport}
        >
          <div
            className="bg-white dark:bg-[#1c2028] rounded-2xl shadow-2xl w-[480px] max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-[#2a2f3d] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#111827] dark:text-[#e8eaf0]">
                  Add project
                </h2>
                <p className="text-sm text-gray-500 dark:text-[#8b93a5] mt-0.5">
                  Import an app from App Store Connect.
                </p>
              </div>
              <button
                onClick={closeImport}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-[#252b38] flex items-center justify-center text-gray-400 dark:text-[#5c6478] transition-colors"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 flex-1 overflow-y-auto">
              {ascLoading && (
                <div className="flex items-center justify-center py-8 gap-2 text-gray-400 dark:text-[#5c6478] text-sm">
                  <div className="spinner" /> Loading…
                </div>
              )}
              {ascApps !== null &&
                unimportedAscApps !== null &&
                unimportedAscApps.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-[#5c6478] text-center py-6">
                    {ascApps.length === 0
                      ? "No apps found. Check your ASC credentials in Settings."
                      : "All apps are already imported."}
                  </p>
                )}
              {unimportedAscApps !== null && unimportedAscApps.length > 0 && (
                <div className="flex flex-col gap-2">
                  {unimportedAscApps.map((app) => (
                    <div
                      key={app.ascId}
                      className="flex items-center justify-between gap-3 px-4 py-3 bg-[#f7f8fa] dark:bg-[#252b38] rounded-xl border border-gray-200 dark:border-[#2a2f3d]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <AppAvatar
                          url={app.iconUrl}
                          name={app.name}
                          size={9}
                          accent
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#111827] dark:text-[#e8eaf0] truncate">
                            {app.name}
                          </div>
                          <div className="text-[11px] text-gray-400 dark:text-[#5c6478] font-mono">
                            {app.bundleId}
                            {app.primaryLocale ? ` · ${app.primaryLocale}` : ""}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={importing === app.ascId}
                        onClick={() => importApp(app)}
                        className="shrink-0 px-3 py-1.5 rounded-xl border border-[#eef0f3] dark:border-[#2a2f3d] bg-transparent text-[#111827] dark:text-[#e8eaf0] text-xs font-medium hover:border-[#ea0e2b] hover:text-[#ea0e2b] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {importing === app.ascId ? "Importing…" : "Import"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ProfileMenu({
  user,
  onLogout,
  dark,
  onToggleDark,
}: {
  user: AuthUser;
  onLogout: () => void;
  dark: boolean;
  onToggleDark: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setOpen(false), []);
  useClickOutside(ref, closeMenu);

  const displayName = user.name || user.email || "User";
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div ref={ref} className="relative px-3 py-3 border-t border-[#e5e7eb] dark:border-[#2a2f3d]">
      {open && (
        <div className="absolute left-3 right-3 bottom-[calc(100%-8px)] bg-white dark:bg-[#1c2028] border border-[#e5e7eb] dark:border-[#2a2f3d] rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#5c6478]">
            Account
          </div>
          <NavLink
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#f7f8fa] dark:hover:bg-[#252b38] transition-colors text-[13px] text-[#1a1a2e] dark:text-[#e8eaf0] font-medium"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4 text-gray-400 dark:text-[#5c6478] shrink-0"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Profil
          </NavLink>
          <button
            onClick={() => {
              onToggleDark();
              setOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#f7f8fa] dark:hover:bg-[#252b38] transition-colors text-[13px] text-[#1a1a2e] dark:text-[#e8eaf0] font-medium"
          >
            <span className="w-4 h-4 shrink-0 text-gray-400 dark:text-[#5c6478] flex items-center">
              {dark ? <IconSun /> : <IconMoon />}
            </span>
            {dark ? "Light mode" : "Dark mode"}
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-red-50 dark:hover:bg-[#2a1f23] transition-colors text-[13px] text-red-500 font-medium"
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
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors group"
      >
        <div className="w-8 h-8 rounded-full bg-[#ea0e2b] flex items-center justify-center text-white text-xs font-bold shrink-0">
          {initials}
        </div>
        <div className="flex-1 overflow-hidden text-left">
          <div className="text-[13px] font-semibold text-[#1a1a2e] dark:text-[#e8eaf0] truncate">
            {displayName}
          </div>
          {user.role === "ADMIN" && (
            <div className="text-[10px] text-[#ea0e2b] font-medium uppercase tracking-wide">
              Admin
            </div>
          )}
        </div>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`w-3.5 h-3.5 shrink-0 text-gray-400 dark:text-[#5c6478] transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}

const VERSION_STATE_COLORS: Record<string, string> = {
  READY_FOR_SALE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  REPLACED_WITH_NEW_VERSION: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  PREPARE_FOR_SUBMISSION: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  WAITING_FOR_REVIEW: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  IN_REVIEW: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  PENDING_DEVELOPER_RELEASE: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  REJECTED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  DEVELOPER_REJECTED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  METADATA_REJECTED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

const VERSION_STATE_SHORT: Record<string, string> = {
  READY_FOR_SALE: "Live",
  REPLACED_WITH_NEW_VERSION: "Replaced",
  PREPARE_FOR_SUBMISSION: "Draft",
  WAITING_FOR_REVIEW: "Review",
  IN_REVIEW: "In Review",
  PENDING_DEVELOPER_RELEASE: "Pending",
  REJECTED: "Rejected",
  DEVELOPER_REJECTED: "Rejected",
  METADATA_REJECTED: "Meta Rejected",
};

function VersionsSidebarSection({
  navLinkClass,
}: {
  navLinkClass: (p: { isActive: boolean }) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname.startsWith("/versions")) setExpanded(true);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const bundleId = getActiveBundleId();
      const url = bundleId
        ? `/api/asc/versions/list?bundleId=${encodeURIComponent(bundleId)}`
        : "/api/asc/versions/list";
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: VersionSummary[] = await res.json();
      setVersions(data);
      if (location.pathname === "/versions" && data.length > 0) {
        const best = data.find((v) => v.isEditable) ?? data[0];
        navigate(`/versions/${best.versionId}`, { replace: true });
      }
    } catch {
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expanded && !versions) load();
  }, [expanded, versions, load]);

  useEffect(() => {
    const handler = () => {
      setVersions(null);
    };
    window.addEventListener("app-changed", handler);
    return () => window.removeEventListener("app-changed", handler);
  }, []);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !versions) load();
  };

  const isAnyVersionActive = location.pathname.startsWith("/versions");

  return (
    <div>
      <button
        onClick={handleToggle}
        className={`w-full flex items-center gap-2.5 px-3 py-[9px] rounded-lg text-sm font-medium mb-0.5 transition-all [&_svg]:w-[18px] [&_svg]:h-[18px] ${
          isAnyVersionActive
            ? "bg-white dark:bg-[#1c2028] text-[#1a1a2e] dark:text-[#e8eaf0] shadow-sm [&>svg:first-child]:opacity-100 [&>svg:first-child]:text-[#ea0e2b]"
            : "text-[#6b7280] dark:text-[#8b93a5] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] hover:text-[#1a1a2e] dark:hover:text-[#e8eaf0] [&>svg:first-child]:opacity-60"
        }`}
      >
        <IconVersions />
        <span className="flex-1 text-left">Versions</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`!w-3.5 !h-3.5 shrink-0 text-gray-400 dark:text-[#5c6478] transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {expanded && (
        <div className="ml-3 pl-3 border-l border-[#e5e7eb] dark:border-[#2a2f3d] mb-1 flex flex-col gap-0.5">
          {loading && !versions && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 text-[12px] text-gray-400 dark:text-[#5c6478]">
              <div className="spinner !w-3 !h-3" /> Loading…
            </div>
          )}
          {versions?.length === 0 && (
            <div className="px-2 py-1.5 text-[12px] text-gray-400 dark:text-[#5c6478]">
              No versions found
            </div>
          )}
          {versions?.map((v) => {
            const isActive = location.pathname === `/versions/${v.versionId}`;
            const stateColor =
              VERSION_STATE_COLORS[v.appStoreState] ??
              "bg-gray-100 text-gray-500 dark:bg-[#252b38] dark:text-[#8b93a5]";
            const stateShort =
              VERSION_STATE_SHORT[v.appStoreState] ?? v.appStoreState;
            return (
              <NavLink
                key={v.versionId}
                to={`/versions/${v.versionId}`}
                className={`flex items-center justify-between gap-2 px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-all ${
                  isActive
                    ? "bg-white dark:bg-[#1c2028] text-[#1a1a2e] dark:text-[#e8eaf0] shadow-sm"
                    : "text-[#6b7280] dark:text-[#8b93a5] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] hover:text-[#1a1a2e] dark:hover:text-[#e8eaf0]"
                }`}
              >
                <span className="truncate">{v.versionString}</span>
                <span
                  className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${stateColor}`}
                >
                  {stateShort}
                </span>
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { data: dash } = useApi<DashboardData>("/dashboard");
  const { toasts, addToast } = useToast();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dark, setDark] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

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
      <div className="flex items-center justify-center h-screen bg-[#f8f9fb] dark:bg-[#0f1117]">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <Login onAuth={(u) => setUser(u)} />;
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-[9px] rounded-lg text-sm font-medium mb-0.5 transition-all [&_svg]:w-[18px] [&_svg]:h-[18px] ${
      isActive
        ? "bg-white dark:bg-[#1c2028] text-[#1a1a2e] dark:text-[#e8eaf0] shadow-sm [&_svg]:opacity-100 [&_svg]:text-[#ea0e2b]"
        : "text-[#6b7280] dark:text-[#8b93a5] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] hover:text-[#1a1a2e] dark:hover:text-[#e8eaf0] [&_svg]:opacity-60"
    }`;

  return (
    <div className="flex h-screen overflow-hidden">
      <ToastContainer toasts={toasts} />
      <aside className="w-[275px] min-w-[275px] bg-[#f8f9fb] dark:bg-[#13161d] border-r border-[#e5e7eb] dark:border-[#2a2f3d] flex flex-col overflow-y-auto">
        <div className="px-4 pt-6 pb-5 flex items-center gap-2.5">
          <img
            className="w-[42px] h-[42px] rounded-lg"
            src="/app/logo.png"
            alt="Fringelo Logo"
          />
          <div>
            <div className="text-2xl font-bold text-[#ea0e2b] tracking-[-0.3px]">
              AppCore
            </div>
            <div className="text-sm text-[#9ca3af] dark:text-[#5c6478] font-medium">ASO Engine</div>
          </div>
        </div>
        <AppSwitcher current={dash?.app ?? null} addToast={addToast} />
        <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.8px] text-[#9ca3af] dark:text-[#5c6478]">
          Navigation
        </div>
        <nav className="px-2 flex-1">
          {sidebarLinks.map((link) => (
            <NavLink key={link.to} to={link.to} className={navLinkClass}>
              {link.icon && <link.icon />}
              {link.label}
            </NavLink>
          ))}
          <VersionsSidebarSection navLinkClass={navLinkClass} />
          <div className="px-3 pb-1 pt-2 mt-4 text-xs font-semibold uppercase tracking-[0.8px] text-[#9ca3af] dark:text-[#5c6478]">
            Operations
          </div>
          {sidebarOperations.map((link) => (
            <NavLink key={link.to} to={link.to} className={navLinkClass}>
              {link.icon && <link.icon />}
              {link.label}
            </NavLink>
          ))}
        </nav>
        <ProfileMenu
          user={user}
          onLogout={handleLogout}
          dark={dark}
          onToggleDark={() => setDark((d) => !d)}
        />
      </aside>

      <main className="flex-1 overflow-y-auto px-8 py-7 bg-[#f8f9fb] dark:bg-[#0f1117]">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route
            path="/suggestions"
            element={<Suggestions addToast={addToast} />}
          />
          <Route path="/keywords" element={<Keywords addToast={addToast} />} />
          <Route
            path="/competitors"
            element={<Competitors addToast={addToast} />}
          />
          <Route
            path="/competitors/:id"
            element={<CompetitorDetailPage addToast={addToast} />}
          />
          <Route
            path="/analytics"
            element={<Analytics addToast={addToast} />}
          />
          <Route
            path="/versions/:versionId"
            element={<Versions addToast={addToast} />}
          />
          <Route path="/versions" element={<Versions addToast={addToast} />} />
          <Route path="/agents" element={<Agents addToast={addToast} />} />
          <Route path="/actions" element={<Actions addToast={addToast} />} />
          <Route
            path="/screenshots"
            element={<Screenshots addToast={addToast} />}
          />
          <Route path="/settings" element={<Settings addToast={addToast} />} />
        </Routes>
      </main>
    </div>
  );
}
