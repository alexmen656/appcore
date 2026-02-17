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

      setToken(data.token);
      onAuth(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <img src="/logo.png" alt="AppCore" style={{ height: 36, borderRadius: 8 }} />
          <div>
            <div style={styles.appName}>AppCore</div>
            <div style={styles.appSub}>ASO Engine by Fringelo</div>
          </div>
        </div>

        <h2 style={styles.title}>
          {mode === "login" ? "Sign in to your account" : "Create an account"}
        </h2>

        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === "register" && (
            <label style={styles.label}>
              Name
              <input
                style={styles.input}
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </label>
          )}
          <label style={styles.label}>
            Email
            <input
              style={styles.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label style={styles.label}>
            Password
            <input
              style={styles.input}
              type="password"
              placeholder="••••••••"
              value={password}
              required
              minLength={8}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>

          {error && <div style={styles.error}>{error}</div>}

          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div style={styles.switchRow}>
          {mode === "login" ? (
            <>
              No account yet?{" "}
              <button style={styles.link} onClick={() => { setMode("register"); setError(null); }}>
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button style={styles.link} onClick={() => { setMode("login"); setError(null); }}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg, #0f1117)",
  },
  card: {
    background: "var(--surface, #1a1d27)",
    border: "1px solid var(--border, #2a2d3a)",
    borderRadius: 16,
    padding: "40px 36px",
    width: 380,
    boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 28,
  },
  appName: {
    fontWeight: 700,
    fontSize: 18,
    color: "var(--text, #e8eaf0)",
  },
  appSub: {
    fontSize: 12,
    color: "var(--text-muted, #8b8fa8)",
  },
  title: {
    margin: "0 0 24px",
    fontSize: 20,
    fontWeight: 600,
    color: "var(--text, #e8eaf0)",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 13,
    color: "var(--text-muted, #8b8fa8)",
    fontWeight: 500,
  },
  input: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid var(--border, #2a2d3a)",
    background: "var(--bg, #0f1117)",
    color: "var(--text, #e8eaf0)",
    fontSize: 14,
    outline: "none",
  },
  error: {
    background: "rgba(220,53,69,0.12)",
    border: "1px solid rgba(220,53,69,0.3)",
    borderRadius: 8,
    padding: "10px 12px",
    color: "#f56565",
    fontSize: 13,
  },
  btn: {
    padding: "11px 0",
    borderRadius: 8,
    border: "none",
    background: "var(--accent, #6c63ff)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 4,
  },
  switchRow: {
    marginTop: 20,
    textAlign: "center",
    fontSize: 13,
    color: "var(--text-muted, #8b8fa8)",
  },
  link: {
    background: "none",
    border: "none",
    color: "var(--accent, #6c63ff)",
    cursor: "pointer",
    fontSize: 13,
    padding: 0,
    fontWeight: 500,
  },
};
