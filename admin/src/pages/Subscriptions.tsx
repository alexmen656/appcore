import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminApi, apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, AutoBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Crown,
  Building,
  Search as SearchIcon,
  Sparkles,
  CreditCard,
  Infinity as InfinityIcon,
  ExternalLink,
  Plus,
  CalendarClock,
} from "lucide-react";

interface SubInfo {
  status: string | null;
  interval: string | null;
  endsAt: string | null;
  renewsAt: string | null;
  source: "admin" | "lemon";
  permanent: boolean;
  cardBrand: string | null;
  cardLastFour: string | null;
}
interface TeamRow {
  teamId: string;
  teamName: string;
  createdAt: string;
  memberCount: number;
  appCount: number;
  isPro: boolean;
  subscription: SubInfo | null;
}
interface Overview {
  summary: { totalTeams: number; proTeams: number; adminGrants: number; paidTeams: number };
  rows: TeamRow[];
}

const PRESETS = [
  { label: "1 month", days: 30 },
  { label: "3 months", days: 90 },
  { label: "6 months", days: 180 },
  { label: "1 year", days: 365 },
];

function fmtDate(v: string | null): string {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(v: string | null): number | null {
  if (!v) return null;
  return Math.ceil((new Date(v).getTime() - Date.now()) / 86_400_000);
}

function SummaryCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <span className={accent}>{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value.toLocaleString("en-US")}</div>
      </CardContent>
    </Card>
  );
}

function PlanCell({ row }: { row: TeamRow }) {
  const s = row.subscription;
  if (!s || !row.isPro) {
    return <Badge variant="secondary">Free</Badge>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <AutoBadge value={s.status ?? "active"} />
      {s.source === "admin" ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
          <Crown className="h-3 w-3" /> Grant
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
          <CreditCard className="h-3 w-3" /> Paid
        </span>
      )}
    </div>
  );
}

