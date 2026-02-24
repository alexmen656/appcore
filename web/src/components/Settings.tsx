import { useState, useEffect } from "react";
import { useApi, apiPut } from "../hooks/useApi";
import AscCredentialsSection from "./comps/settings/AscCredentialsSection";
import AiProviderSection from "./comps/settings/AiProviderSection";
import ScrapingConfigSection from "./comps/settings/ScrapingConfigSection";
import AsoLocalesSection from "./comps/settings/AsoLocalesSection";
import { SettingsData } from "./comps/settings/types";

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function Settings({ addToast }: Props) {
  const { data, loading, refetch } = useApi<SettingsData>("/settings");
  const [form, setForm] = useState<Partial<SettingsData>>({});
  const [saving, setSaving] = useState(false);

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
      <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
        <div className="spinner" /> Loading settings…
      </div>
    );

  const inputCls =
    "w-full px-3.5 py-[9px] rounded-xl border border-[#eef0f3] bg-white text-[#111827] text-[13px] outline-none transition-colors focus:border-[#ea0e2b] font-[inherit]";
  const textareaCls = `${inputCls} resize-y font-mono text-xs`;
  const btnSecondary =
    "inline-flex items-center gap-1.5 px-4 py-[7px] rounded-xl border border-[#eef0f3] bg-transparent text-[#111827] text-[13px] font-medium transition-all hover:border-[#ea0e2b] hover:text-[#ea0e2b] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";
  const btnSecondarySmall = `${btnSecondary} !px-[10px] !py-[5px] !text-xs`;
  const btnPrimary =
    "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium bg-[#ea0e2b] text-white hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-[#111827] mb-1">
        Settings
      </h1>
      <p className="text-sm text-[#9ca3af] mb-8">
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
