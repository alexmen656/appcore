import { Link, useParams } from "react-router-dom";
import { getModelConfig, type ModelField } from "@/lib/models";
import { useAdminApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  ChevronLeft, Pencil, Building, Users, Settings, Smartphone, Mail,
  UserCheck, Fingerprint, CreditCard, ArrowRight,
} from "lucide-react";

type Rec = Record<string, any>;

function fmtDate(value: unknown): string {
  if (!value) return "—";
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function fmtScalar(value: unknown, field?: ModelField): React.ReactNode {
  if (value === null || value === undefined || value === "")
    return <span className="text-muted-foreground">—</span>;
  if (field?.type === "boolean" || typeof value === "boolean")
    return value ? <Badge variant="default">Yes</Badge> : <Badge variant="secondary">No</Badge>;
  if (field?.type === "date") return fmtDate(value);
  if (field?.type === "enum") return <Badge variant="outline">{String(value)}</Badge>;
  if (typeof value === "object") return <code className="text-xs">{JSON.stringify(value).slice(0, 80)}</code>;
  const str = String(value);
  return str.length > 120 ? str.slice(0, 120) + "…" : str;
}

function EntityLink({
  model, id, label, icon,
}: { model: string; id: string; label: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <Link
      to={`/models/${model}/${id}`}
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-sm hover:bg-accent transition-colors"
    >
      {icon}
      <span className="truncate max-w-[260px]">{label}</span>
    </Link>
  );
}

function RoleBadge({ role }: { role?: string }) {
  if (!role) return null;
  const variant =
    role === "OWNER" || role === "ADMIN" ? "default" : role === "VIEWER" ? "secondary" : "outline";
  return <Badge variant={variant}>{role}</Badge>;
}

function FieldGrid({ record, fields }: { record: Rec; fields: ModelField[] }) {
  return (
    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.name} className="flex flex-col gap-0.5">
          <dt className="text-xs font-medium text-muted-foreground">{f.display}</dt>
          <dd className="text-sm break-words">{fmtScalar(record[f.name], f)}</dd>
        </div>
      ))}
    </dl>
  );
}

function UserChip({ user }: { user?: Rec }) {
  if (!user) return <span className="text-muted-foreground">—</span>;
  return (
    <EntityLink
      model="user"
      id={user.id}
      label={user.name ? `${user.name} · ${user.email}` : user.email}
      icon={<Users className="h-3.5 w-3.5 text-blue-600" />}
    />
  );
}

function AppChip({ app }: { app: Rec }) {
  return (
    <EntityLink
      model="app"
      id={app.id}
      label={
        <span className="flex items-center gap-1">
          {app.name}
          {app.isOwnApp && <Badge variant="secondary" className="ml-1">own</Badge>}
        </span>
      }
      icon={<Smartphone className="h-3.5 w-3.5 text-green-600" />}
    />
  );
}

