import { useState, useEffect, useCallback } from "react";
const BASE = "/api";

export const TOKEN_KEY = "appcore_token";
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

export const ACTIVE_BUNDLE_KEY = "appcore_active_bundle";
export const getActiveBundleId = () => localStorage.getItem(ACTIVE_BUNDLE_KEY);
export const setActiveBundleId = (bundleId: string | null) => {
  if (bundleId) localStorage.setItem(ACTIVE_BUNDLE_KEY, bundleId);
  else localStorage.removeItem(ACTIVE_BUNDLE_KEY);
  window.dispatchEvent(new Event("app-changed"));
};

export function authHeaders(): HeadersInit {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function buildUrl(path: string): string {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  const bundleId = getActiveBundleId();
  if (bundleId) url.searchParams.set("bundleId", bundleId);
  return url.toString().replace(window.location.origin, "");
}

export function useApi<T>(path: string, deps: any[] = [], skipBundleId = false) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(skipBundleId ? `${BASE}${path}` : buildUrl(path), { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [path, skipBundleId, ...deps]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    window.addEventListener("app-changed", refetch);
    return () => window.removeEventListener("app-changed", refetch);
  }, [refetch]);

  return { data, loading, error, refetch };
}

export async function apiPost<T = any>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiPut<T = any>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
