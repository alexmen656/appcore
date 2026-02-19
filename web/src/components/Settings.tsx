import { useState, useEffect } from "react";
import { useApi, apiPut, apiPost, getToken } from "../hooks/useApi";
import AscCredentialsSection from "./comps/settings/AscCredentialsSection";
import AscAppsSection from "./comps/settings/AscAppsSection";
import AiProviderSection from "./comps/settings/AiProviderSection";
import ScrapingConfigSection from "./comps/settings/ScrapingConfigSection";
import AsoLocalesSection from "./comps/settings/AsoLocalesSection";
import { SettingsData, AscApp } from "./comps/settings/types";

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
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
        <AscCredentialsSection
          form={form}
          data={data ?? null}
          inputCls={inputCls}
          textareaCls={textareaCls}
          onChange={set}
        />
        <AscAppsSection
          ascApps={ascApps}
          ascLoading={ascLoading}
          importing={importing}
          btnSecondary={btnSecondary}
          btnSecondarySmall={btnSecondarySmall}
          onLoadApps={loadAscApps}
          onImport={importApp}
        />
        <AiProviderSection
          form={form}
          data={data ?? null}
          inputCls={inputCls}
          onChange={set}
        />
        <ScrapingConfigSection form={form} inputCls={inputCls} onChange={set} />
        <AsoLocalesSection form={form} inputCls={inputCls} onChange={set} />

        <div className="flex justify-end pb-2">
          <button className={btnPrimary} type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
