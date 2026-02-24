const card = "bg-white border border-[#eef0f3] rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]";

const badgeVariants: Record<string, string> = {
  applied: "bg-blue-50 text-blue-700",
  approved: "bg-emerald-50 text-emerald-700",
  title: "bg-violet-50 text-violet-700",
  keywords: "bg-pink-50 text-pink-700",
};
const badge = (v: string) =>
  `inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium ${badgeVariants[v.toLowerCase()] ?? "bg-gray-50 text-gray-600"}`;

export interface Config {
  bundleId: string;
  country: string;
  locales: string;
  aiProvider: string;
  hasOpenAI: boolean;
  hasAnthropic: boolean;
  hasASC: boolean;
  hasSearchAds: boolean;
  scrapeInterval: number;
}

interface Props {
  config: Config;
}

export default function ConfigurationTable({ config }: Props) {
  return (
    <div className={card}>
      <div className="text-xs font-medium uppercase tracking-wide text-[#9ca3af] mb-4">
        Configuration
      </div>
      <table className="w-full border-collapse">
        <tbody>
          {(
            ["AI Provider", "Country", "Locales", "Scrape Interval"] as const
          ).map((label, i) => {
            const val = [
              config.aiProvider,
              config.country,
              config.locales,
              `${config.scrapeInterval}h`,
            ][i];
            return (
              <tr
                key={label}
                className="border-b border-[#f0f0f0] last:border-0"
              >
                <td className="w-40 py-3 pr-4 text-[13px] font-medium text-[#111827]">
                  {label}
                </td>
                <td className="py-3 text-[13px] text-[#6b7280]">{val}</td>
              </tr>
            );
          })}
          <tr>
            <td className="py-3 pr-4 text-[13px] font-medium text-[#111827]">
              Integrations
            </td>
            <td className="py-3 flex gap-1.5 flex-wrap">
              {config.hasOpenAI && (
                <span className={badge("applied")}>OpenAI</span>
              )}
              {config.hasAnthropic && (
                <span className={badge("approved")}>Anthropic</span>
              )}
              {config.hasASC && <span className={badge("title")}>ASC</span>}
              {config.hasSearchAds && (
                <span className={badge("keywords")}>Search Ads</span>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
