import { useState, useEffect } from "react";
import { useApi, apiPut } from "../hooks/useApi";
import AscCredentialsSection from "./comps/settings/AscCredentialsSection";
import AiProviderSection from "./comps/settings/AiProviderSection";
import GitHubSection from "./comps/settings/GitHubSection";
import { SettingsData } from "./comps/settings/types";
import { inputCls, textareaCls, btnSecondary, btnPrimary } from "../styles";

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
      <div className="flex items-center justify-center py-20 gap-3 text-gray-400 dark:text-[#5c6478]">
        <div className="spinner" /> Loading settings…
      </div>
    );

  const btnSecondarySmall = `${btnSecondary} !px-[10px] !py-[5px] !text-xs`;

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight text-[#111827] dark:text-[#e8eaf0] mb-1">
        User Settings
      </h1>
      <p className="text-sm text-[#9ca3af] dark:text-[#5c6478] mb-8">
        Your personal credentials: GitHub account, App Store Connect keys, and AI provider.
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
        <GitHubSection />

        <div className="flex justify-end pb-2">
          <button className={btnPrimary} type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
