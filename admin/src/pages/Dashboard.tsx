import { useAdminApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Building,
  Smartphone,
  Search,
  BarChart3,
  Star,
  Image,
  Hammer,
  Key,
  Bell,
  Activity,
  Gauge,
  CreditCard,
  Euro,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ChartPoint {
  date: string;
  count: number;
}
interface StatusPoint {
  status: string;
  count: number;
}
interface TypePoint {
  type: string;
  count: number;
}

interface RateLimitEntry {
  teamId: string;
  teamName: string;
  hourLimit: number;
  hourRemaining: number;
  updatedAt: string;
}

interface DashboardStats {
  users: number;
  teams: number;
  apps: number;
  keywords: number;
  suggestions: number;
  reviews: number;
  screenshotJobs: number;
  buildJobs: number;
  oauthClients: number;
  deviceTokens: number;
  analytics: number;
  subscriptions: number;
  activeSubscriptions: number;
  mrrEur: number;
  subscriptionStatus?: StatusPoint[];
  ascRateLimits?: RateLimitEntry[];
  charts?: {
    usersOverTime: ChartPoint[];
    appsOverTime: ChartPoint[];
    jobStatus: StatusPoint[];
    suggestionTypes: TypePoint[];
  };
}

const BRAND = "#FF6B00";
const BRAND2 = "#CC0022";
const PIE_COLORS = ["#FF6B00", "#CC0022", "#f97316", "#ec4899", "#8b5cf6", "#06b6d4"];

const statCards = [
  {
    key: "users" as const,
    label: "Users",
    icon: <Users className="h-4 w-4" />,
    color: "text-blue-600",
  },
  {
    key: "teams" as const,
    label: "Teams",
    icon: <Building className="h-4 w-4" />,
    color: "text-purple-600",
  },
  {
    key: "apps" as const,
    label: "Apps",
    icon: <Smartphone className="h-4 w-4" />,
    color: "text-green-600",
  },
  {
    key: "keywords" as const,
    label: "Keywords",
    icon: <Search className="h-4 w-4" />,
    color: "text-orange-600",
  },
  {
    key: "suggestions" as const,
    label: "ASO Suggestions",
    icon: <Activity className="h-4 w-4" />,
    color: "text-cyan-600",
  },
  {
    key: "reviews" as const,
    label: "Reviews",
    icon: <Star className="h-4 w-4" />,
    color: "text-yellow-600",
  },
  {
    key: "screenshotJobs" as const,
    label: "Screenshot Jobs",
    icon: <Image className="h-4 w-4" />,
    color: "text-pink-600",
  },
  {
    key: "buildJobs" as const,
    label: "Build Jobs",
    icon: <Hammer className="h-4 w-4" />,
    color: "text-red-600",
  },
  {
    key: "oauthClients" as const,
    label: "OAuth Clients",
    icon: <Key className="h-4 w-4" />,
    color: "text-indigo-600",
  },
  {
    key: "deviceTokens" as const,
    label: "Device Tokens",
    icon: <Bell className="h-4 w-4" />,
    color: "text-teal-600",
  },
  {
    key: "analytics" as const,
    label: "Analytics Records",
    icon: <BarChart3 className="h-4 w-4" />,
    color: "text-emerald-600",
  },
  {
    key: "activeSubscriptions" as const,
    label: "Active Subscriptions",
    icon: <CreditCard className="h-4 w-4" />,
    color: "text-fuchsia-600",
  },
];

export default function Dashboard() {
  const { data: stats, loading } = useAdminApi<DashboardStats>("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">System Overview and Key Metrics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.key} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <span className={stat.color}>{stat.icon}</span>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loading ? <Skeleton className="h-8 w-20" /> : (stats?.[stat.key]?.toLocaleString("de-DE") ?? 0)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
          <Euro className="h-4 w-4 text-fuchsia-600" />
          <CardTitle className="text-base">Billing — Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">MRR (estimated)</div>
                <div className="text-2xl font-bold">€{(stats?.mrrEur ?? 0).toLocaleString("en-US")}</div>
                <div className="text-xs text-muted-foreground">based on €19/mo & €190/yr</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Active Subscriptions</div>
                <div className="text-2xl font-bold">{(stats?.activeSubscriptions ?? 0).toLocaleString("en-US")}</div>
                <div className="text-xs text-muted-foreground">
                  of {(stats?.subscriptions ?? 0).toLocaleString("en-US")} total
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Status Breakdown</div>
                {stats?.subscriptionStatus && stats.subscriptionStatus.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {stats.subscriptionStatus.map((s) => (
                      <span
                        key={s.status}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
                      >
                        <span className="text-muted-foreground">{s.status}</span>
                        <span>{s.count}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No subscriptions</div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {(loading || (stats?.ascRateLimits && stats.ascRateLimits.length > 0)) && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
            <Gauge className="h-4 w-4 text-orange-500" />
            <CardTitle className="text-base">ASC Rate Limits (per Team)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <div className="space-y-4">
                {stats!.ascRateLimits!.map((rl) => {
                  const pct = Math.round((rl.hourRemaining / rl.hourLimit) * 100);
                  const color = pct <= 10 ? "bg-red-500" : pct <= 30 ? "bg-yellow-500" : "bg-green-500";
                  const updatedAgo = Math.round((Date.now() - new Date(rl.updatedAt).getTime()) / 60000);
                  return (
                    <div key={rl.teamId} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate max-w-[200px]" title={rl.teamId}>
                          {rl.teamName}
                        </span>
                        <span
                          className={`font-mono text-xs ${pct <= 10 ? "text-red-600 font-bold" : pct <= 30 ? "text-yellow-600" : "text-muted-foreground"}`}
                        >
                          {rl.hourRemaining.toLocaleString("de-DE")} / {rl.hourLimit.toLocaleString("de-DE")} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${color}`}
                          style={{ width: `${Math.max(pct, 1)}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground text-right">updated {updatedAgo} min ago</div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Users (last 30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !stats?.charts?.usersOverTime?.length ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                {loading ? "Loading…" : "No data"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={stats.charts.usersOverTime}>
                  <defs>
                    <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={BRAND} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={BRAND} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, "User"]} labelFormatter={(l) => `Date: ${l}`} />
                  <Area type="monotone" dataKey="count" stroke={BRAND} fill="url(#userGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Apps (last 30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !stats?.charts?.appsOverTime?.length ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                {loading ? "Loading…" : "No data"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={stats.charts.appsOverTime}>
                  <defs>
                    <linearGradient id="appGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={BRAND2} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={BRAND2} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, "Apps"]} labelFormatter={(l) => `Date: ${l}`} />
                  <Area type="monotone" dataKey="count" stroke={BRAND2} fill="url(#appGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ASO Suggestion Types</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !stats?.charts?.suggestionTypes?.length ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                {loading ? "Loading…" : "No data"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.charts.suggestionTypes} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis dataKey="type" type="category" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {stats.charts.suggestionTypes.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Job Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !stats?.charts?.jobStatus?.length ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                {loading ? "Loading…" : "No data"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={stats.charts.jobStatus}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    label={({ name, percent }) =>
                      `${String(name).replace("build_", "B:")} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {stats.charts.jobStatus.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, String(n)]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
