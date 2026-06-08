import { useState } from "react";
import { Check, Search, ArrowLeft, Star } from "lucide-react";
import { authHeaders, setActiveBundleId } from "../hooks/useApi";
import { borderDefault, btnPrimary, btnSecondary, inputCls, textMuted, textPrimary, textSecondary } from "../styles";
import type { StoreApp } from "../types";

interface Props {
  onComplete: () => void;
  initialStep?: 1 | 2;
}

/* ──────────────────────────────────────────────────────────────────────────
 * OLD ASC-API based onboarding — kept for reference, replaced by the App Store
 * search flow below. Previously we asked the user for their App Store Connect
 * API credentials (Issuer ID, Key ID, .p8 private key, vendor number) and then
 * listed the apps from their ASC account to import.
 *
 * import type { AscApp } from "../types";
 *
 * interface AscForm {
 *   ascIssuerId: string;
 *   ascKeyId: string;
 *   ascPrivateKey: string;
 *   ascVendorNumber: string;
 * }
 *
 * function StepIndicator({ step }: { step: 1 | 2 }) {
 *   return (
 *     <div className="flex items-center gap-3 mb-8">
 *       <div className="flex items-center gap-2">
 *         <div
 *           className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
 *             step >= 1
 *               ? "bg-gradient-to-br from-[#D94412] to-[#C4001E] text-white"
 *               : "bg-[#eef0f3] dark:bg-[#2a2f3d] text-[#9ca3af]"
 *           }`}
 *         >
 *           {step > 1 ? <Check className="w-3 h-3" /> : "1"}
 *         </div>
 *         <span className={`text-sm font-medium ${step >= 1 ? textPrimary : "text-[#9ca3af]"}`}>
 *           App Store Connect
 *         </span>
 *       </div>
 *       <div className="flex-1 h-px bg-[#eef0f3] dark:bg-[#2a2f3d]" />
 *       <div className="flex items-center gap-2">
 *         <div
 *           className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
 *             step >= 2
 *               ? "bg-gradient-to-br from-[#D94412] to-[#C4001E] text-white"
 *               : "bg-[#eef0f3] dark:bg-[#2a2f3d] text-[#9ca3af]"
 *           }`}
 *         >
 *           2
 *         </div>
 *         <span className={`text-sm font-medium ${step >= 2 ? textPrimary : "text-[#9ca3af]"}`}>Import App</span>
 *       </div>
 *     </div>
 *   );
 * }
 *
 * // inside the component:
 * const [form, setForm] = useState<AscForm>({
 *   ascIssuerId: "",
 *   ascKeyId: "",
 *   ascPrivateKey: "",
 *   ascVendorNumber: "",
 * });
 * const [saving, setSaving] = useState(false);
 * const [saveError, setSaveError] = useState<string | null>(null);
 * const [apps, setApps] = useState<AscApp[] | null>(null);
 * const [appsLoading, setAppsLoading] = useState(false);
 *
 * const loadApps = async () => {
 *   setAppsLoading(true);
 *   setAppsError(null);
 *   try {
 *     const res = await fetch("/api/asc/apps", { headers: authHeaders() });
 *     const data = await res.json();
 *     if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
 *     setApps(data);
 *   } catch (err: any) {
 *     setAppsError(err.message ?? "Failed to load apps");
 *   } finally {
 *     setAppsLoading(false);
 *   }
 * };
 *
 * useEffect(() => {
 *   if (step === 2) loadApps();
 * }, [step]);
 *
 * const handleSaveCredentials = async (e: React.FormEvent) => {
 *   e.preventDefault();
 *   setSaveError(null);
 *   if (!form.ascIssuerId || !form.ascKeyId || !form.ascPrivateKey) {
 *     setSaveError("Issuer ID, Key ID, and Private Key are required.");
 *     return;
 *   }
 *   setSaving(true);
 *   try {
 *     const res = await fetch("/api/settings", {
 *       method: "PUT",
 *       headers: { "Content-Type": "application/json", ...authHeaders() },
 *       body: JSON.stringify(form),
 *     });
 *     const data = await res.json();
 *     if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
 *     setStep(2);
 *   } catch (err: any) {
 *     setSaveError(err.message ?? "Failed to save credentials");
 *   } finally {
 *     setSaving(false);
 *   }
 * };
 *
 * // Step 1 — ASC credentials form
 * {step === 1 && (
 *   <>
 *     <div className="mb-6">
 *       <h1 className={`text-xl font-bold ${textPrimary}`}>Connect App Store Connect</h1>
 *       <p className={`text-sm ${textSecondary} mt-1`}>
 *         Enter your API credentials to sync your apps and metadata. You'll find these in{" "}
 *         <span className="font-medium text-[#374151] dark:text-[#c5cad6]">
 *           App Store Connect → Users & Access → Integrations
 *         </span>
 *         .
 *       </p>
 *     </div>
 *
 *     <form onSubmit={handleSaveCredentials} className="flex flex-col gap-4">
 *       <div className="grid grid-cols-2 gap-4">
 *         <label className="flex flex-col gap-1.5">
 *           <span className={`text-sm font-medium ${textPrimary}`}>Issuer ID</span>
 *           <input
 *             className={inputCls}
 *             type="text"
 *             placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 *             value={form.ascIssuerId}
 *             onChange={(e) => setForm((f) => ({ ...f, ascIssuerId: e.target.value }))}
 *           />
 *         </label>
 *         <label className="flex flex-col gap-1.5">
 *           <span className={`text-sm font-medium ${textPrimary}`}>Key ID</span>
 *           <input
 *             className={inputCls}
 *             type="text"
 *             placeholder="XXXXXXXXXX"
 *             value={form.ascKeyId}
 *             onChange={(e) => setForm((f) => ({ ...f, ascKeyId: e.target.value }))}
 *           />
 *         </label>
 *       </div>
 *
 *       <label className="flex flex-col gap-1.5">
 *         <span className={`text-sm font-medium ${textPrimary}`}>
 *           Vendor Number
 *           <span className="ml-1 text-[11px] font-normal text-[#9ca3af]">
 *             (Payments &amp; Financial Reports)
 *           </span>
 *         </span>
 *         <input
 *           className={inputCls}
 *           type="text"
 *           placeholder="12345678"
 *           value={form.ascVendorNumber}
 *           onChange={(e) => setForm((f) => ({ ...f, ascVendorNumber: e.target.value }))}
 *         />
 *       </label>
 *
 *       <label className="flex flex-col gap-1.5">
 *         <span className={`text-sm font-medium ${textPrimary}`}>Private Key (.p8)</span>
 *         <p className={`text-[11px] ${textMuted} -mt-0.5`}>
 *           Paste the full contents of your AuthKey_XXXXXX.p8 file.
 *         </p>
 *         <textarea
 *           className={textareaCls}
 *           rows={5}
 *           placeholder={"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"}
 *           value={form.ascPrivateKey}
 *           onChange={(e) => setForm((f) => ({ ...f, ascPrivateKey: e.target.value }))}
 *         />
 *       </label>
 *
 *       {saveError && (
 *         <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-2.5">
 *           {saveError}
 *         </div>
 *       )}
 *
 *       <button type="submit" disabled={saving} className={`${btnPrimary} w-full justify-center mt-1`}>
 *         {saving ? "Saving…" : "Continue →"}
 *       </button>
 *     </form>
 *   </>
 * )}
 * ────────────────────────────────────────────────────────────────────────── */

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-3 mb-8">
      <div className="flex items-center gap-2">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            step >= 1
              ? "bg-gradient-to-br from-[#D94412] to-[#C4001E] text-white"
              : "bg-[#eef0f3] dark:bg-[#2a2f3d] text-[#9ca3af]"
          }`}
        >
          {step > 1 ? <Check className="w-3 h-3" /> : "1"}
        </div>
        <span className={`text-sm font-medium ${step >= 1 ? textPrimary : "text-[#9ca3af]"}`}>Find your app</span>
      </div>
      <div className="flex-1 h-px bg-[#eef0f3] dark:bg-[#2a2f3d]" />
      <div className="flex items-center gap-2">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            step >= 2
              ? "bg-gradient-to-br from-[#D94412] to-[#C4001E] text-white"
              : "bg-[#eef0f3] dark:bg-[#2a2f3d] text-[#9ca3af]"
          }`}
        >
          2
        </div>
        <span className={`text-sm font-medium ${step >= 2 ? textPrimary : "text-[#9ca3af]"}`}>Confirm</span>
      </div>
    </div>
  );
}

