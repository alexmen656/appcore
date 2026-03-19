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

const apiCache = new Map<string, any>();
const apiPreloading = new Map<string, Promise<void>>();

export function clearApiCache() {
  apiCache.clear();
  apiPreloading.clear();
}

export function preloadApi(path: string, skipBundleId = false): Promise<void> {
  const url = skipBundleId ? `${BASE}${path}` : buildUrl(path);
  if (apiCache.has(url)) return Promise.resolve();
  if (apiPreloading.has(url)) return apiPreloading.get(url)!;
  const promise = fetch(url, { headers: authHeaders() })
    .then((r) => {
      if (!r.ok) return;
      return r.json().then((d) => {
        apiCache.set(url, d);
      });
    })
    .catch(() => {})
    .finally(() => {
      apiPreloading.delete(url);
    });
  apiPreloading.set(url, promise);
  return promise;
}

export function useApi<T>(
  path: string,
  deps: any[] = [],
  skipBundleId = false,
) {
  const getUrl = () => (skipBundleId ? `${BASE}${path}` : buildUrl(path));

  const [data, setData] = useState<T | null>(
    () => apiCache.get(getUrl()) ?? null,
  );
  const [loading, setLoading] = useState(() => !apiCache.has(getUrl()));
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    const url = getUrl();
    if (!getToken()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(url, { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        apiCache.set(url, d);
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [path, skipBundleId, ...deps]);

  useEffect(() => {
    const url = getUrl();
    const pending = apiPreloading.get(url);
    if (pending) {
      pending.then(() => {
        const c = apiCache.get(url);
        if (c) {
          setData(c as T);
          setLoading(false);
        } else {
          refetch();
        }
      });
    } else {
      const c = apiCache.get(url);
      if (c) {
        setData(c as T);
        setLoading(false);
      } else {
        refetch();
      }
    }
  }, [refetch]);

  useEffect(() => {
    const handler = () => {
      setData(null);
      setLoading(true);
      refetch();
    };
    window.addEventListener("app-changed", handler);
    return () => window.removeEventListener("app-changed", handler);
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
