import { useState } from "react";
import { setToken } from "../hooks/useApi";
import AuthHeader from "./comps/login/AuthHeader";
import type { AuthUser } from "../types";
import { inputCls, btnPrimary } from "../styles";

export type { AuthUser };

interface Props {
  onAuth: (user: AuthUser) => void;
}

async function passkeySignIn(email: string): Promise<{ token: string; user: AuthUser }> {
  const { startAuthentication } = await import("@simplewebauthn/browser");

  const optRes = await fetch("/api/auth/passkey/login-options", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email || undefined }),
  });
  const optData = await optRes.json();
  if (!optRes.ok) throw new Error(optData.error ?? "Failed to start passkey auth");

  const assertion = await startAuthentication({ optionsJSON: optData.options });

  const verifyRes = await fetch("/api/auth/passkey/login-verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: optData.sessionId, assertionResponse: assertion }),
  });
  const verifyData = await verifyRes.json();
  if (!verifyRes.ok) throw new Error(verifyData.error ?? "Passkey verification failed");

  return verifyData;
}

async function passkeyRegister(token: string): Promise<void> {
  const { startRegistration } = await import("@simplewebauthn/browser");

  const optRes = await fetch("/api/auth/passkey/register-options", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  const optData = await optRes.json();
  if (!optRes.ok) throw new Error(optData.error ?? "Failed to start passkey registration");

  const attestation = await startRegistration({ optionsJSON: optData.options });

  const verifyRes = await fetch("/api/auth/passkey/register-verify", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ registrationResponse: attestation }),
  });
  const verifyData = await verifyRes.json();
  if (!verifyRes.ok) throw new Error(verifyData.error ?? "Passkey registration failed");
}

export default function Login({ onAuth }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAuth, setPendingAuth] = useState<{ token: string; user: AuthUser } | null>(null);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  const finishAuth = (token: string, user: AuthUser) => {
    setToken(token);
    onAuth(user);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body: Record<string, string> = { email, password };
      if (mode === "register" && name) body.name = name;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (mode === "register") {
        localStorage.setItem("marteso_onboarding", "1");
      }

      setPendingAuth({ token: data.token, user: data.user });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await passkeySignIn(email);
      finishAuth(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPasskey = async () => {
    if (!pendingAuth) return;
    setPasskeyError(null);
    setPasskeyLoading(true);
    try {
      await passkeyRegister(pendingAuth.token);
      finishAuth(pendingAuth.token, pendingAuth.user);
    } catch (err: any) {
      setPasskeyError(err.message);
    } finally {
      setPasskeyLoading(false);
    }
  };

  if (pendingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb] dark:bg-[#0f1117]">
        <div className="w-[400px] bg-white dark:bg-[#1c2028] rounded-2xl shadow-xl border border-[#eef0f3] dark:border-[#2a2f3d] p-10">
          <div className="flex flex-col items-center text-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-[#fff0f2] dark:bg-[#2a1520] flex items-center justify-center">
              <PasskeyIcon className="text-[#ea0e2b]" size={24} />
            </div>
            <h2 className="text-lg font-semibold text-[#111827] dark:text-[#e8eaf0]">
              Add a Passkey?
            </h2>
            <p className="text-sm text-[#6b7280] dark:text-[#8b9ab0] leading-relaxed">
              Sign in faster next time using Face ID, Touch ID, or your device PIN — no password needed.
            </p>
          </div>

          {passkeyError && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-2.5 mb-4">
              {passkeyError}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={handleAddPasskey}
              disabled={passkeyLoading}
              className={`${btnPrimary} w-full justify-center`}
            >
              {passkeyLoading ? "Setting up…" : "Set up Passkey"}
            </button>
            <button
              onClick={() => finishAuth(pendingAuth.token, pendingAuth.user)}
              disabled={passkeyLoading}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-[#6b7280] dark:text-[#8b9ab0] hover:bg-[#f8f9fb] dark:hover:bg-[#252b38] transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb] dark:bg-[#0f1117]">
      <div className="w-[400px] bg-white dark:bg-[#1c2028] rounded-2xl shadow-xl border border-[#eef0f3] dark:border-[#2a2f3d] p-10">
        <AuthHeader mode={mode} />
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === "register" && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#111827] dark:text-[#e8eaf0]">Name</span>
              <input
                className={inputCls}
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </label>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#111827] dark:text-[#e8eaf0]">Email</span>
            <input
              className={inputCls}
              type="email"
              placeholder="you@example.com"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#111827] dark:text-[#e8eaf0]">Password</span>
            <input
              className={inputCls}
              type="password"
              placeholder="••••••••"
              value={password}
              required
              minLength={8}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className={`${btnPrimary} w-full justify-center mt-1`}
          >
            {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        {mode === "login" && (
          <>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-[#eef0f3] dark:bg-[#2a2f3d]" />
              <span className="text-xs text-[#9ca3af] dark:text-[#5c6478]">or</span>
              <div className="flex-1 h-px bg-[#eef0f3] dark:bg-[#2a2f3d]" />
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={handlePasskeyLogin}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-[#eef0f3] dark:border-[#2a2f3d] bg-white dark:bg-[#1c2028] text-sm font-medium text-[#111827] dark:text-[#e8eaf0] hover:bg-[#f8f9fb] dark:hover:bg-[#252b38] transition-colors disabled:opacity-50"
            >
              <PasskeyIcon />
              Sign in with Passkey
            </button>
          </>
        )}

        <div className="mt-5 text-center text-sm text-[#9ca3af] dark:text-[#5c6478]">
          {mode === "login" ? (
            <>
              No account yet?{" "}
              <button
                className="text-[#ea0e2b] font-medium hover:underline"
                onClick={() => { setMode("register"); setError(null); }}
              >
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                className="text-[#ea0e2b] font-medium hover:underline"
                onClick={() => { setMode("login"); setError(null); }}
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PasskeyIcon({ className = "text-current", size = 18 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="8" cy="8" r="4" />
      <path d="M14 8h6M17 5v6" />
      <path d="M2 20c0-3 2.7-5 6-5s6 2 6 5" />
    </svg>
  );
}
