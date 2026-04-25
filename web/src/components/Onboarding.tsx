import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { authHeaders, setActiveBundleId } from "../hooks/useApi";
import { borderDefault, btnPrimary, inputCls, textMuted, textPrimary, textSecondary, textareaCls } from "../styles";
import type { AscApp } from "../types";

interface Props {
  onComplete: () => void;
}

interface AscForm {
  ascIssuerId: string;
  ascKeyId: string;
  ascPrivateKey: string;
  ascVendorNumber: string;
}

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
        <span className={`text-sm font-medium ${step >= 1 ? "${textPrimary}" : "text-[#9ca3af]"}`}>
          App Store Connect
        </span>
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
        <span className={`text-sm font-medium ${step >= 2 ? "${textPrimary}" : "text-[#9ca3af]"}`}>Import App</span>
      </div>
    </div>
  );
}

function AppAvatar({ url, name }: { url?: string | null; name: string }) {
  return url ? (
    <img src={url} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
  ) : (
    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D94412] to-[#C4001E] flex items-center justify-center text-white font-bold text-sm shrink-0">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<AscForm>({
    ascIssuerId: "",
    ascKeyId: "",
    ascPrivateKey: "",
    ascVendorNumber: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [apps, setApps] = useState<AscApp[] | null>(null);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);

  const loadApps = async () => {
    setAppsLoading(true);
    setAppsError(null);
    try {
      const res = await fetch("/api/asc/apps", { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setApps(data);
    } catch (err: any) {
      setAppsError(err.message ?? "Failed to load apps");
    } finally {
      setAppsLoading(false);
    }
  };

  useEffect(() => {
    if (step === 2) loadApps();
  }, [step]);

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (!form.ascIssuerId || !form.ascKeyId || !form.ascPrivateKey) {
      setSaveError("Issuer ID, Key ID, and Private Key are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setStep(2);
    } catch (err: any) {
      setSaveError(err.message ?? "Failed to save credentials");
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async (app: AscApp) => {
    setImporting(app.ascId);
    try {
      const res = await fetch("/api/asc/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          ascId: app.ascId,
          bundleId: app.bundleId,
          name: app.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setActiveBundleId(app.bundleId);
      onComplete();
    } catch (err: any) {
      setAppsError(err.message ?? "Import failed");
    } finally {
      setImporting(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb] dark:bg-[#0f1117] px-4">
      <div className="w-full max-w-[520px]">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <img src="/app/logo.svg" alt="Marteso" className="h-[22px] w-auto" />
          <span className="text-[24px] font-bold tracking-[-0.3px] bg-gradient-to-br from-[#D94412] to-[#C4001E] bg-clip-text text-transparent">
            marteso
          </span>
        </div>

        <div className={`bg-white dark:bg-[#1c2028] rounded-2xl shadow-xl border ${borderDefault} p-8`}>
          <StepIndicator step={step} />

          {step === 1 && (
            <>
              <div className="mb-6">
                <h1 className={`text-xl font-bold ${textPrimary}`}>Connect App Store Connect</h1>
                <p className={`text-sm ${textSecondary} mt-1`}>
                  Enter your API credentials to sync your apps and metadata. You'll find these in{" "}
                  <span className="font-medium text-[#374151] dark:text-[#c5cad6]">
                    App Store Connect → Users & Access → Integrations
                  </span>
                  .
                </p>
              </div>

              <form onSubmit={handleSaveCredentials} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className={`text-sm font-medium ${textPrimary}`}>Issuer ID</span>
                    <input
                      className={inputCls}
                      type="text"
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={form.ascIssuerId}
                      onChange={(e) => setForm((f) => ({ ...f, ascIssuerId: e.target.value }))}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className={`text-sm font-medium ${textPrimary}`}>Key ID</span>
                    <input
                      className={inputCls}
                      type="text"
                      placeholder="XXXXXXXXXX"
                      value={form.ascKeyId}
                      onChange={(e) => setForm((f) => ({ ...f, ascKeyId: e.target.value }))}
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className={`text-sm font-medium ${textPrimary}`}>
                    Vendor Number
                    <span className="ml-1 text-[11px] font-normal text-[#9ca3af]">
                      (Payments &amp; Financial Reports)
                    </span>
                  </span>
                  <input
                    className={inputCls}
                    type="text"
                    placeholder="12345678"
                    value={form.ascVendorNumber}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        ascVendorNumber: e.target.value,
                      }))
                    }
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className={`text-sm font-medium ${textPrimary}`}>Private Key (.p8)</span>
                  <p className={`text-[11px] ${textMuted} -mt-0.5`}>
                    Paste the full contents of your AuthKey_XXXXXX.p8 file.
                  </p>
                  <textarea
                    className={textareaCls}
                    rows={5}
                    placeholder={"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"}
                    value={form.ascPrivateKey}
                    onChange={(e) => setForm((f) => ({ ...f, ascPrivateKey: e.target.value }))}
                  />
                </label>

                {saveError && (
                  <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-2.5">
                    {saveError}
                  </div>
                )}

                <button type="submit" disabled={saving} className={`${btnPrimary} w-full justify-center mt-1`}>
                  {saving ? "Saving…" : "Continue →"}
                </button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <div className="mb-6">
                <h1 className={`text-xl font-bold ${textPrimary}`}>Import your first app</h1>
                <p className={`text-sm ${textSecondary} mt-1`}>
                  Select an app from your App Store Connect account to get started.
                </p>
              </div>

              {appsLoading && (
                <div className={`flex items-center justify-center py-10 gap-2 ${textMuted} text-sm`}>
                  <div className="spinner" /> Loading your apps…
                </div>
              )}

              {appsError && (
                <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3 flex flex-col gap-2">
                  <span>{appsError}</span>
                  <button onClick={loadApps} className="text-red-600 font-medium text-xs underline self-start">
                    Try again
                  </button>
                </div>
              )}

              {!appsLoading && !appsError && apps !== null && apps.length === 0 && (
                <div className={`text-center py-10 text-sm ${textMuted}`}>
                  No apps found in your App Store Connect account.
                </div>
              )}

              {!appsLoading && apps && apps.length > 0 && (
                <div className="flex flex-col gap-2">
                  {apps.map((app) => (
                    <div
                      key={app.ascId}
                      className={`flex items-center justify-between gap-3 px-4 py-3 bg-[#f7f8fa] dark:bg-[#252b38] rounded-xl border ${borderDefault}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <AppAvatar url={app.iconUrl} name={app.name} />
                        <div className="min-w-0">
                          <div className={`text-sm font-semibold ${textPrimary} truncate`}>{app.name}</div>
                          <div className={`text-[11px] ${textMuted} font-mono truncate`}>
                            {app.bundleId}
                            {app.primaryLocale ? ` · ${app.primaryLocale}` : ""}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={importing === app.ascId}
                        onClick={() => handleImport(app)}
                        className={`${btnPrimary} shrink-0 !text-xs !py-1.5 !px-3`}
                      >
                        {importing === app.ascId ? "Importing…" : "Import"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={onComplete}
                className={`mt-5 w-full text-center text-xs ${textMuted} hover:text-[#6b7280] dark:hover:text-[#8b93a5] transition-colors`}
              >
                Skip for now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
