import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getModelConfig, type ModelField } from "@/lib/models";
import { useAdminApi, adminCreate, adminUpdate, adminDelete, apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Eye, ChevronLeft, ChevronRight } from "lucide-react";

interface PaginatedResponse {
  data: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

function formatValue(value: unknown, field: ModelField): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  if (field.type === "boolean") return value ? <Badge variant="default">Yes</Badge> : <Badge variant="secondary">No</Badge>;
  if (field.type === "date") {
    const d = new Date(value as string);
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  if (field.type === "enum") return <Badge variant="outline">{String(value)}</Badge>;
  if (field.type === "json") return <code className="text-xs">{JSON.stringify(value).slice(0, 50)}…</code>;
  const str = String(value);
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
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {field.type === "boolean" ? (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={field.name}
                checked={Boolean(formData[field.name])}
                onChange={(e) => setFormData({ ...formData, [field.name]: e.target.checked })}
                className="h-4 w-4"
              />
              <span className="text-sm text-muted-foreground">{formData[field.name] ? "Yes" : "No"}</span>
            </div>
          ) : field.type === "enum" ? (
            <select
              id={field.name}
              value={String(formData[field.name] ?? "")}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">—</option>
              {field.enumValues?.map((v) => (
                <option key={v} value={v}>{v}</option>
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
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit" disabled={saving}>{saving ? "Speichern…" : "Speichern"}</Button>
      </div>
    </form>
  );
}

export default function ModelCrud() {
  const { model: modelPath } = useParams<{ model: string }>();
  const config = getModelConfig(modelPath ?? "");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editRecord, setEditRecord] = useState<Record<string, unknown> | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const queryParams = `?page=${page}&pageSize=25${search ? `&search=${encodeURIComponent(search)}` : ""}`;
  const { data, loading, refetch } = useAdminApi<PaginatedResponse>(`/${modelPath}${queryParams}`);

  const editId = searchParams.get("edit");
  useEffect(() => {
    if (!editId || !modelPath) return;
    apiFetch<Record<string, unknown>>(`/${modelPath}/${editId}`)
      .then(setEditRecord)
      .catch(() => { })
      .finally(() => {
        searchParams.delete("edit");
        setSearchParams(searchParams, { replace: true });
      });
  }, [editId, modelPath]);

  if (!config) {
    return <div className="p-8 text-center text-muted-foreground">Model not found</div>;
  }

  const visibleFields = config.fields.filter((f) => !f.hidden);
  const totalPages = data ? Math.ceil(data.total / 25) : 0;

  const handleCreate = async (formData: Record<string, unknown>) => {
    await adminCreate(config.apiPath, formData);
    setCreateOpen(false);
    refetch();
  };

  const handleUpdate = async (formData: Record<string, unknown>) => {
    if (!editRecord) return;
    await adminUpdate(config.apiPath, editRecord.id as string, formData);
    setEditRecord(null);
    refetch();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await adminDelete(config.apiPath, deleteId);
    setDeleteId(null);
    refetch();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{config.plural}</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Erstellen
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {data ? `${data.total} Einträge` : "Lade…"}
            </CardTitle>
            <Input
              placeholder="Suchen…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-64"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Lade Daten…</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleFields.map((f) => (
                      <TableHead key={f.name}>{f.display}</TableHead>
                    ))}
                    <TableHead className="w-32">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.data.map((record) => (
                    <TableRow key={record.id as string}>
                      {visibleFields.map((f) => (
                        <TableCell key={f.name}>{formatValue(record[f.name], f)}</TableCell>
                      ))}
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/models/${modelPath}/${record.id as string}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setEditRecord(record)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(record.id as string)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data?.data.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={visibleFields.length + 1} className="text-center text-muted-foreground py-8">
                        Keine Einträge gefunden
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-muted-foreground">
                    Seite {page} von {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{config.name} erstellen</DialogTitle>
            <DialogDescription>Neuen {config.name} Eintrag erstellen.</DialogDescription>
          </DialogHeader>
          <RecordForm fields={config.fields} onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRecord} onOpenChange={(open) => !open && setEditRecord(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{config.name} bearbeiten</DialogTitle>
            <DialogDescription>Eintrag bearbeiten.</DialogDescription>
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
            <AlertDialogTitle>Eintrag löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Soll dieser Eintrag wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
