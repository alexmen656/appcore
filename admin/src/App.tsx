import { useState, useEffect } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { modelConfigs, modelCategories } from "@/lib/models";
import { logout } from "@/lib/api";
import Dashboard from "@/pages/Dashboard";
import ModelCrud from "@/pages/ModelCrud";
import RecordDetail from "@/pages/RecordDetail";
import LoginPage from "@/pages/Login";
import BossJobs from "@/pages/BossJobs";
import {
  LayoutDashboard, Users, Building, UserCheck, Mail, Settings,
  Smartphone, Camera, Search, TrendingUp, Lightbulb, FlaskConical,
  Swords, BarChart3, Star, MessageSquare, FileDiff, Image,
  Hammer, Key, Bell, Send, Fingerprint, BriefcaseBusiness, Gauge,
} from "lucide-react";

const iconMap: Record<string, React.ReactNode> = {
  "users": <Users className="h-4 w-4" />,
  "building": <Building className="h-4 w-4" />,
  "user-check": <UserCheck className="h-4 w-4" />,
  "mail": <Mail className="h-4 w-4" />,
  "settings": <Settings className="h-4 w-4" />,
  "smartphone": <Smartphone className="h-4 w-4" />,
  "camera": <Camera className="h-4 w-4" />,
  "search": <Search className="h-4 w-4" />,
  "trending-up": <TrendingUp className="h-4 w-4" />,
  "lightbulb": <Lightbulb className="h-4 w-4" />,
  "flask-conical": <FlaskConical className="h-4 w-4" />,
  "swords": <Swords className="h-4 w-4" />,
  "bar-chart-3": <BarChart3 className="h-4 w-4" />,
  "star": <Star className="h-4 w-4" />,
  "message-square": <MessageSquare className="h-4 w-4" />,
  "file-diff": <FileDiff className="h-4 w-4" />,
  "image": <Image className="h-4 w-4" />,
  "hammer": <Hammer className="h-4 w-4" />,
  "key": <Key className="h-4 w-4" />,
  "bell": <Bell className="h-4 w-4" />,
  "send": <Send className="h-4 w-4" />,
  "fingerprint": <Fingerprint className="h-4 w-4" />,
  "gauge": <Gauge className="h-4 w-4" />,
};

export default function App() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => setLoggedIn(r.ok))
      .catch(() => setLoggedIn(false));
  }, []);

  if (loggedIn === null) return null;

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />;
  }

  const handleLogout = async () => {
    await logout();
    setLoggedIn(false);
  };
  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-4 border-b flex items-center gap-3">
          <img src="/admin/logo.svg" alt="Marteso" className="h-9 w-9 shrink-0" />
          <div>
            <h2 className="font-bold text-base leading-tight">Marteso Admin</h2>
            <p className="text-xs text-muted-foreground">System Administration</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          <div>
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                }`
              }
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </NavLink>
          </div>

          <div>
            <h3 className="px-3 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Jobs
            </h3>
            <NavLink
              to="/jobs"
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                }`
              }
            >
              <BriefcaseBusiness className="h-4 w-4" />
              pg-boss Jobs
            </NavLink>
          </div>

          {modelCategories.map((category) => (
            <div key={category}>
              <h3 className="px-3 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {category}
              </h3>
              {modelConfigs
                .filter((m) => m.category === category)
                .map((model) => (
                  <NavLink
                    key={model.apiPath}
                    to={`/models/${model.apiPath}`}
                    className={({ isActive }) =>
                      `flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                      }`
                    }
                  >
                    {iconMap[model.icon] ?? <Settings className="h-4 w-4" />}
                    {model.plural}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <div className="p-3 border-t flex flex-col gap-1">
          <a href="/app" className="text-xs text-muted-foreground hover:underline">← Zurück zur App</a>
          <button
            onClick={handleLogout}
            className="text-xs text-muted-foreground hover:underline text-left"
          >
            Abmelden
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/jobs" element={<BossJobs />} />
            <Route path="/models/:model" element={<ModelCrud />} />
            <Route path="/models/:model/:id" element={<RecordDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