function PeriodCell({ row }: { row: TeamRow }) {
  const s = row.subscription;
  if (!s || !row.isPro) return <span className="text-muted-foreground">—</span>;
  if (s.permanent) {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <InfinityIcon className="h-3.5 w-3.5" /> Forever
      </span>
    );
  }
  const end = s.endsAt ?? s.renewsAt;
  const days = daysUntil(end);
  return (
    <div className="flex flex-col">
      <span className="text-sm">{fmtDate(end)}</span>
      {days !== null && (
        <span className={`text-xs ${days <= 7 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
          {days > 0 ? `in ${days} day${days === 1 ? "" : "s"}` : "expired"}
        </span>
      )}
    </div>
  );
}

export default function Subscriptions() {
  const { data, loading, refetch } = useAdminApi<Overview>("/billing/overview");
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [grantTeam, setGrantTeam] = useState<TeamRow | null>(null);
  const [revokeTeam, setRevokeTeam] = useState<TeamRow | null>(null);
  const [customDays, setCustomDays] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = data?.rows ?? [];
    return q ? all.filter((r) => r.teamName.toLowerCase().includes(q) || r.teamId.includes(q)) : all;
  }, [data, search]);

  const closeGrant = () => {
    setGrantTeam(null);
    setCustomDays("");
  };

  const grant = async (body: { forever: true } | { durationDays: number }) => {
    if (!grantTeam) return;
    setBusy(true);
    try {
      await apiFetch(`/teams/${grantTeam.teamId}/grant-pro`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast.success(
        `Pro ${grantTeam.subscription?.source === "admin" ? "extended" : "granted"} for ${grantTeam.teamName}`,
      );
      closeGrant();
      refetch();
    } catch (e) {
      toast.error("Grant failed", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!revokeTeam) return;
    setBusy(true);
    try {
      await apiFetch(`/teams/${revokeTeam.teamId}/revoke-pro`, { method: "POST" });
      toast.success(`Pro revoked for ${revokeTeam.teamName}`);
      setRevokeTeam(null);
      refetch();
    } catch (e) {
      toast.error("Revoke failed", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const isGrantExtend = grantTeam?.subscription?.source === "admin";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Manage team plans and grant Pro access with one click.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading || !data ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <SummaryCard
              label="Pro Teams"
              value={data.summary.proTeams}
              icon={<Sparkles className="h-4 w-4" />}
              accent="text-brand"
            />
            <SummaryCard
              label="Admin Grants"
              value={data.summary.adminGrants}
              icon={<Crown className="h-4 w-4" />}
              accent="text-violet-600"
            />
            <SummaryCard
              label="Paid"
              value={data.summary.paidTeams}
              icon={<CreditCard className="h-4 w-4" />}
              accent="text-emerald-600"
            />
            <SummaryCard
              label="Total Teams"
              value={data.summary.totalTeams}
              icon={<Building className="h-4 w-4" />}
              accent="text-blue-600"
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader className="border-b py-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {data ? `${rows.length} of ${data.rows.length} teams` : "Loading…"}
            </CardTitle>
            <div className="relative w-72 max-w-full">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search teams…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Pro until</TableHead>
                    <TableHead className="text-center">Members · Apps</TableHead>
                    <TableHead className="w-56 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const isPaid = row.subscription?.source === "lemon";
                    return (
                      <TableRow key={row.teamId}>
                        <TableCell>
                          <Link to={`/models/team/${row.teamId}`} className="font-medium hover:text-brand">
                            {row.teamName}
                          </Link>
                          <div className="text-xs text-muted-foreground">since {fmtDate(row.createdAt)}</div>
                        </TableCell>
                        <TableCell>
                          <PlanCell row={row} />
                        </TableCell>
                        <TableCell>
                          <PeriodCell row={row} />
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {row.memberCount} · {row.appCount}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {isPaid ? (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <ExternalLink className="h-3.5 w-3.5" /> Lemon Squeezy
                              </span>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant={row.isPro ? "outline" : "default"}
                                  onClick={() => setGrantTeam(row)}
                                >
                                  {row.isPro ? (
                                    <>
                                      <CalendarClock className="mr-1 h-3.5 w-3.5" /> Extend
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="mr-1 h-3.5 w-3.5" /> Grant Pro
                                    </>
                                  )}
                                </Button>
                                {row.isPro && (
                                  <Button size="sm" variant="ghost" onClick={() => setRevokeTeam(row)}>
                                    Revoke
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                        No teams found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grant / Extend dialog */}
      <Dialog open={!!grantTeam} onOpenChange={(o) => !o && closeGrant()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-brand" />
              {isGrantExtend ? "Extend Pro" : "Grant Pro"}
            </DialogTitle>
            <DialogDescription>
              {isGrantExtend ? "Add more time to " : "Give "}
              <span className="font-medium text-foreground">{grantTeam?.teamName}</span>
              {isGrantExtend ? "'s Pro access. Time is added on top of the current end date." : " full Pro access."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Duration</p>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((p) => (
                  <Button
                    key={p.days}
                    variant="outline"
                    disabled={busy}
                    onClick={() => grant({ durationDays: p.days })}
                  >
                    {isGrantExtend ? `+${p.label}` : p.label}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  className="col-span-2 border-brand/40 text-brand hover:bg-brand/10"
                  disabled={busy}
                  onClick={() => grant({ forever: true })}
                >
                  <InfinityIcon className="mr-1.5 h-4 w-4" /> Forever
                </Button>
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Custom</p>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    type="number"
                    min={1}
                    placeholder="Number of days"
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                  />
                </div>
                <Button
                  disabled={busy || !Number(customDays) || Number(customDays) <= 0}
                  onClick={() => grant({ durationDays: Number(customDays) })}
                >
                  {isGrantExtend ? "Add days" : "Grant"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <AlertDialog open={!!revokeTeam} onOpenChange={(o) => !o && setRevokeTeam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Pro access?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{revokeTeam?.teamName}</span> will immediately return to the
              Free plan. You can grant Pro again at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={revoke}
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
