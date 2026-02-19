import SectionCard from "./SectionCard";
import Field from "./Field";
import { SettingsData } from "./types";

interface Props {
  form: Partial<SettingsData>;
  inputCls: string;
  onChange: (key: keyof SettingsData, value: any) => void;
}

export default function AsoLocalesSection({ form, inputCls, onChange }: Props) {
  return (
    <SectionCard
      title="ASO Locales"
      desc="Comma-separated App Store Connect locale codes for multi-language ASO analysis."
    >
      <Field label="Locales" hint="e.g. en-US,de-DE,fr-FR" fullWidth>
        <input
          className={inputCls}
          type="text"
          value={form.asoLocales ?? "en-US"}
          onChange={(e) => onChange("asoLocales", e.target.value)}
          placeholder="en-US,de-DE"
        />
      </Field>
    </SectionCard>
  );
}
