import { useState } from "react";
import { setToken } from "../hooks/useApi";

interface Props {
  onAuth: (user: AuthUser) => void;
}
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
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
    <div className="min-h-screen flex items-center justify-center bg-[#eff3f6]">
      <div className="w-[400px] bg-white rounded-2xl shadow-xl border border-gray-200 p-10">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <img
            src="/logo.png"
            alt="AppCore"
            className="h-10 w-10 rounded-xl object-cover"
          />
          <div>
            <div className="text-xl font-bold text-[#ea0e2b] leading-tight">
              AppCore
            </div>
            <div className="text-xs text-gray-400">ASO Engine by Fringelo</div>
          </div>
        </div>

        <h2 className="text-[22px] font-bold text-[#1a1a2e] mb-6 tracking-tight">
          {mode === "login" ? "Sign in to your account" : "Create an account"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === "register" && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#1a1a2e]">Name</span>
              <input
                className="settings-input"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#1a1a2e]">Email</span>
            <input
              className="settings-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#1a1a2e]">Password</span>
            <input
              className="settings-input"
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
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center mt-1"
          >
            {loading
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-gray-500">
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
