import SectionCard from "./SectionCard";
import Field from "./Field";
import { SettingsData } from "./types";

interface Props {
  form: Partial<SettingsData>;
  data: SettingsData | null;
  inputCls: string;
  textareaCls: string;
  onChange: (key: keyof SettingsData, value: any) => void;
}

export default function AscCredentialsSection({
  form,
  data,
  inputCls,
  textareaCls,
  onChange,
}: Props) {
  return (
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
            onChange={(e) => onChange("ascIssuerId", e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </Field>
        <Field label="Key ID">
          <input
            className={inputCls}
            type="text"
            value={form.ascKeyId ?? ""}
            onChange={(e) => onChange("ascKeyId", e.target.value)}
            placeholder="XXXXXXXXXX"
          />
        </Field>
        <Field
          label="Vendor Number"
          hint="Found in App Store Connect → Payments & Financial Reports"
        >
          <input
            className={inputCls}
            type="text"
            value={form.ascVendorNumber ?? ""}
            onChange={(e) => onChange("ascVendorNumber", e.target.value)}
            placeholder="12345678"
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
            onChange={(e) => onChange("ascPrivateKey", e.target.value)}
          />
        </Field>
      </div>
    </SectionCard>
  );
}