function AppAvatar({ url, name, size = "md" }: { url?: string | null; name: string; size?: "md" | "lg" }) {
  const cls = size === "lg" ? "w-16 h-16 rounded-2xl text-lg" : "w-10 h-10 rounded-xl text-sm";
  return url ? (
    <img src={url} alt="" className={`${cls} object-cover shrink-0`} />
  ) : (
    <div
      className={`${cls} bg-gradient-to-br from-[#D94412] to-[#C4001E] flex items-center justify-center text-white font-bold shrink-0`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function Onboarding({ onComplete }: Props) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<StoreApp[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StoreApp | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const step: 1 | 2 = selected ? 2 : 1;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    setResults(null);

    try {
      const res = await fetch(`/api/asc/store-search?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResults(data);
    } catch (err: any) {
      setSearchError(err.message ?? "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleImport = async (app: StoreApp) => {
    setImporting(true);
    setImportError(null);

    try {
      const res = await fetch("/api/asc/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          ascId: app.trackId,
          bundleId: app.bundleId,
          name: app.name,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setActiveBundleId(app.bundleId);
      onComplete();
    } catch (err: any) {
      setImportError(err.message ?? "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb] dark:bg-[#0f1117] px-4">
      <div className="w-full max-w-[520px]">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <img src="/logo.svg" alt="Marteso" className="h-[30px] w-auto" />
          <span className="text-[32px] font-bold tracking-[-0.3px] bg-gradient-to-br from-[#D94412] to-[#C4001E] bg-clip-text text-transparent">
            marteso
          </span>
        </div>

        <div className={`bg-white dark:bg-[#1c2028] rounded-2xl shadow-xl border ${borderDefault} p-8`}>
          <StepIndicator step={step} />

          {!selected && (
            <>
              <div className="mb-6">
                <h1 className={`text-2xl font-bold ${textPrimary}`}>Find your app</h1>
                <p className={`text-md ${textSecondary} mt-1`}>
                  Search by app name or paste your App Store link to import your first app.
                </p>
              </div>

              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  className={`${inputCls} flex-1`}
                  type="text"
                  autoFocus
                  placeholder="App name or https://apps.apple.com/…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button type="submit" disabled={searching || !query.trim()} className={`${btnPrimary} shrink-0 !px-4`}>
                  <Search className="w-4 h-4" />
                  {searching ? "Searching…" : "Search"}
                </button>
              </form>

              {searchError && (
                <div className="mt-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-2.5">
                  {searchError}
                </div>
              )}

              {searching && (
                <div className={`flex items-center justify-center py-10 gap-2 ${textMuted} text-sm`}>
                  <div className="spinner" /> Searching the App Store…
                </div>
              )}

              {!searching && results !== null && results.length === 0 && (
                <div className={`text-center py-10 text-sm ${textMuted}`}>
                  No apps found. Try a different name or paste the App Store link.
                </div>
              )}

              {!searching && results && results.length > 0 && (
                <div className="flex flex-col gap-2 mt-4">
                  {results.map((app) => (
                    <button
                      key={app.trackId}
                      type="button"
                      onClick={() => {
                        setImportError(null);
                        setSelected(app);
                      }}
                      className={`flex items-center justify-between gap-3 px-4 py-3 bg-[#f7f8fa] dark:bg-[#252b38] rounded-xl border ${borderDefault} hover:border-[#D94412]/50 transition-colors text-left`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <AppAvatar url={app.iconUrl} name={app.name} />
                        <div className="min-w-0">
                          <div className={`text-sm font-semibold ${textPrimary} truncate`}>{app.name}</div>
                          <div className={`text-[11px] ${textMuted} truncate`}>
                            {app.sellerName}
                            {app.genre ? ` · ${app.genre}` : ""}
                          </div>
                        </div>
                      </div>
                      <span className={`${btnSecondary} shrink-0 !text-xs !py-1.5 !px-3`}>Select →</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {selected && (
            <>
              <div className="mb-6">
                <h1 className={`text-2xl font-bold ${textPrimary}`}>Is this your app?</h1>
                <p className={`text-md ${textSecondary} mt-1`}>
                  Confirm this is the app you want to import and manage with Marteso.
                </p>
              </div>

              <div
                className={`flex items-center gap-4 px-4 py-4 bg-[#f7f8fa] dark:bg-[#252b38] rounded-xl border ${borderDefault}`}
              >
                <AppAvatar url={selected.iconUrl} name={selected.name} size="lg" />
                <div className="min-w-0">
                  <div className={`text-base font-bold ${textPrimary} truncate`}>{selected.name}</div>
                  <div className={`text-xs ${textSecondary} truncate`}>{selected.sellerName}</div>
                  <div className={`text-[11px] ${textMuted} font-mono truncate mt-0.5`}>{selected.bundleId}</div>
                  {selected.rating != null && (
                    <div className={`flex items-center gap-1 mt-1 text-[11px] ${textMuted}`}>
                      <Star className="w-3 h-3 fill-[#f5a623] text-[#f5a623]" />
                      {selected.rating.toFixed(1)}
                      {selected.ratingsCount != null ? ` (${selected.ratingsCount.toLocaleString()})` : ""}
                    </div>
                  )}
                </div>
              </div>

              {importError && (
                <div className="mt-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-2.5">
                  {importError}
                </div>
              )}

              <div className="flex gap-2 mt-6">
                <button
                  type="button"
                  disabled={importing}
                  onClick={() => setSelected(null)}
                  className={`${btnSecondary} flex-1 justify-center`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Not my app
                </button>
                <button
                  type="button"
                  disabled={importing}
                  onClick={() => handleImport(selected)}
                  className={`${btnPrimary} flex-1 justify-center`}
                >
                  {importing ? "Importing…" : "Yes, import it"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
