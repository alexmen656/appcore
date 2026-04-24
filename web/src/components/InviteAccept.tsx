import { useState, useEffect } from "react";
import { textPrimary } from "../styles";
import { useParams, useNavigate } from "react-router-dom";
import { setToken } from "../hooks/useApi";
import type { AuthUser } from "../types";

interface InviteInfo {
  email: string;
  role: string;
  teamName: string;
  expiresAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

export default function InviteAccept({
  onAuth,
}: {
  onAuth: (u: AuthUser) => void;
}) {
  const { token: routeToken } = useParams<{ token: string }>();
  const hashMatch = window.location.hash.match(/^#\/invite\/([a-f0-9]+)$/);
  const token = routeToken ?? hashMatch?.[1];
  const navigate = useNavigate();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<"register" | "login">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/team/invite/${token}`)
      .then((r) =>
        r.ok
          ? r.json()
          : r.json().then((e: any) => {
              throw new Error(e.error);
            }),
      )
      .then((d: InviteInfo) => {
        setInvite(d);
        setEmail(d.email);
      })
      .catch((e) => setLoadError(e.message));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const endpoint =
        mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const body =
        mode === "register"
          ? { email, password, name, inviteToken: token }
          : { email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);

      let finalToken = json.token;
      let finalUser = json.user;

      if (mode === "login" && token) {
        const acceptRes = await fetch("/api/auth/accept-invite", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${json.token}`,
          },
          body: JSON.stringify({ token }),
        });
        const acceptJson = await acceptRes.json();
        if (!acceptRes.ok)
          throw new Error(acceptJson.error ?? "Failed to accept invite");
        finalToken = acceptJson.token;
        finalUser = { ...json.user, teamId: acceptJson.teamId };
      }

      setToken(finalToken);
      onAuth(finalUser);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb] dark:bg-[#0f1117] px-4">
        <div className="max-w-sm w-full text-center">
          <div className="text-[26px] font-bold text-[#D94412] tracking-[-0.3px] mb-8">
            marteso
          </div>
          <div className="p-6 bg-white dark:bg-[#1c2028] border border-[#e5e7eb] dark:border-[#2a2f3d] rounded-2xl">
            <p className="text-sm font-semibold text-[#1a1a2e] dark:text-[#e8eaf0] mb-1">
              Ungültige Einladung
            </p>
            <p className="text-xs text-gray-400 dark:text-[#5c6478]">
              {loadError}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb] dark:bg-[#0f1117]">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb] dark:bg-[#0f1117] px-4">
      <div className="max-w-sm w-full">
        <div className="text-[26px] font-bold text-[#D94412] tracking-[-0.3px] mb-8 text-center">
          marteso
        </div>

        <div className="mb-4 p-4 bg-[#fef2f3] dark:bg-[#2a1f23] border border-[#D94412]/20 rounded-xl text-center">
          <p className="text-sm font-semibold text-[#1a1a2e] dark:text-[#e8eaf0]">
            Du wurdest eingeladen
          </p>
          <p className="text-sm text-gray-600 dark:text-[#8b93a5] mt-0.5">
            Team <strong className="text-[#D94412]">{invite.teamName}</strong>{" "}
            als{" "}
            <strong className="text-[#D94412]">
              {ROLE_LABELS[invite.role] ?? invite.role}
            </strong>{" "}
            beizutreten
          </p>
        </div>

        <div className="bg-white dark:bg-[#1c2028] border border-[#e5e7eb] dark:border-[#2a2f3d] rounded-2xl p-6">
          <div className="flex rounded-lg bg-[#f7f8fa] dark:bg-[#252b38] p-0.5 mb-5">
            {(["register", "login"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-all ${mode === m ? "bg-white dark:bg-[#1c2028] text-[#1a1a2e] dark:text-[#e8eaf0] shadow-sm" : "text-gray-500 dark:text-[#5c6478]"}`}
              >
                {m === "register" ? "Registrieren" : "Anmelden"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === "register" && (
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`px-3 py-2.5 text-sm rounded-xl border border-[#e5e7eb] dark:border-[#2a2f3d] bg-[#f7f8fa] dark:bg-[#252b38] ${textPrimary} focus:outline-none focus:border-[#D94412]`}
              />
            )}
            <input
              type="email"
              placeholder="E-Mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={`px-3 py-2.5 text-sm rounded-xl border border-[#e5e7eb] dark:border-[#2a2f3d] bg-[#f7f8fa] dark:bg-[#252b38] ${textPrimary} focus:outline-none focus:border-[#D94412]`}
            />
            <input
              type="password"
              placeholder="Passwort"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className={`px-3 py-2.5 text-sm rounded-xl border border-[#e5e7eb] dark:border-[#2a2f3d] bg-[#f7f8fa] dark:bg-[#252b38] ${textPrimary} focus:outline-none focus:border-[#D94412]`}
            />
            {error && <p className="text-xs text-[#D94412]">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="mt-1 py-2.5 rounded-xl bg-[#D94412] text-white text-sm font-semibold hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? "…"
                : mode === "register"
                  ? "Registrieren & Beitreten"
                  : "Anmelden & Beitreten"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
