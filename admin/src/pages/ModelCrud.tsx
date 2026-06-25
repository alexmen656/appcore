import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getModelConfig, type ModelField } from "@/lib/models";
import { useAdminApi, adminCreate, adminUpdate, adminDelete, apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AutoBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
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
  Plus,
  Pencil,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Inbox,
  Search as SearchIcon,
  UserPlus,
} from "lucide-react";

interface PaginatedResponse {
  data: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 25;

function formatValue(value: unknown, field: ModelField): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  if (field.type === "boolean") return <AutoBadge value={value ? "Yes" : "No"} />;
  if (field.type === "date") {
    const d = new Date(value as string);
    return (
      <span className="whitespace-nowrap text-muted-foreground">
        {d.toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    );
  }
  if (field.type === "enum") return <AutoBadge value={String(value)} />;
  if (field.type === "json")
    return <code className="text-xs text-muted-foreground">{JSON.stringify(value).slice(0, 50)}…</code>;
  const str = String(value);
  if (field.name === "id") return <code className="text-xs text-muted-foreground">{str.slice(0, 10)}…</code>;
  return str.length > 60 ? str.slice(0, 60) + "…" : str;
}

function RecordForm({
  fields,
  initial,
  onSubmit,
  onCancel,
}: {
  fields: ModelField[];
  initial?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const editableFields = fields.filter((f) => f.editable !== false && f.name !== "id");
  const [formData, setFormData] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const field of editableFields) {
      init[field.name] = initial?.[field.name] ?? (field.type === "boolean" ? false : "");
    }
    return init;
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cleaned: Record<string, unknown> = {};
      for (const field of editableFields) {
        const val = formData[field.name];
        if (field.type === "number" && val !== "" && val !== null) {
          cleaned[field.name] = Number(val);
        } else if (field.type === "boolean") {
          cleaned[field.name] = Boolean(val);
        } else if (val === "") {
          cleaned[field.name] = null;
        } else {
          cleaned[field.name] = val;
        }
      }
      await onSubmit(cleaned);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {editableFields.map((field) => (
        <div key={field.name} className="space-y-2">
          <Label htmlFor={field.name}>
            {field.display}
            {field.required && <span className="ml-1 text-destructive">*</span>}
          </Label>
          {field.type === "boolean" ? (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                id={field.name}
                checked={Boolean(formData[field.name])}
                onChange={(e) => setFormData({ ...formData, [field.name]: e.target.checked })}
                className="h-4 w-4 accent-[var(--color-brand)]"
              />
              <span className="text-sm text-muted-foreground">{formData[field.name] ? "Yes" : "No"}</span>
            </label>
          ) : field.type === "enum" ? (
            <select
              id={field.name}
              value={String(formData[field.name] ?? "")}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            >
              <option value="">—</option>
              {field.enumValues?.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id={field.name}
              type={field.type === "number" ? "number" : field.type === "date" ? "datetime-local" : "text"}
              value={String(formData[field.name] ?? "")}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              required={field.required}
              step={field.type === "number" ? "any" : undefined}
            />
          )}
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

interface TeamLite {
  id: string;
  name: string;
}

type TeamMode = "personal" | "existing";
type TeamRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

function TeamPicker({
  value,
  onChange,
}: {
  value: TeamLite | null;
  onChange: (team: TeamLite | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TeamLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (value) return;
    const t = setTimeout(() => {
      setLoading(true);
      apiFetch<{ data: TeamLite[] }>(`/team?page=1&pageSize=10${query ? `&search=${encodeURIComponent(query)}` : ""}`)
        .then((r) => setResults(r.data ?? []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [query, value]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-input bg-muted/30 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{value.name}</p>
          <code className="text-xs text-muted-foreground">{value.id}</code>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search teams by name…"
      />
      {open && (
        <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-input bg-popover shadow-md">
          {loading ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">Loading…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">No teams found</div>
          ) : (
            results.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onChange(t);
                  setOpen(false);
                  setQuery("");
                }}
                className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
              >
                <div className="font-medium">{t.name}</div>
                <code className="text-xs text-muted-foreground">{t.id}</code>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function RegisterUserForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: {
    email: string;
    password: string;
    name?: string;
    role: "USER" | "ADMIN";
    teamId?: string;
    teamRole?: TeamRole;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [teamMode, setTeamMode] = useState<TeamMode>("personal");
  const [selectedTeam, setSelectedTeam] = useState<TeamLite | null>(null);
  const [teamRole, setTeamRole] = useState<TeamRole>("MEMBER");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (teamMode === "existing" && !selectedTeam) return;
    setSaving(true);
    try {
      await onSubmit({
        email: email.trim(),
        password,
        name: name.trim() || undefined,
        role,
        ...(teamMode === "existing" && selectedTeam
          ? { teamId: selectedTeam.id, teamRole }
          : {}),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reg-email">
          Email<span className="ml-1 text-destructive">*</span>
        </Label>
        <Input
          id="reg-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-password">
          Password<span className="ml-1 text-destructive">*</span>
        </Label>
        <Input
          id="reg-password"
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
        <p className="text-xs text-muted-foreground">Min 8 characters. Stored as bcrypt hash.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-name">Name</Label>
        <Input
          id="reg-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Defaults to email local-part"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-role">Account Role</Label>
        <select
          id="reg-role"
          value={role}
          onChange={(e) => setRole(e.target.value as "USER" | "ADMIN")}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        >
          <option value="USER">USER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      </div>

      <div className="space-y-2 rounded-md border border-input p-3">
        <Label>Team</Label>
        <div className="flex flex-wrap gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="team-mode"
              checked={teamMode === "personal"}
              onChange={() => setTeamMode("personal")}
              className="h-4 w-4 accent-[var(--color-brand)]"
            />
            New personal team (owner)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="team-mode"
              checked={teamMode === "existing"}
              onChange={() => setTeamMode("existing")}
              className="h-4 w-4 accent-[var(--color-brand)]"
            />
            Add to existing team
          </label>
        </div>
        {teamMode === "existing" && (
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Team</Label>
              <TeamPicker value={selectedTeam} onChange={setSelectedTeam} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reg-team-role" className="text-xs text-muted-foreground">
                Role in team
              </Label>
              <select
                id="reg-team-role"
                value={teamRole}
                onChange={(e) => setTeamRole(e.target.value as TeamRole)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              >
                <option value="OWNER">OWNER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="MEMBER">MEMBER</option>
                <option value="VIEWER">VIEWER</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        Email is marked verified, no confirmation email is sent.
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || (teamMode === "existing" && !selectedTeam)}>
          {saving ? "Registering…" : "Register"}
        </Button>
      </div>
    </form>
  );
}

export default function ModelCrud() {
  const { model: modelPath } = useParams<{ model: string }>();
  const config = getModelConfig(modelPath ?? "");
  const navigate = useNavigate();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ field: string; dir: "asc" | "desc" } | null>(null);
  const [editRecord, setEditRecord] = useState<Record<string, unknown> | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Debounce the search input
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset local state when switching models
  useEffect(() => {
    setSearchInput("");
    setSearch("");
    setSort(null);
    setPage(1);
  }, [modelPath]);

  const queryParams = `?page=${page}&pageSize=${PAGE_SIZE}${search ? `&search=${encodeURIComponent(search)}` : ""}`;
  const { data, loading, refetch } = useAdminApi<PaginatedResponse>(`/${modelPath}${queryParams}`);

  const editId = searchParams.get("edit");
  useEffect(() => {
    if (!editId || !modelPath) return;
    apiFetch<Record<string, unknown>>(`/${modelPath}/${editId}`)
      .then(setEditRecord)
      .catch(() => {})
      .finally(() => {
        searchParams.delete("edit");
        setSearchParams(searchParams, { replace: true });
      });
  }, [editId, modelPath]);

  const visibleFields = useMemo(() => config?.fields.filter((f) => !f.hidden) ?? [], [config]);

  const sortedRows = useMemo(() => {
    const rows = data?.data ?? [];
    if (!sort) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sort.field];
      const bv = b[sort.field];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [data, sort]);

  if (!config) {
    return <div className="p-8 text-center text-muted-foreground">Model not found</div>;
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 0;

  const toggleSort = (field: string) => {
    setSort((prev) => {
      if (!prev || prev.field !== field) return { field, dir: "asc" };
      if (prev.dir === "asc") return { field, dir: "desc" };
      return null;
    });
  };

  const handleCreate = async (formData: Record<string, unknown>) => {
    try {
      await adminCreate(config.apiPath, formData);
      setCreateOpen(false);
      toast.success(`${config.name} created`);
      refetch();
    } catch (e) {
      toast.error("Create failed", e instanceof Error ? e.message : undefined);
      throw e;
    }
  };

  const handleRegisterUser = async (formData: {
    email: string;
    password: string;
    name?: string;
    role: "USER" | "ADMIN";
    teamId?: string;
    teamRole?: TeamRole;
  }) => {
    try {
      await apiFetch("/register-user", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setRegisterOpen(false);
      const where = formData.teamId ? "existing team" : "new personal team";
      toast.success(`Registered ${formData.email} (${where})`);
      refetch();
    } catch (e) {
      toast.error("Registration failed", e instanceof Error ? e.message : undefined);
      throw e;
    }
  };

  const handleUpdate = async (formData: Record<string, unknown>) => {
    if (!editRecord) return;
    try {
      await adminUpdate(config.apiPath, editRecord.id as string, formData);
      setEditRecord(null);
      toast.success(`${config.name} updated`);
      refetch();
    } catch (e) {
      toast.error("Update failed", e instanceof Error ? e.message : undefined);
      throw e;
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await adminDelete(config.apiPath, deleteId);
      toast.success(`${config.name} deleted`);
      setDeleteId(null);
      refetch();
    } catch (e) {
      toast.error("Delete failed", e instanceof Error ? e.message : undefined);
    } finally {
      setDeleting(false);
    }
  };

  const pageNumbers = useMemo(() => {
    if (totalPages <= 1) return [];
    const around = new Set<number>([1, totalPages, page, page - 1, page + 1]);
    return [...around].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  }, [page, totalPages]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{config.plural}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {data ? `${data.total.toLocaleString("en-US")} record${data.total === 1 ? "" : "s"}` : "Loading…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {config.apiPath === "user" && (
            <Button variant="outline" onClick={() => setRegisterOpen(true)}>
              <UserPlus className="mr-1.5 h-4 w-4" />
              Register User
            </Button>
          )}
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New {config.name}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b py-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {sort
                ? `Sorted by ${visibleFields.find((f) => f.name === sort.field)?.display ?? sort.field}`
                : "All records"}
            </CardTitle>
            <div className="relative w-72 max-w-full">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <TableSkeleton rows={10} cols={Math.min(visibleFields.length + 1, 6)} />
            </div>
          ) : sortedRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">No records found</p>
              <p className="text-xs text-muted-foreground">
                {search ? "Try a different search term." : `Create your first ${config.name}.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleFields.map((f) => {
                      const active = sort?.field === f.name;
                      return (
                        <TableHead key={f.name}>
                          <button
                            onClick={() => toggleSort(f.name)}
                            className={`-mx-1 flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-foreground ${active ? "text-brand" : ""}`}
                          >
                            {f.display}
                            {active ? (
                              sort!.dir === "asc" ? (
                                <ArrowUp className="h-3 w-3" />
                              ) : (
                                <ArrowDown className="h-3 w-3" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-30" />
                            )}
                          </button>
                        </TableHead>
                      );
                    })}
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map((record) => (
                    <TableRow
                      key={record.id as string}
                      className="cursor-pointer"
                      onClick={() => navigate(`/models/${modelPath}/${record.id as string}`)}
                    >
                      {visibleFields.map((f) => (
                        <TableCell key={f.name}>{formatValue(record[f.name], f)}</TableCell>
                      ))}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-0.5">
                          <Button variant="ghost" size="icon" asChild title="View">
                            <Link to={`/models/${modelPath}/${record.id as string}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" title="Edit" onClick={() => setEditRecord(record)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete"
                            onClick={() => setDeleteId(record.id as string)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {pageNumbers.map((n, i) => {
                  const prev = pageNumbers[i - 1];
                  const gap = prev !== undefined && n - prev > 1;
                  return (
                    <span key={n} className="flex items-center">
                      {gap && <span className="px-1 text-muted-foreground">…</span>}
                      <Button
                        variant={n === page ? "default" : "outline"}
                        size="icon"
                        onClick={() => setPage(n)}
                        className="h-9 w-9"
                      >
                        {n}
                      </Button>
                    </span>
                  );
                })}
                <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create {config.name}</DialogTitle>
            <DialogDescription>Create a new {config.name} record.</DialogDescription>
          </DialogHeader>
          <RecordForm fields={config.fields} onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register User</DialogTitle>
            <DialogDescription>
              Create a fully provisioned account, just like normal signup, but skip email verification.
            </DialogDescription>
          </DialogHeader>
          <RegisterUserForm onSubmit={handleRegisterUser} onCancel={() => setRegisterOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRecord} onOpenChange={(open) => !open && setEditRecord(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {config.name}</DialogTitle>
            <DialogDescription>Update this record's fields.</DialogDescription>
          </DialogHeader>
          {editRecord && (
            <RecordForm
              fields={config.fields}
              initial={editRecord}
              onSubmit={handleUpdate}
              onCancel={() => setEditRecord(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete record?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {config.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
