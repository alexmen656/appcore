import { useState, useEffect, useCallback } from "react";

const API_BASE = "/api/admin";

export function getToken(): string | null {
  return localStorage.getItem("admin_token");
}

export function setToken(token: string) {
  localStorage.setItem("admin_token", token);
}

export function clearToken() {
  localStorage.removeItem("admin_token");
}

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Login fehlgeschlagen");
  }
  const data = await res.json();
  const token = data.token;
  if (!token) throw new Error("Kein Token erhalten");
  setToken(token);
  return token;
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    clearToken();
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