function TeamPanel({ team }: { team: Rec }) {
  const members: Rec[] = team.members ?? [];
  const apps: Rec[] = team.apps ?? [];
  const settings: Rec | null = team.settings ?? null;
  const sub: Rec | null = team.subscription ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <EntityLink
          model="team"
          id={team.id}
          label={<span className="font-semibold">{team.name}</span>}
          icon={<Building className="h-4 w-4 text-purple-600" />}
        />
        <Badge variant="outline">{members.length} Member</Badge>
        <Badge variant="outline">{apps.length} Apps</Badge>
        {sub && <Badge variant="default">{sub.status}</Badge>}
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Settings className="h-3.5 w-3.5" /> Team Settings
        </div>
        {settings ? (
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant={settings.mcpEnabled ? "default" : "secondary"}>
              MCP {settings.mcpEnabled ? "enabled" : "disabled"}
            </Badge>
            <Badge variant={settings.ascIssuerId ? "default" : "secondary"}>
              ASC {settings.ascIssuerId ? "connected" : "missing"}
            </Badge>
            <Badge variant={settings.githubUsername ? "default" : "secondary"}>
              GitHub {settings.githubUsername ? `@${settings.githubUsername}` : "missing"}
            </Badge>
            <EntityLink
              model="teamSettings"
              id={settings.id}
              label="Settings öffnen"
              icon={<ArrowRight className="h-3.5 w-3.5" />}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No Settings defined.</p>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> Members
        </div>
        {members.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="w-28">Role</TableHead>
                <TableHead className="w-44">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell><UserChip user={m.user} /></TableCell>
                  <TableCell><RoleBadge role={m.role} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtDate(m.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No Members.</p>
        )}
      </div>

      {apps.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Smartphone className="h-3.5 w-3.5" /> Apps
          </div>
          <div className="flex flex-wrap gap-2">
            {apps.map((a) => <AppChip key={a.id} app={a} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function GenericRelations({ record, scalarNames }: { record: Rec; scalarNames: Set<string> }) {
  const relationEntries = Object.entries(record).filter(
    ([k, v]) => !scalarNames.has(k) && v !== null && typeof v === "object",
  );
  if (relationEntries.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Linked Data</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="text-xs overflow-x-auto rounded-md bg-muted p-3">
          {JSON.stringify(Object.fromEntries(relationEntries), null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}

export default function RecordDetail() {
  const { model: modelPath, id } = useParams<{ model: string; id: string }>();
  const config = getModelConfig(modelPath ?? "");
  const { data: record, loading } = useAdminApi<Rec>(`/detail/${modelPath}/${id}`);

  if (!config) {
    return <div className="p-8 text-center text-muted-foreground">Model not found</div>;
  }

  const title = record
    ? String(record[config.displayField] ?? record.id ?? id)
    : "…";
  const scalarFields = config.fields.filter((f) => !f.hidden);
  const scalarNames = new Set(config.fields.map((f) => f.name));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/models/${modelPath}`}><ChevronLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{config.name}</p>
            <h1 className="text-2xl font-bold truncate">{title}</h1>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link to={`/models/${modelPath}?edit=${id}`}>
            <Pencil className="h-4 w-4 mr-2" /> Edit
          </Link>
        </Button>
      </div>

      {loading || !record ? (
        <div className="py-12 text-center text-muted-foreground">
          {loading ? "Lade…" : "Eintrag nicht gefunden"}
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Basic Info</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGrid record={record} fields={scalarFields} />
            </CardContent>
          </Card>

          {modelPath === "user" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building className="h-4 w-4 text-purple-600" />
                  Teams ({record.teamMembers?.length ?? 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {(record.teamMembers ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">This user does not belong to any team.</p>
                )}
                {(record.teamMembers ?? []).map((tm: Rec, i: number) => (
                  <div key={tm.id} className={i > 0 ? "border-t pt-6" : ""}>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Role in this Team:
                      </span>
                      <RoleBadge role={tm.role} />
                    </div>
                    {tm.team ? <TeamPanel team={tm.team} /> : (
                      <p className="text-sm text-muted-foreground">Team not found.</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {modelPath === "user" && (record.passkeys ?? []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Fingerprint className="h-4 w-4 text-teal-600" />
                  Passkeys ({record.passkeys.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {record.passkeys.map((p: Rec) => (
                    <Badge key={p.id} variant="outline">
                      {p.name || p.deviceType || "Passkey"}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {modelPath === "team" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building className="h-4 w-4 text-purple-600" /> Team Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TeamPanel team={record} />
              </CardContent>
            </Card>
          )}

          {modelPath === "team" && (record.invites ?? []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mail className="h-4 w-4 text-orange-600" />
                  Invitations ({record.invites.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead className="w-28">Role</TableHead>
                      <TableHead className="w-32">Status</TableHead>
                      <TableHead className="w-44">Expires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {record.invites.map((inv: Rec) => (
                      <TableRow key={inv.id}>
                        <TableCell className="text-sm">{inv.email}</TableCell>
                        <TableCell><RoleBadge role={inv.role} /></TableCell>
                        <TableCell>
                          {inv.acceptedAt
                            ? <Badge variant="default">accepted</Badge>
                            : <Badge variant="secondary">pending</Badge>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{fmtDate(inv.expiresAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {modelPath === "teamMember" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserCheck className="h-4 w-4 text-blue-600" /> Connection
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <UserChip user={record.user} />
                  <RoleBadge role={record.role} />
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  {record.team && (
                    <EntityLink
                      model="team"
                      id={record.team.id}
                      label={record.team.name}
                      icon={<Building className="h-3.5 w-3.5 text-purple-600" />}
                    />
                  )}
                </div>
                {record.team && <div className="border-t pt-4"><TeamPanel team={record.team} /></div>}
              </CardContent>
            </Card>
          )}

          {modelPath === "teamSettings" && record.team && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building className="h-4 w-4 text-purple-600" /> Linked Overview
                </CardTitle>
              </CardHeader>
              <CardContent><TeamPanel team={record.team} /></CardContent>
            </Card>
          )}

          {modelPath === "app" && record.team && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building className="h-4 w-4 text-purple-600" /> Team Overview
                </CardTitle>
              </CardHeader>
              <CardContent><TeamPanel team={record.team} /></CardContent>
            </Card>
          )}

          {modelPath === "team" && record.subscription && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="h-4 w-4 text-emerald-600" /> Subscription
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 text-sm">
                  <Badge variant="default">{record.subscription.status}</Badge>
                  {record.subscription.interval && <Badge variant="outline">{record.subscription.interval}</Badge>}
                  {record.subscription.renewsAt && (
                    <span className="text-muted-foreground">renewed {fmtDate(record.subscription.renewsAt)}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {!["user", "team", "teamMember", "teamSettings", "app"].includes(modelPath ?? "") && (
            <GenericRelations record={record} scalarNames={scalarNames} />
          )}
        </>
      )}
    </div>
  );
}
