import { useState, useEffect } from "react";
import { useApi, apiPut, apiPost, getToken } from "../hooks/useApi";

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

interface SettingsData {
  ascIssuerId: string;
  ascKeyId: string;
  ascPrivateKey: string;
  ascPrivateKeySet: boolean;
  ascAppId: string;
  ascBundleId: string;
  openaiApiKey: string;
  openaiApiKeySet: boolean;
  anthropicApiKey: string;
  anthropicApiKeySet: boolean;
  aiProvider: string;
  scrapeCountry: string;
  scrapeIntervalHours: number;
  maxCompetitors: number;
  asoLocales: string;
}

interface AscApp {
  ascId: string;
  name: string;
  bundleId: string;
  sku: string | null;
  primaryLocale: string | null;
}

function SectionCard({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[#e5e7eb] rounded-xl p-6 mb-5">
      <h2 className="text-[15px] font-semibold text-[#1a1a2e] mb-1">{title}</h2>
      {desc && <p className="text-xs text-gray-400 mb-5">{desc}</p>}
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
  fullWidth,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "col-span-2" : ""}>
      <label className="text-sm font-medium text-[#1a1a2e] block mb-1">
        {label}
      </label>
      {hint && <p className="text-[11px] text-gray-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

export default function Settings({ addToast }: Props) {
  const { data, loading, refetch } = useApi<SettingsData>("/settings");
  const [form, setForm] = useState<Partial<SettingsData>>({});
  const [saving, setSaving] = useState(false);
  const [ascApps, setAscApps] = useState<AscApp[] | null>(null);
  const [ascLoading, setAscLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const set = (key: keyof SettingsData, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));

  const loadAscApps = async () => {
    setAscLoading(true);
    setAscApps(null);
    try {
      const token = getToken();
      const res = await fetch("/api/asc/apps", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? `HTTP ${res.status}`);
      }
      setAscApps(await res.json());
    } catch (err: any) {
      addToast(`Failed to load apps: ${err.message}`, "error");
    } finally {
      setAscLoading(false);
    }
  };

  const importApp = async (app: AscApp) => {
    setImporting(app.ascId);
    try {
      const result = await apiPost<{ ok: boolean; app: { name: string } }>(
        "/asc/import",
        { ascId: app.ascId, bundleId: app.bundleId, name: app.name },
      );
      addToast(`"${result.app.name}" imported successfully`, "success");
    } catch (err: any) {
      addToast(`Import failed: ${err.message}`, "error");
    } finally {
      setImporting(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPut("/settings", form);
      addToast("Settings saved", "success");
      refetch();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
        <div className="spinner" /> Loading settings…
      </div>
    );

  const inputCls =
    "w-full px-3 py-[9px] rounded-lg border border-[#e5e7eb] bg-white text-[#1a1a2e] text-[13px] outline-none transition-colors focus:border-[#ea0e2b] font-[inherit]";
  const textareaCls = `${inputCls} resize-y font-mono text-xs`;
  const btnSecondary =
    "inline-flex items-center gap-1.5 px-4 py-[7px] rounded-lg border border-[#e5e7eb] bg-transparent text-[#1a1a2e] text-[13px] font-medium transition-all hover:border-[#ea0e2b] hover:text-[#ea0e2b] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";
  const btnSecondarySmall = `${btnSecondary} !px-[10px] !py-[5px] !text-xs`;
  const btnPrimary =
    "inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[13px] font-medium bg-[#ea0e2b] text-white hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight text-[#1a1a2e] mb-1">
        Settings
      </h1>
      <p className="text-base text-gray-500 mb-7">
        Configure your personal API keys and preferences.
      </p>

      <form onSubmit={handleSave} className="flex flex-col gap-0">
        <SectionCard
          title="App Store Connect"
          desc="Required for syncing your app metadata, current keywords, and submitting ASO changes."
        >
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Issuer ID"
              hint="Found in App Store Connect → Users & Access → Integrations"
            >
              <input
                className={inputCls}
                type="text"
                value={form.ascIssuerId ?? ""}
                onChange={(e) => set("ascIssuerId", e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </Field>
            <Field label="Key ID">
              <input
                className={inputCls}
                type="text"
                value={form.ascKeyId ?? ""}
                onChange={(e) => set("ascKeyId", e.target.value)}
                placeholder="XXXXXXXXXX"
              />
            </Field>
            <Field
              label="Private Key (.p8)"
              hint={
                data?.ascPrivateKeySet
                  ? "Key is set — paste a new key to replace."
                  : "Paste the full contents of your AuthKey_XXXXXX.p8 file."
              }
              fullWidth
            >
              <textarea
                className={textareaCls}
                rows={5}
                value={
                  form.ascPrivateKey === "••••••••"
                    ? ""
                    : (form.ascPrivateKey ?? "")
                }
                onChange={(e) => set("ascPrivateKey", e.target.value)}
              />
            </Field>
          </div>
        </SectionCard>
        <SectionCard
          title="Apps from App Store Connect"
          desc="Load all apps from your ASC account and import them for tracking. Save your credentials above first."
        >
          <button
            type="button"
            className={btnSecondary}
            onClick={loadAscApps}
            disabled={ascLoading}
          >
            {ascLoading ? "Loading…" : "Load my apps from App Store Connect"}
          </button>
          {ascApps !== null && ascApps.length === 0 && (
            <p className="text-xs text-gray-400 mt-3">
              No apps found. Check that your ASC credentials have access.
            </p>
          )}
          {ascApps && ascApps.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              {ascApps.map((app) => (
                <div
                  key={app.ascId}
                  className="flex items-center justify-between gap-3 px-4 py-3 bg-[#eff3f6] rounded-xl border border-gray-200"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#1a1a2e] truncate">
                      {app.name}
                    </div>
                    <div className="text-[11px] text-gray-400 font-mono">
                      {app.bundleId} · ID {app.ascId}
                      {app.primaryLocale ? ` · ${app.primaryLocale}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`${btnSecondarySmall} shrink-0`}
                    disabled={importing === app.ascId}
                    onClick={() => importApp(app)}
                  >
                    {importing === app.ascId ? "Importing…" : "Import"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
        <SectionCard
          title="AI Provider"
          desc="Used for generating ASO suggestions (titles, keywords, descriptions)."
        >
          <div className="grid grid-cols-2 gap-4">
            <Field label="Provider">
              <select
                className={`${inputCls} cursor-pointer`}
                value={form.aiProvider ?? "openai"}
                onChange={(e) => set("aiProvider", e.target.value)}
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </Field>
            <Field
              label="OpenAI API Key"
              hint={
                data?.openaiApiKeySet
                  ? "Key is set. Enter a new value to replace."
                  : undefined
              }
            >
              <input
                className={inputCls}
                type="password"
                autoComplete="off"
                value={
                  form.openaiApiKey === "••••••••"
                    ? ""
                    : (form.openaiApiKey ?? "")
                }
                onChange={(e) => set("openaiApiKey", e.target.value)}
                placeholder={
                  data?.openaiApiKeySet
                    ? "Leave empty to keep existing"
                    : "sk-proj-…"
                }
              />
            </Field>
            <Field
              label="Anthropic API Key"
              hint={
                data?.anthropicApiKeySet
                  ? "Key is set. Enter a new value to replace."
                  : undefined
              }
            >
              <input
                className={inputCls}
                type="password"
                autoComplete="off"
                value={
                  form.anthropicApiKey === "••••••••"
                    ? ""
                    : (form.anthropicApiKey ?? "")
                }
                onChange={(e) => set("anthropicApiKey", e.target.value)}
                placeholder={
                  data?.anthropicApiKeySet
                    ? "Leave empty to keep existing"
                    : "sk-ant-…"
                }
              />
            </Field>
          </div>
        </SectionCard>

        {/* Scraping Config */}
        <SectionCard title="Scraping & Tracking">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Store Country"
              hint="2-letter code for App Store scraping (e.g. us, de, gb)"
            >
              <input
                className={inputCls}
                type="text"
                maxLength={2}
                value={form.scrapeCountry ?? "us"}
                onChange={(e) =>
                  set("scrapeCountry", e.target.value.toLowerCase())
                }
                placeholder="us"
              />
            </Field>
            <Field label="Scrape Interval (hours)">
              <input
                className={inputCls}
                type="number"
                min={1}
                max={168}
                value={form.scrapeIntervalHours ?? 24}
                onChange={(e) =>
                  set("scrapeIntervalHours", Number(e.target.value))
                }
              />
            </Field>
            <Field label="Max Competitors to Track">
              <input
                className={inputCls}
                type="number"
                min={1}
                max={100}
                value={form.maxCompetitors ?? 20}
                onChange={(e) => set("maxCompetitors", Number(e.target.value))}
              />
            </Field>
          </div>
        </SectionCard>

        {/* ASO Locales */}
        <SectionCard
          title="ASO Locales"
          desc="Comma-separated App Store Connect locale codes for multi-language ASO analysis."
        >
          <Field label="Locales" hint="e.g. en-US,de-DE,fr-FR" fullWidth>
            <input
              className={inputCls}
              type="text"
              value={form.asoLocales ?? "en-US"}
              onChange={(e) => set("asoLocales", e.target.value)}
              placeholder="en-US,de-DE"
            />
          </Field>
        </SectionCard>

        {/* Save */}
        <div className="flex justify-end pb-2">
          <button className={btnPrimary} type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
