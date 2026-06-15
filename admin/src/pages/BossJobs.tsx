import { useState, useEffect, useCallback, Fragment } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, ChevronDown, ChevronRight } from "lucide-react";

interface BossJob {
  id: string;
  name: string;
  state: string;
  data: any;
  output: any;
  retry_count: number;
  created_on: string;
  started_on: string | null;
  completed_on: string | null;
}

interface QueueStat {
  name: string;
  state: string;
  count: number;
}

interface BossSchedule {
  name: string;
  cron: string;
  timezone: string;
  updated_on: string;
}

const STATE_COLORS: Record<string, string> = {
  created: "bg-blue-100 text-blue-800",
  retry: "bg-yellow-100 text-yellow-800",
  active: "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
  expired: "bg-gray-100 text-gray-700",
  cancelled: "bg-gray-100 text-gray-700",
  failed: "bg-red-100 text-red-800",
};

const QUEUES = [
  "scrape",
  "track-keywords",
  "sync-analytics",
  "extract-keywords",
  "discover-keywords",
  "discover-competitors",
  "analyze",
  "sync-metadata",
  "competitor-intel",
];

type Tab = "schedules" | "jobs";

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "medium" });
}

function StatsBadge({ stats, queue }: { stats: QueueStat[]; queue: string }) {
  const qStats = stats.filter((s) => s.name === queue);
  if (!qStats.length) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {qStats.map((s) => (
        <span
          key={s.state}
          className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATE_COLORS[s.state] ?? "bg-gray-100 text-gray-700"}`}
        >
          {s.state}: {s.count}
        </span>
      ))}
    </div>
  );
}

export default function BossJobs() {
  const [tab, setTab] = useState<Tab>("schedules");
  const [jobs, setJobs] = useState<BossJob[]>([]);
  const [stats, setStats] = useState<QueueStat[]>([]);
  const [schedules, setSchedules] = useState<BossSchedule[]>([]);
  const [selectedQueue, setSelectedQueue] = useState<string>("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (selectedQueue) params.set("queue", selectedQueue);
      if (selectedState) params.set("state", selectedState);
      const [jobsData, statsData, schedulesData] = await Promise.all([
        apiFetch<BossJob[]>(`/boss/jobs?${params}`),
        apiFetch<QueueStat[]>("/boss/stats"),
        apiFetch<BossSchedule[]>("/boss/schedules"),
      ]);
      setJobs(jobsData ?? []);
      setStats(statsData ?? []);
      setSchedules(schedulesData ?? []);
    } finally {
      setLoading(false);
    }
  }, [selectedQueue, selectedState]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = jobs.filter((j) => !search || j.name.includes(search) || j.id.includes(search));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">pg-boss Jobs</h1>
          <p className="text-muted-foreground text-sm mt-1">Schedules and job queues</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex gap-2 border-b">
        {(["schedules", "jobs"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "schedules" ? `Schedules (${schedules.length})` : `Jobs (${filtered.length})`}
          </button>
        ))}
      </div>

      {tab === "schedules" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Queue</TableHead>
                    <TableHead>Cron</TableHead>
                    <TableHead>Timezone</TableHead>
                    <TableHead>Last updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && schedules.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No schedules found
                      </TableCell>
                    </TableRow>
                  )}
                  {schedules.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="font-mono text-xs">{s.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{s.cron}</TableCell>
                      <TableCell className="text-xs">{s.timezone}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmt(s.updated_on)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "jobs" && (
        <>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {QUEUES.map((q) => (
              <Card
                key={q}
                className={`cursor-pointer transition-all hover:shadow-md ${selectedQueue === q ? "ring-2 ring-brand" : ""}`}
                onClick={() => setSelectedQueue(selectedQueue === q ? "" : q)}
              >
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm font-mono">{q}</CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-4">
                  <StatsBadge stats={stats} queue={q} />
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <Input
              placeholder="Search (queue, ID…)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56"
            />
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            >
              <option value="">All states</option>
              {["created", "active", "retry", "completed", "failed", "expired", "cancelled"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {(selectedQueue || selectedState || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedQueue("");
                  setSelectedState("");
                  setSearch("");
                }}
              >
                Reset filters
              </Button>
            )}
            <span className="text-muted-foreground text-sm ml-auto">{filtered.length} jobs</span>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-6"></TableHead>
                      <TableHead>Queue</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Retries</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead className="font-mono text-xs">ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          Loading…
                        </TableCell>
                      </TableRow>
                    )}
                    {!loading && filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No jobs found
                        </TableCell>
                      </TableRow>
                    )}
                    {filtered.map((job) => (
                      <Fragment key={job.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
                        >
                          <TableCell>
                            {expandedId === job.id ? (
                              <ChevronDown className="h-3 w-3 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{job.name}</TableCell>
                          <TableCell>
                            <span
                              className={`text-xs px-2 py-0.5 rounded font-medium ${STATE_COLORS[job.state] ?? "bg-gray-100 text-gray-700"}`}
                            >
                              {job.state}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">{job.retry_count ?? 0}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{fmt(job.created_on)}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{fmt(job.started_on)}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{fmt(job.completed_on)}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-24">
                            {job.id.slice(0, 8)}…
                          </TableCell>
                        </TableRow>
                        {expandedId === job.id && (
                          <TableRow>
                            <TableCell colSpan={8} className="bg-muted/30 p-0">
                              <div className="grid md:grid-cols-2 gap-4 p-4">
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-1">INPUT DATA</p>
                                  <pre className="text-xs bg-background border rounded p-2 overflow-auto max-h-48">
                                    {JSON.stringify(job.data, null, 2)}
                                  </pre>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-1">OUTPUT</p>
                                  <pre className="text-xs bg-background border rounded p-2 overflow-auto max-h-48">
                                    {job.output ? JSON.stringify(job.output, null, 2) : "—"}
                                  </pre>
                                </div>
                              </div>
                              <div className="px-4 pb-3">
                                <p className="text-xs text-muted-foreground font-mono">Job ID: {job.id}</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
