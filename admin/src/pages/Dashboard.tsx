import { useAdminApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users, Building, Smartphone, Search, BarChart3, Star,
  Image, Hammer, Key, Bell, Activity
} from "lucide-react";

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
}

const statCards: { key: keyof DashboardStats; label: string; icon: React.ReactNode; color: string }[] = [
  { key: "users", label: "Users", icon: <Users className="h-4 w-4" />, color: "text-blue-600" },
  { key: "teams", label: "Teams", icon: <Building className="h-4 w-4" />, color: "text-purple-600" },
  { key: "apps", label: "Apps", icon: <Smartphone className="h-4 w-4" />, color: "text-green-600" },
  { key: "keywords", label: "Keywords", icon: <Search className="h-4 w-4" />, color: "text-orange-600" },
  { key: "suggestions", label: "ASO Suggestions", icon: <Activity className="h-4 w-4" />, color: "text-cyan-600" },
  { key: "reviews", label: "Reviews", icon: <Star className="h-4 w-4" />, color: "text-yellow-600" },
  { key: "screenshotJobs", label: "Screenshot Jobs", icon: <Image className="h-4 w-4" />, color: "text-pink-600" },
  { key: "buildJobs", label: "Build Jobs", icon: <Hammer className="h-4 w-4" />, color: "text-red-600" },
  { key: "oauthClients", label: "OAuth Clients", icon: <Key className="h-4 w-4" />, color: "text-indigo-600" },
  { key: "deviceTokens", label: "Device Tokens", icon: <Bell className="h-4 w-4" />, color: "text-teal-600" },
  { key: "analytics", label: "Analytics Records", icon: <BarChart3 className="h-4 w-4" />, color: "text-emerald-600" },
];

export default function Dashboard() {
  const { data: stats, loading } = useAdminApi<DashboardStats>("/dashboard");

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <span className={stat.color}>{stat.icon}</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? (
                  <span className="text-muted-foreground">…</span>
                ) : (
                  stats?.[stat.key]?.toLocaleString() ?? 0
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
