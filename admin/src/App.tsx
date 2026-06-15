import { useState, useEffect, useMemo } from "react";
import { Routes, Route, NavLink, Navigate, useLocation, Link } from "react-router-dom";
import { modelConfigs, modelCategories, getModelConfig } from "@/lib/models";
import { logout } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import Dashboard from "@/pages/Dashboard";
import ModelCrud from "@/pages/ModelCrud";
import RecordDetail from "@/pages/RecordDetail";
import LoginPage from "@/pages/Login";
import BossJobs from "@/pages/BossJobs";
import Subscriptions from "@/pages/Subscriptions";
import {
  LayoutDashboard,
  Users,
  Building,
  UserCheck,
  Mail,
  Settings,
  Smartphone,
  Camera,
  Search,
  TrendingUp,
  Lightbulb,
  FlaskConical,
  Swords,
  BarChart3,
  Star,
  MessageSquare,
  FileDiff,
  Image,
  Hammer,
  Key,
  Bell,
  Send,
  Fingerprint,
  BriefcaseBusiness,
  Gauge,
  CreditCard,
  ChevronRight,
  ChevronDown,
  Moon,
  Sun,
  LogOut,
  ExternalLink,
  X,
} from "lucide-react";

const iconMap: Record<string, React.ReactNode> = {
  users: <Users className="h-4 w-4" />,
  building: <Building className="h-4 w-4" />,
  "user-check": <UserCheck className="h-4 w-4" />,
  mail: <Mail className="h-4 w-4" />,
  settings: <Settings className="h-4 w-4" />,
  smartphone: <Smartphone className="h-4 w-4" />,
  camera: <Camera className="h-4 w-4" />,
  search: <Search className="h-4 w-4" />,
  "trending-up": <TrendingUp className="h-4 w-4" />,
  lightbulb: <Lightbulb className="h-4 w-4" />,
  "flask-conical": <FlaskConical className="h-4 w-4" />,
  swords: <Swords className="h-4 w-4" />,
  "bar-chart-3": <BarChart3 className="h-4 w-4" />,
  star: <Star className="h-4 w-4" />,
  "message-square": <MessageSquare className="h-4 w-4" />,
  "file-diff": <FileDiff className="h-4 w-4" />,
  image: <Image className="h-4 w-4" />,
  hammer: <Hammer className="h-4 w-4" />,
  key: <Key className="h-4 w-4" />,
  bell: <Bell className="h-4 w-4" />,
  send: <Send className="h-4 w-4" />,
  fingerprint: <Fingerprint className="h-4 w-4" />,
  gauge: <Gauge className="h-4 w-4" />,
  "credit-card": <CreditCard className="h-4 w-4" />,
};

interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
    isActive
      ? "bg-brand/10 text-brand font-medium"
      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
  }`;

function Breadcrumbs() {
  const { pathname } = useLocation();
  const parts: { label: string; to?: string }[] = [{ label: "Home", to: "/" }];

  if (pathname === "/jobs") {
    parts.push({ label: "pg-boss Jobs" });
  } else if (pathname === "/subscriptions") {
    parts.push({ label: "Subscriptions" });
  } else if (pathname.startsWith("/models/")) {
    const [, , modelPath, id] = pathname.split("/");
    const config = getModelConfig(modelPath ?? "");
    if (config) {
      parts.push({ label: config.plural, to: `/models/${modelPath}` });
      if (id) parts.push({ label: "Detail" });
    }
  } else if (pathname === "/") {
    parts[0] = { label: "Dashboard" };
  }

  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
          {p.to && i < parts.length - 1 ? (
            <Link to={p.to} className="transition-colors hover:text-foreground">
              {p.label}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{p.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

function UserChip({ user, onLogout }: { user: CurrentUser | null; onLogout: () => void }) {
  if (!user) return null;
  const initials = (user.name || user.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-bold text-brand">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{user.name || user.email}</p>
        <p className="truncate text-xs text-muted-foreground">{user.role}</p>
      </div>
      <button
        onClick={onLogout}
        title="Sign out"
        className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-destructive"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("admin-nav-collapsed") || "[]"));
    } catch {
      return new Set();
    }
  });
  const { theme, toggle } = useTheme();

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(async (r) => {
        if (r.ok) {
          setUser(await r.json().catch(() => null));
          setLoggedIn(true);
        } else {
          setLoggedIn(false);
        }
      })
      .catch(() => setLoggedIn(false));
  }, []);

  const toggleGroup = (cat: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      try {
        localStorage.setItem("admin-nav-collapsed", JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const q = filter.trim().toLowerCase();
  const filteredByCategory = useMemo(() => {
    const map = new Map<string, typeof modelConfigs>();
    for (const cat of modelCategories) {
      const items = modelConfigs.filter(
        (m) => m.category === cat && (!q || m.plural.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)),
      );
      if (items.length) map.set(cat, items);
    }
    return map;
  }, [q]);

  if (loggedIn === null) return null;

  if (!loggedIn) {
    return (
      <LoginPage
        onLogin={() => {
          setLoggedIn(true);
          fetch("/api/auth/me", { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .then(setUser)
            .catch(() => {});
        }}
      />
    );
  }

  const handleLogout = async () => {
    await logout();
    setLoggedIn(false);
    setUser(null);
  };

  return (
    <div className="flex h-screen bg-background">
      <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <img src="/logo-wordmark.svg" alt="Marteso" className="h-7 w-auto shrink-0" />
          <span className="ml-2 rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
            Admin
          </span>
        </div>

        <div className="border-b border-sidebar-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Jump to…"
              className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-sm outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand"
            />
            {filter && (
              <button
                onClick={() => setFilter("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          {!q && (
            <div className="space-y-3">
              <NavLink to="/" end className={navLinkClass}>
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </NavLink>
              <div>
                <h3 className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Billing
                </h3>
                <NavLink to="/subscriptions" className={navLinkClass}>
                  <CreditCard className="h-4 w-4" />
                  Subscriptions
                </NavLink>
              </div>
              <div>
                <h3 className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Jobs
                </h3>
                <NavLink to="/jobs" className={navLinkClass}>
                  <BriefcaseBusiness className="h-4 w-4" />
                  pg-boss Jobs
                </NavLink>
              </div>
            </div>
          )}

          {[...filteredByCategory.entries()].map(([category, models]) => {
            const isCollapsed = !q && collapsed.has(category);
            return (
              <div key={category}>
                <button
                  onClick={() => toggleGroup(category)}
                  className="mb-1 flex w-full items-center gap-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                >
                  {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {category}
                </button>
                {!isCollapsed &&
                  models.map((model) => (
                    <NavLink key={model.apiPath} to={`/models/${model.apiPath}`} className={navLinkClass}>
                      {iconMap[model.icon] ?? <Settings className="h-4 w-4" />}
                      {model.plural}
                    </NavLink>
                  ))}
              </div>
            );
          })}

          {q && filteredByCategory.size === 0 && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">No matches</p>
          )}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <UserChip user={user} onLogout={handleLogout} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-card/60 px-6 backdrop-blur">
          <Breadcrumbs />
          <div className="flex items-center gap-1">
            <button
              onClick={toggle}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <a
              href="/app"
              title="Back to App"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">App</span>
            </a>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/subscriptions" element={<Subscriptions />} />
              <Route path="/jobs" element={<BossJobs />} />
              <Route path="/models/:model" element={<ModelCrud />} />
              <Route path="/models/:model/:id" element={<RecordDetail />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
