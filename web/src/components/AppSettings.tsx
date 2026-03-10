import { useState, useEffect } from "react";
import { useApi, apiPut, getActiveBundleId } from "../hooks/useApi";
import ScrapingConfigSection from "./comps/settings/ScrapingConfigSection";
import AsoLocalesSection from "./comps/settings/AsoLocalesSection";
import SigningSection from "./comps/settings/SigningSection";
import { SettingsData } from "./comps/settings/types";
import { RepoLinker } from "./Screenshots";
import { inputCls, btnPrimary } from "../styles";
import type { AppItem, GitHubStatus } from "../types";

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function AppSettings({ addToast }: Props) {
  const { data, loading, refetch } = useApi<SettingsData>("/settings");
  const [form, setForm] = useState<Partial<SettingsData>>({});
  const [saving, setSaving] = useState(false);
  const { data: apps } = useApi<AppItem[]>("/apps", [], true);
  const { data: ghStatus } = useApi<GitHubStatus>("/github/status", [], true);

  const bundleId = getActiveBundleId();
  const activeApp = apps?.find((a) => a.bundleId === bundleId && a.isOwnApp);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

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

  if (loading)
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-gray-400 dark:text-[#5c6478]">
        <div className="spinner" /> Loading settings…
      </div>
    );

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight text-[#111827] dark:text-[#e8eaf0] mb-1">
        App Settings
      </h1>
      <p className="text-sm text-[#9ca3af] dark:text-[#5c6478] mb-8">
        App-level configuration: scraping behaviour, ASO locales, and GitHub
        repository link for automatic screenshot generation.
      </p>

      {activeApp ? (
        <RepoLinker
          appId={activeApp.id}
          appName={activeApp.name}
          connected={!!ghStatus?.connected}
          addToast={addToast}
        />
      ) : (
        <div className="bg-white dark:bg-[#1c2028] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-2xl p-5 mb-5 text-sm text-[#9ca3af] dark:text-[#5c6478]">
          No app selected. Choose an app from the sidebar to link a GitHub repo.
        </div>
      )}

      {activeApp && (
        <SigningSection appId={activeApp.id} addToast={addToast} />
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-0">
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
