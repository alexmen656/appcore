import { useState } from "react";
import { setToken } from "../hooks/useApi";
import AuthHeader from "./comps/login/AuthHeader";
import type { AuthUser } from "../types";
import { inputCls, btnPrimary } from "../styles";

export type { AuthUser };

interface Props {
  onAuth: (user: AuthUser) => void;
}

export default function Login({ onAuth }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint =
        mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body: Record<string, string> = { email, password };
      if (mode === "register" && name) body.name = name;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setToken(data.token);
      onAuth(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
            <span className="text-sm font-medium text-[#111827]">Email</span>
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
            <span className="text-sm font-medium text-[#111827]">Password</span>
            <input
              className={inputCls}
              type="password"
              placeholder="••••••••"
              value={password}
              required
              minLength={8}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
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
            {loading
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>
        <div className="mt-5 text-center text-sm text-[#9ca3af] dark:text-[#5c6478]">
          {mode === "login" ? (
            <>
              No account yet?{" "}
              <button
                className="text-[#ea0e2b] font-medium hover:underline"
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
              >
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                className="text-[#ea0e2b] font-medium hover:underline"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
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
