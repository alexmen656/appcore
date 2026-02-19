import SectionCard from "./SectionCard";
import Field from "./Field";
import { SettingsData } from "./types";

interface Props {
  form: Partial<SettingsData>;
  inputCls: string;
  onChange: (key: keyof SettingsData, value: any) => void;
}

export default function ScrapingConfigSection({
  form,
  inputCls,
  onChange,
}: Props) {
  return (
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
              onChange("scrapeCountry", e.target.value.toLowerCase())
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
              onChange("scrapeIntervalHours", Number(e.target.value))
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
            onChange={(e) => onChange("maxCompetitors", Number(e.target.value))}
          />
        </Field>
      </div>
    </SectionCard>
  );
}
