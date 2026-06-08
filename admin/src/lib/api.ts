import { useState, useEffect, useCallback } from "react";

const API_BASE = "/api/admin";

export async function login(email: string, password: string): Promise<void> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Login fehlgeschlagen");
  }
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => { });
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    window.location.reload();
    throw new Error("Session abgelaufen");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export function useAdminApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch<T>(path)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [path]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export async function adminCreate<T>(model: string, data: Record<string, unknown>): Promise<T> {
  return apiFetch<T>(`/${model}`, { method: "POST", body: JSON.stringify(data) });
}

export async function adminUpdate<T>(model: string, id: string, data: Record<string, unknown>): Promise<T> {
  return apiFetch<T>(`/${model}/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function adminDelete(model: string, id: string): Promise<void> {
  await apiFetch(`/${model}/${id}`, { method: "DELETE" });
}
