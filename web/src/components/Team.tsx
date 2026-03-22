import { useState, useEffect, useCallback } from "react";
import { authHeaders } from "../hooks/useApi";

interface AppOption {
  id: string;
  name: string;
  bundleId: string;
}
type TeamRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

const ROLE_LABELS: Record<TeamRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

const ROLE_COLORS: Record<TeamRole, string> = {
  OWNER: "bg-[#fef2f3] text-[#ea0e2b] dark:bg-[#2a1f23] dark:text-[#f87171]",
  ADMIN:
    "bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400",
  MEMBER: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  VIEWER: "bg-gray-100 text-gray-500 dark:bg-[#252b38] dark:text-[#8b93a5]",
};

interface Member {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: TeamRole;
  createdAt: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: TeamRole;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}

interface TeamData {
  team: { id: string; name: string };
  members: Member[];
  pendingInvites: PendingInvite[];
}

export default function Team({
  addToast,
  currentUserId,
}: {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
  currentUserId: string;
}) {
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<TeamRole | null>(null);

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Role edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<TeamRole>("MEMBER");

  // Team name edit
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [savingName, setSavingName] = useState(false);

  // App access
  const [appAccessMemberId, setAppAccessMemberId] = useState<string | null>(
    null,
  );
  const [allApps, setAllApps] = useState<AppOption[]>([]);
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [savingAppAccess, setSavingAppAccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/team", { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d: TeamData = await res.json();
      setData(d);
      const me = d.members.find((m) => m.userId === currentUserId);
      setMyRole(me?.role ?? null);
    } catch (err: any) {
      addToast(`Fehler: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const canManage = myRole === "OWNER" || myRole === "ADMIN";

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      addToast(`Einladung an ${inviteEmail} wurde gesendet`, "success");
      setInviteEmail("");
      setInviteRole("MEMBER");
      setShowInvite(false);
      load();
    } catch (err: any) {
      setInviteError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string, email: string) => {
    if (!confirm(`Einladung für ${email} widerrufen?`)) return;
    try {
      const res = await fetch(`/api/team/invites/${inviteId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      addToast("Einladung widerrufen", "info");
      load();
    } catch (err: any) {
      addToast(`Fehler: ${err.message}`, "error");
    }
  };

  const handleUpdateRole = async (memberId: string) => {
    try {
      const res = await fetch(`/api/team/members/${memberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ role: editRole }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditingId(null);
      load();
      addToast("Rolle aktualisiert", "success");
    } catch (err: any) {
      addToast(`Fehler: ${err.message}`, "error");
    }
  };

  const handleRemove = async (memberId: string, email: string) => {
    if (!confirm(`${email} aus dem Team entfernen?`)) return;
    try {
      const res = await fetch(`/api/team/members/${memberId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      addToast(`${email} entfernt`, "info");
      load();
    } catch (err: any) {
      addToast(`Fehler: ${err.message}`, "error");
    }
  };

  const handleOpenAppAccess = async (memberId: string) => {
    setAppAccessMemberId(memberId);
    try {
      const [appsRes, accessRes] = await Promise.all([
        fetch("/api/apps", { headers: authHeaders() }),
        fetch(`/api/team/members/${memberId}/apps`, { headers: authHeaders() }),
      ]);
      const apps: AppOption[] = (await appsRes.json()).filter(
        (a: any) => a.isOwnApp,
      );
      const { appIds } = await accessRes.json();
      setAllApps(apps);
      setSelectedAppIds(appIds);
    } catch (err: any) {
      addToast(`Fehler: ${err.message}`, "error");
    }
  };

  const handleSaveAppAccess = async (memberId: string) => {
    setSavingAppAccess(true);
    try {
      const res = await fetch(`/api/team/members/${memberId}/apps`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ appIds: selectedAppIds }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      addToast("App-Zugriff gespeichert", "success");
      setAppAccessMemberId(null);
    } catch (err: any) {
      addToast(`Fehler: ${err.message}`, "error");
    } finally {
      setSavingAppAccess(false);
    }
  };

  const handleSaveName = async () => {
    if (!nameValue.trim()) return;
    setSavingName(true);
    try {
      const res = await fetch("/api/team", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name: nameValue.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditingName(false);
      load();
      addToast("Teamname aktualisiert", "success");
    } catch (err: any) {
      addToast(`Fehler: ${err.message}`, "error");
    } finally {
      setSavingName(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-sm text-gray-400 dark:text-[#5c6478]">
        <div className="spinner" /> Laden…
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                autoFocus
                className="text-xl font-bold px-2 py-0.5 rounded-lg border border-[#ea0e2b] bg-white dark:bg-[#1c2028] text-[#1a1a2e] dark:text-[#e8eaf0] focus:outline-none"
              />
              <button
                onClick={handleSaveName}
                disabled={savingName}
                className="px-2 py-1 rounded-lg bg-[#ea0e2b] text-white text-xs font-semibold hover:bg-[#c80b24] transition-all disabled:opacity-50"
              >
                {savingName ? "…" : "Speichern"}
              </button>
              <button
                onClick={() => setEditingName(false)}
                className="px-2 py-1 rounded-lg border border-[#e5e7eb] dark:border-[#2a2f3d] text-xs text-gray-500 dark:text-[#8b93a5]"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#1a1a2e] dark:text-[#e8eaf0]">
                {data?.team.name ?? "Team"}
              </h1>
              {canManage && (
                <button
                  onClick={() => {
                    setNameValue(data?.team.name ?? "");
                    setEditingName(true);
                  }}
                  className="p-1 rounded-lg text-gray-400 dark:text-[#5c6478] hover:text-[#1a1a2e] dark:hover:text-[#e8eaf0] hover:bg-gray-100 dark:hover:bg-[#252b38] transition-all"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-3.5 h-3.5"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
        {canManage && (
          <button
            onClick={() => {
              setShowInvite(true);
              setInviteError(null);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#ea0e2b] text-white text-sm font-semibold hover:bg-[#c80b24] transition-all"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3.5 h-3.5"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Mitglied einladen
          </button>
        )}
      </div>

      {showInvite && (
        <form
          onSubmit={handleInvite}
          className="mb-6 p-4 bg-[#f7f8fa] dark:bg-[#1c2028] border border-[#e5e7eb] dark:border-[#2a2f3d] rounded-xl flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#5c6478]">
              Einladung senden
            </p>
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-[#e8eaf0] transition-colors"
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
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="name@example.com"
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.target.value);
                setInviteError(null);
              }}
              required
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-[#e5e7eb] dark:border-[#2a2f3d] bg-white dark:bg-[#252b38] text-[#111827] dark:text-[#e8eaf0] focus:outline-none focus:border-[#ea0e2b]"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as TeamRole)}
              className="px-3 py-2 text-sm rounded-lg border border-[#e5e7eb] dark:border-[#2a2f3d] bg-white dark:bg-[#252b38] text-[#111827] dark:text-[#e8eaf0] focus:outline-none focus:border-[#ea0e2b]"
            >
              <option value="VIEWER">Viewer</option>
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
              <option value="OWNER">Owner</option>
            </select>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="px-4 py-2 rounded-lg bg-[#ea0e2b] text-white text-sm font-semibold hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {inviting ? "…" : "Senden"}
            </button>
          </div>
          {inviteError && (
            <p className="text-xs text-[#ea0e2b]">{inviteError}</p>
          )}
          <p className="text-[11px] text-gray-400 dark:text-[#5c6478]">
            Die Person erhält eine E-Mail mit einem Einladungslink. Sie kann
            sich damit registrieren oder, falls sie schon ein Konto hat, dem
            Team beitreten.
          </p>
        </form>
      )}

      <div className="bg-white dark:bg-[#1c2028] border border-[#e5e7eb] dark:border-[#2a2f3d] rounded-xl overflow-hidden mb-4">
        <div className="px-4 py-2.5 border-b border-[#f3f4f6] dark:border-[#2a2f3d]">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#5c6478]">
            Mitglieder · {data?.members.length ?? 0}
          </p>
        </div>
        <div className="divide-y divide-[#f3f4f6] dark:divide-[#2a2f3d]">
          {(data?.members ?? []).map((m) => {
            const isMe = m.userId === currentUserId;
            const isEditing = editingId === m.id;
            return (
              <div key={m.id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-[#ea0e2b] flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {(m.name ?? m.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#1a1a2e] dark:text-[#e8eaf0] truncate">
                      {m.name ?? m.email}
                      {isMe && (
                        <span className="ml-1.5 text-[10px] font-normal text-gray-400 dark:text-[#5c6478]">
                          (du)
                        </span>
                      )}
                    </div>
                    {m.name && (
                      <div className="text-[11px] text-gray-400 dark:text-[#5c6478] truncate">
                        {m.email}
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        value={editRole}
                        onChange={(e) =>
                          setEditRole(e.target.value as TeamRole)
                        }
                        className="px-2 py-1 text-xs rounded-lg border border-[#e5e7eb] dark:border-[#2a2f3d] bg-white dark:bg-[#252b38] text-[#111827] dark:text-[#e8eaf0] focus:outline-none focus:border-[#ea0e2b]"
                      >
                        <option value="VIEWER">Viewer</option>
                        <option value="MEMBER">Member</option>
                        <option value="ADMIN">Admin</option>
                        <option value="OWNER">Owner</option>
                      </select>
                      <button
                        onClick={() => handleUpdateRole(m.id)}
                        className="px-2 py-1 rounded-lg bg-[#ea0e2b] text-white text-xs font-semibold hover:bg-[#c80b24] transition-all"
                      >
                        Speichern
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2 py-1 rounded-lg border border-[#e5e7eb] dark:border-[#2a2f3d] text-xs text-gray-500 dark:text-[#8b93a5]"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[m.role]}`}
                      >
                        {ROLE_LABELS[m.role]}
                      </span>
                      {canManage && !isMe && (
                        <>
                          <button
                            onClick={() => {
                              setEditingId(m.id);
                              setEditRole(m.role);
                            }}
                            className="p-1 rounded-lg text-gray-400 dark:text-[#5c6478] hover:text-[#1a1a2e] dark:hover:text-[#e8eaf0] hover:bg-gray-100 dark:hover:bg-[#252b38] transition-all"
                            title="Rolle ändern"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="w-3.5 h-3.5"
                            >
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          {(m.role === "MEMBER" || m.role === "VIEWER") && (
                            <button
                              onClick={() =>
                                appAccessMemberId === m.id
                                  ? setAppAccessMemberId(null)
                                  : handleOpenAppAccess(m.id)
                              }
                              className={`p-1 rounded-lg transition-all ${appAccessMemberId === m.id ? "text-[#ea0e2b] bg-[#fef2f3] dark:bg-[#2a1f23]" : "text-gray-400 dark:text-[#5c6478] hover:text-[#1a1a2e] dark:hover:text-[#e8eaf0] hover:bg-gray-100 dark:hover:bg-[#252b38]"}`}
                              title="App-Zugriff verwalten"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="w-3.5 h-3.5"
                              >
                                <rect x="3" y="3" width="7" height="7" rx="1" />
                                <rect
                                  x="14"
                                  y="3"
                                  width="7"
                                  height="7"
                                  rx="1"
                                />
                                <rect
                                  x="3"
                                  y="14"
                                  width="7"
                                  height="7"
                                  rx="1"
                                />
                                <path d="M14 17h7M17 14v7" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => handleRemove(m.id, m.email)}
                            className="p-1 rounded-lg text-gray-400 dark:text-[#5c6478] hover:text-red-500 hover:bg-red-50 dark:hover:bg-[#2a1f23] transition-all"
                            title="Entfernen"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="w-3.5 h-3.5"
                            >
                              <path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {appAccessMemberId === m.id && (
                  <div className="mx-4 mb-3 p-3 bg-[#f7f8fa] dark:bg-[#252b38] border border-[#e5e7eb] dark:border-[#2a2f3d] rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#5c6478]">
                        App-Zugriff
                      </p>
                      <p className="text-[11px] text-gray-400 dark:text-[#5c6478]">
                        {selectedAppIds.length === 0
                          ? "Alle Apps sichtbar"
                          : `${selectedAppIds.length} App${selectedAppIds.length !== 1 ? "s" : ""} ausgewählt`}
                      </p>
                    </div>
                    {allApps.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-[#5c6478]">
                        Keine eigenen Apps vorhanden
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1 mb-3 max-h-48 overflow-y-auto">
                        {allApps.map((app) => (
                          <label
                            key={app.id}
                            className="flex items-center gap-2 cursor-pointer group py-1 px-1 rounded-lg hover:bg-white dark:hover:bg-[#1c2028] transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedAppIds.includes(app.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAppIds((prev) => [
                                    ...prev,
                                    app.id,
                                  ]);
                                } else {
                                  setSelectedAppIds((prev) =>
                                    prev.filter((id) => id !== app.id),
                                  );
                                }
                              }}
                              className="accent-[#ea0e2b] w-3.5 h-3.5 shrink-0"
                            />
                            <span className="text-xs text-[#1a1a2e] dark:text-[#e8eaf0] truncate">
                              {app.name}
                            </span>
                            <span className="text-[10px] text-gray-400 dark:text-[#5c6478] truncate ml-auto">
                              {app.bundleId}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {selectedAppIds.length > 0 && (
                        <button
                          onClick={() => setSelectedAppIds([])}
                          className="text-[11px] text-gray-400 dark:text-[#5c6478] hover:text-[#1a1a2e] dark:hover:text-[#e8eaf0] transition-colors"
                        >
                          Alle abwählen
                        </button>
                      )}
                      <button
                        onClick={() => handleSaveAppAccess(m.id)}
                        disabled={savingAppAccess}
                        className="ml-auto px-3 py-1 rounded-lg bg-[#ea0e2b] text-white text-xs font-semibold hover:bg-[#c80b24] transition-all disabled:opacity-50"
                      >
                        {savingAppAccess ? "…" : "Speichern"}
                      </button>
                      <button
                        onClick={() => setAppAccessMemberId(null)}
                        className="px-3 py-1 rounded-lg border border-[#e5e7eb] dark:border-[#2a2f3d] text-xs text-gray-500 dark:text-[#8b93a5]"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {(data?.pendingInvites ?? []).length > 0 && (
        <div className="bg-white dark:bg-[#1c2028] border border-[#e5e7eb] dark:border-[#2a2f3d] rounded-xl overflow-hidden mb-6">
          <div className="px-4 py-2.5 border-b border-[#f3f4f6] dark:border-[#2a2f3d]">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#5c6478]">
              Ausstehende Einladungen · {data!.pendingInvites.length}
            </p>
          </div>
          <div className="divide-y divide-[#f3f4f6] dark:divide-[#2a2f3d]">
            {data!.pendingInvites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-[#252b38] flex items-center justify-center text-gray-500 dark:text-[#5c6478] text-xs font-bold shrink-0">
                  {inv.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#1a1a2e] dark:text-[#e8eaf0] truncate">
                    {inv.email}
                  </div>
                  <div className="text-[11px] text-gray-400 dark:text-[#5c6478]">
                    Eingeladen von {inv.invitedBy} · läuft ab{" "}
                    {new Date(inv.expiresAt).toLocaleDateString("de")}
                  </div>
                </div>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${ROLE_COLORS[inv.role]}`}
                >
                  {ROLE_LABELS[inv.role]}
                </span>
                {canManage && (
                  <button
                    onClick={() => handleRevokeInvite(inv.id, inv.email)}
                    className="p-1 rounded-lg text-gray-400 dark:text-[#5c6478] hover:text-red-500 hover:bg-red-50 dark:hover:bg-[#2a1f23] transition-all shrink-0"
                    title="Widerrufen"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-3.5 h-3.5"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(["OWNER", "ADMIN", "MEMBER", "VIEWER"] as TeamRole[]).map((r) => (
          <div
            key={r}
            className="p-3 bg-[#f7f8fa] dark:bg-[#1c2028] border border-[#e5e7eb] dark:border-[#2a2f3d] rounded-xl"
          >
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ROLE_COLORS[r]}`}
            >
              {ROLE_LABELS[r]}
            </span>
            <p className="mt-1.5 text-[11px] text-gray-400 dark:text-[#5c6478] leading-snug">
              {r === "OWNER" && "Voller Zugriff + Team verwalten"}
              {r === "ADMIN" && "Mitglieder einladen & verwalten"}
              {r === "MEMBER" && "Alle Features nutzen & bearbeiten"}
              {r === "VIEWER" && "Nur lesen"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
