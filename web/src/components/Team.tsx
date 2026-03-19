import { useState, useEffect, useCallback } from "react";
import { authHeaders } from "../hooks/useApi";
import type { AppRole } from "../types";

const ROLE_LABELS: Record<AppRole, string> = {
  OWNER: "Owner",
  EDITOR: "Editor",
  VIEWER: "Viewer",
};

const ROLE_COLORS: Record<AppRole, string> = {
  OWNER: "bg-[#fef2f3] text-[#ea0e2b] dark:bg-[#2a1f23] dark:text-[#f87171]",
  EDITOR: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  VIEWER: "bg-gray-100 text-gray-500 dark:bg-[#252b38] dark:text-[#8b93a5]",
};

interface AppAccess {
  memberId: string;
  appId: string;
  bundleId: string;
  appName: string;
  iconUrl: string | null;
  role: AppRole;
}

interface TeamMemberEntry {
  userId: string;
  email: string;
  name: string | null;
  apps: AppAccess[];
}

interface OwnApp {
  id: string;
  bundleId: string;
  name: string;
  iconUrl: string | null;
}

export default function Team({
  addToast,
  currentUserId,
}: {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
  currentUserId: string;
}) {
  const [members, setMembers] = useState<TeamMemberEntry[]>([]);
  const [ownApps, setOwnApps] = useState<OwnApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteApps, setInviteApps] = useState<Record<string, AppRole>>({});
  const [inviting, setInviting] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [noUserError, setNoUserError] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<AppRole>("VIEWER");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [membersRes, appsRes] = await Promise.all([
        fetch("/api/team", { headers: authHeaders() }),
        fetch("/api/team/apps", { headers: authHeaders() }),
      ]);
      if (membersRes.ok) setMembers(await membersRes.json());
      if (appsRes.ok) setOwnApps(await appsRes.json());
    } catch (err: any) {
      addToast(`Failed to load team: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const assignments = Object.entries(inviteApps).map(([bundleId, role]) => ({
      bundleId,
      role,
    }));
    if (!inviteEmail.trim() || assignments.length === 0) return;
    setInviting(true);
    setNoUserError(false);

    try {
      const res = await fetch("/api/team/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ email: inviteEmail.trim(), assignments }),
      });
      const json = await res.json();

      if (!res.ok) {
        if (json.error === "NO_USER") {
          setNoUserError(true);
          return;
        }
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      addToast(`${inviteEmail} wurde hinzugefügt`, "success");
      setInviteEmail("");
      setInviteApps({});
      setShowInvite(false);
      load();
    } catch (err: any) {
      addToast(`Fehler: ${err.message}`, "error");
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async (memberId: string) => {
    try {
      const res = await fetch(`/api/team/members/${memberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ role: editRole }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error);
      }
      setEditingMemberId(null);
      load();
      addToast("Rolle aktualisiert", "success");
    } catch (err: any) {
      addToast(`Fehler: ${err.message}`, "error");
    }
  };

  const handleRemoveAccess = async (memberId: string, appName: string) => {
    if (!confirm(`Zugang zu "${appName}" entfernen?`)) return;
    try {
      const res = await fetch(`/api/team/members/${memberId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error);
      }

      addToast("Zugang entfernt", "info");
      load();
    } catch (err: any) {
      addToast(`Fehler: ${err.message}`, "error");
    }
  };

  const toggleInviteApp = (bundleId: string) => {
    setInviteApps((prev) => {
      if (prev[bundleId]) {
        const next = { ...prev };
        delete next[bundleId];
        return next;
      }
      return { ...prev, [bundleId]: "VIEWER" };
    });
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#1a1a2e] dark:text-[#e8eaf0]">
            Team
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#8b93a5] mt-0.5">
            Steuere wer Zugang zu deinen Apps hat und welche Rechte sie haben.
          </p>
        </div>
        <button
          onClick={() => {
            setShowInvite(true);
            setNoUserError(false);
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
          Mitglied hinzufügen
        </button>
      </div>

      {showInvite && (
        <form
          onSubmit={handleInvite}
          className="mb-6 p-4 bg-[#f7f8fa] dark:bg-[#1c2028] border border-[#e5e7eb] dark:border-[#2a2f3d] rounded-xl flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#5c6478]">
              Mitglied hinzufügen
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

          <div>
            <label className="text-xs font-medium text-[#374151] dark:text-[#8b93a5] mb-1 block">
              E-Mail
            </label>
            <input
              type="email"
              placeholder="name@example.com"
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.target.value);
                setNoUserError(false);
              }}
              required
              className="w-full px-3 py-2 text-sm rounded-lg border border-[#e5e7eb] dark:border-[#2a2f3d] bg-white dark:bg-[#252b38] text-[#111827] dark:text-[#e8eaf0] focus:outline-none focus:border-[#ea0e2b]"
            />
            {noUserError && (
              <p className="mt-1.5 text-xs text-[#ea0e2b]">
                Kein Nutzer mit dieser E-Mail gefunden. Der Nutzer muss sich
                zuerst registrieren.
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-[#374151] dark:text-[#8b93a5] mb-2 block">
              App-Zugang
            </label>
            {ownApps.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-[#5c6478]">
                Keine Apps gefunden
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {ownApps.map((app) => {
                  const selected = !!inviteApps[app.bundleId];
                  const role = inviteApps[app.bundleId];
                  return (
                    <div
                      key={app.bundleId}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${selected ? "border-[#ea0e2b] bg-[#fef2f3] dark:bg-[#2a1f23]" : "border-[#e5e7eb] dark:border-[#2a2f3d] bg-white dark:bg-[#252b38] hover:border-gray-300 dark:hover:border-[#3a4050]"}`}
                      onClick={() => toggleInviteApp(app.bundleId)}
                    >
                      {app.iconUrl ? (
                        <img
                          src={app.iconUrl}
                          alt=""
                          className="w-7 h-7 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-[#ea0e2b] flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {app.name.charAt(0)}
                        </div>
                      )}
                      <span className="flex-1 text-sm font-medium text-[#1a1a2e] dark:text-[#e8eaf0] truncate">
                        {app.name}
                      </span>
                      {selected && (
                        <select
                          value={role}
                          onChange={(e) => {
                            e.stopPropagation();
                            setInviteApps((p) => ({
                              ...p,
                              [app.bundleId]: e.target.value as AppRole,
                            }));
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="px-2 py-1 text-xs rounded-lg border border-[#ea0e2b] bg-white dark:bg-[#1c2028] text-[#ea0e2b] font-semibold focus:outline-none"
                        >
                          <option value="VIEWER">Viewer</option>
                          <option value="EDITOR">Editor</option>
                          <option value="OWNER">Owner</option>
                        </select>
                      )}
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? "border-[#ea0e2b] bg-[#ea0e2b]" : "border-gray-300 dark:border-[#3a4050]"}`}
                      >
                        {selected && (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="white"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-2.5 h-2.5"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={
                inviting ||
                !inviteEmail.trim() ||
                Object.keys(inviteApps).length === 0
              }
              className="flex-1 py-2 rounded-xl bg-[#ea0e2b] text-white text-sm font-semibold hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {inviting ? "Wird hinzugefügt…" : "Hinzufügen"}
            </button>
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="px-4 py-2 rounded-xl border border-[#e5e7eb] dark:border-[#2a2f3d] text-sm text-gray-500 dark:text-[#8b93a5] hover:bg-gray-50 dark:hover:bg-[#252b38] transition-all"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-sm text-gray-400 dark:text-[#5c6478]">
          <div className="spinner" /> Laden…
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#f7f8fa] dark:bg-[#1c2028] flex items-center justify-center mb-3">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6 text-gray-400 dark:text-[#5c6478]"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[#1a1a2e] dark:text-[#e8eaf0]">
            Noch keine Teammitglieder
          </p>
          <p className="text-xs text-gray-400 dark:text-[#5c6478] mt-1">
            Füge Mitglieder hinzu und weise ihnen App-Zugänge zu.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {members.map((member) => (
            <div
              key={member.userId}
              className="bg-white dark:bg-[#1c2028] border border-[#e5e7eb] dark:border-[#2a2f3d] rounded-xl overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[#f3f4f6] dark:border-[#2a2f3d]">
                <div className="w-8 h-8 rounded-full bg-[#ea0e2b] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {(member.name ?? member.email).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#1a1a2e] dark:text-[#e8eaf0] truncate">
                    {member.name ?? member.email}
                    {member.userId === currentUserId && (
                      <span className="ml-1.5 text-[10px] font-normal text-gray-400 dark:text-[#5c6478]">
                        (du)
                      </span>
                    )}
                  </div>
                  {member.name && (
                    <div className="text-[11px] text-gray-400 dark:text-[#5c6478]">
                      {member.email}
                    </div>
                  )}
                </div>
              </div>

              <div className="divide-y divide-[#f3f4f6] dark:divide-[#2a2f3d]">
                {member.apps.map((access) => {
                  const isEditing = editingMemberId === access.memberId;
                  return (
                    <div
                      key={access.memberId}
                      className="flex items-center gap-3 px-4 py-2.5"
                    >
                      {access.iconUrl ? (
                        <img
                          src={access.iconUrl}
                          alt=""
                          className="w-6 h-6 rounded-md object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-md bg-[#ea0e2b] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                          {access.appName.charAt(0)}
                        </div>
                      )}
                      <span className="flex-1 text-[13px] text-[#1a1a2e] dark:text-[#e8eaf0] truncate">
                        {access.appName}
                      </span>

                      {isEditing ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <select
                            value={editRole}
                            onChange={(e) =>
                              setEditRole(e.target.value as AppRole)
                            }
                            className="px-2 py-1 text-xs rounded-lg border border-[#e5e7eb] dark:border-[#2a2f3d] bg-white dark:bg-[#252b38] text-[#111827] dark:text-[#e8eaf0] focus:outline-none focus:border-[#ea0e2b]"
                          >
                            <option value="VIEWER">Viewer</option>
                            <option value="EDITOR">Editor</option>
                            <option value="OWNER">Owner</option>
                          </select>
                          <button
                            onClick={() => handleUpdateRole(access.memberId)}
                            className="px-2 py-1 rounded-lg bg-[#ea0e2b] text-white text-xs font-semibold hover:bg-[#c80b24] transition-all"
                          >
                            Speichern
                          </button>
                          <button
                            onClick={() => setEditingMemberId(null)}
                            className="px-2 py-1 rounded-lg border border-[#e5e7eb] dark:border-[#2a2f3d] text-xs text-gray-500 dark:text-[#8b93a5] hover:bg-gray-50 dark:hover:bg-[#252b38] transition-all"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[access.role]}`}
                          >
                            {ROLE_LABELS[access.role]}
                          </span>
                          <button
                            onClick={() => {
                              setEditingMemberId(access.memberId);
                              setEditRole(access.role);
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
                          <button
                            onClick={() =>
                              handleRemoveAccess(
                                access.memberId,
                                access.appName,
                              )
                            }
                            className="p-1 rounded-lg text-gray-400 dark:text-[#5c6478] hover:text-red-500 hover:bg-red-50 dark:hover:bg-[#2a1f23] transition-all"
                            title="Zugang entfernen"
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
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 grid grid-cols-3 gap-3">
        {(["OWNER", "EDITOR", "VIEWER"] as AppRole[]).map((r) => (
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
              {r === "OWNER" && "Voller Zugriff. Kann Team verwalten."}
              {r === "EDITOR" && "Kann Metadata & Vorschläge bearbeiten."}
              {r === "VIEWER" && "Nur lesen, keine Änderungen möglich."}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
