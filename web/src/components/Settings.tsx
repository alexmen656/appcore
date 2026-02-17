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

export default function Settings({ addToast }: Props) {
  const { data, loading, refetch } = useApi<SettingsData>("/settings");
  const [form, setForm] = useState<Partial<SettingsData>>({});
  const [saving, setSaving] = useState(false);

  // ── ASC App Picker ───────────────────────────────────────────────────────
  const [ascApps, setAscApps] = useState<AscApp[] | null>(null);
  const [ascLoading, setAscLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null); // ascId being imported

  const loadAscApps = async () => {
    setAscLoading(true);
    setAscApps(null);
    try {
      const token = getToken();
      const res = await fetch("/api/asc/apps", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
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
        {
          ascId: app.ascId,
          bundleId: app.bundleId,
          name: app.name,
        },
      );
      addToast(`"${result.app.name}" imported successfully`, "success");
    } catch (err: any) {
      addToast(`Import failed: ${err.message}`, "error");
    } finally {
      setImporting(null);
    }
  };

  // Populate form once data loads
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (loading)
    return (
      <div className="loading">
        <div className="spinner" /> Loading settings…
      </div>
    );

  const set = (key: keyof SettingsData, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));

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

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">
          Configure your personal API keys and preferences. Apple Search Ads
          credentials are managed centrally.
        </p>
      </div>

      <form onSubmit={handleSave}>
        {/* ─── App Store Connect ─────────────────────────────────────────── */}
        <section className="settings-section">
          <h2 className="settings-section-title">App Store Connect</h2>
          <p className="settings-section-desc">
            Required for syncing your app metadata, current keywords, and
            submitting ASO changes.
          </p>
          <div className="settings-grid">
            <Field
              label="Issuer ID"
              hint="Found in App Store Connect → Users & Access → Integrations"
            >
              <input
                className="settings-input"
                type="text"
                value={form.ascIssuerId ?? ""}
                onChange={(e) => set("ascIssuerId", e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </Field>
            <Field label="Key ID">
              <input
                className="settings-input"
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
                  ? "Private key is set. Paste a new key below to replace it."
                  : "Paste the full contents of your AuthKey_XXXXXX.p8 file."
              }
              fullWidth
            >
              <textarea
                className="settings-input settings-textarea"
                value={
                  form.ascPrivateKey === "••••••••"
                    ? ""
                    : (form.ascPrivateKey ?? "")
                }
                onChange={(e) => set("ascPrivateKey", e.target.value)}
                placeholder={
                  data?.ascPrivateKeySet
                    ? "Leave empty to keep existing key"
                    : "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
                }
                rows={5}
              />
            </Field>
          </div>
        </section>

        {/* ─── App Store Connect: Browse & Import Apps ───────────────────── */}
        <section className="settings-section">
          <h2 className="settings-section-title">
            Apps from App Store Connect
          </h2>
          <p className="settings-section-desc">
            Load all apps from your App Store Connect account and import them
            for tracking. Save your ASC credentials above first.
          </p>
          <button
            type="button"
            className="btn-primary"
            style={{ marginBottom: ascApps ? 16 : 0 }}
            onClick={loadAscApps}
            disabled={ascLoading}
          >
            {ascLoading ? "Loading…" : "Load my apps from App Store Connect"}
          </button>

          {ascApps !== null &&
            (ascApps.length === 0 ? (
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: 13,
                  marginTop: 12,
                }}
              >
                No apps found. Make sure your ASC credentials have access to at
                least one app.
              </p>
            ) : (
              <div className="asc-app-list">
                {ascApps.map((app) => (
                  <div key={app.ascId} className="asc-app-row">
                    <div className="asc-app-info">
                      <span className="asc-app-name">{app.name}</span>
                      <span className="asc-app-meta">
                        {app.bundleId} &middot; ID {app.ascId}
                        {app.primaryLocale ? ` · ${app.primaryLocale}` : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={importing === app.ascId}
                      onClick={() => importApp(app)}
                    >
                      {importing === app.ascId ? "Importing…" : "Import"}
                    </button>
                  </div>
                ))}
              </div>
            ))}
        </section>

        {/* ─── AI Provider ───────────────────────────────────────────────── */}
        <section className="settings-section">
          <h2 className="settings-section-title">AI Provider</h2>
          <p className="settings-section-desc">
            Used for generating ASO suggestions (titles, keywords,
            descriptions).
          </p>
          <div className="settings-grid">
            <Field label="Provider">
              <select
                className="settings-input settings-select"
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
                className="settings-input"
                type="password"
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
                autoComplete="off"
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
                className="settings-input"
                type="password"
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
                autoComplete="off"
              />
            </Field>
          </div>
        </section>

        {/* ─── Scraping Config ───────────────────────────────────────────── */}
        <section className="settings-section">
          <h2 className="settings-section-title">Scraping & Tracking</h2>
          <div className="settings-grid">
            <Field
              label="Store Country"
              hint="2-letter country code for App Store scraping (e.g. us, de, gb)"
            >
              <input
                className="settings-input"
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
                className="settings-input"
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
                className="settings-input"
                type="number"
                min={1}
                max={100}
                value={form.maxCompetitors ?? 20}
                onChange={(e) => set("maxCompetitors", Number(e.target.value))}
              />
            </Field>
          </div>
        </section>

        {/* ─── ASO Locales ───────────────────────────────────────────────── */}
        <section className="settings-section">
          <h2 className="settings-section-title">ASO Locales</h2>
          <p className="settings-section-desc">
            Comma-separated App Store Connect locale codes for multi-language
            ASO analysis.
          </p>
          <div className="settings-grid">
            <Field label="Locales" hint="e.g. en-US,de-DE,fr-FR" fullWidth>
              <input
                className="settings-input"
                type="text"
                value={form.asoLocales ?? "en-US"}
                onChange={(e) => set("asoLocales", e.target.value)}
                placeholder="en-US,de-DE"
              />
            </Field>
          </div>
        </section>

        {/* ─── Save ──────────────────────────────────────────────────────── */}
        <div className="settings-footer">
          <button className="btn-primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Small helper component ───────────────────────────────────────────────────
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
    <div
      className={`settings-field${fullWidth ? " settings-field--full" : ""}`}
    >
      <label className="settings-label">{label}</label>
      {hint && <span className="settings-hint">{hint}</span>}
      {children}
    </div>
  );
}
