import SectionCard from "./SectionCard";
import Field from "./Field";
import { SettingsData } from "./types";

interface Props {
  form: Partial<SettingsData>;
  data: SettingsData | null;
  inputCls: string;
  onChange: (key: keyof SettingsData, value: any) => void;
}

export default function AiProviderSection({
  form,
  data,
  inputCls,
  onChange,
}: Props) {
  return (
    <SectionCard
      title="AI Provider"
      desc="Used for generating ASO suggestions (titles, keywords, descriptions)."
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Provider">
          <select
            className={`${inputCls} cursor-pointer`}
            value={form.aiProvider ?? "openai"}
            onChange={(e) => onChange("aiProvider", e.target.value)}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </Field>
        {form.aiProvider === "openai" && (
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
              onChange={(e) => onChange("openaiApiKey", e.target.value)}
              placeholder={
                data?.openaiApiKeySet
                  ? "Leave empty to keep existing"
                  : "sk-proj-…"
              }
            />
          </Field>
        )}
        {form.aiProvider === "anthropic" && (
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
              onChange={(e) => onChange("anthropicApiKey", e.target.value)}
              placeholder={
                data?.anthropicApiKeySet
                  ? "Leave empty to keep existing"
                  : "sk-ant-…"
              }
            />
          </Field>
        )}
      </div>
    </SectionCard>
  );
}
