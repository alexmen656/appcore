const card = "bg-white border border-[#e5e7eb] rounded-lg p-5";

const badgeVariants: Record<string, string> = {
  applied: "bg-blue-100 text-blue-800",
  approved: "bg-emerald-100 text-emerald-800",
  title: "bg-violet-100 text-violet-800",
  keywords: "bg-pink-100 text-pink-800",
};
const badge = (v: string) =>
  `inline-block px-2 py-0.5 rounded text-[11px] font-semibold tracking-[0.3px] ${badgeVariants[v.toLowerCase()] ?? "bg-gray-100 text-gray-700"}`;

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
      <div className="text-sm font-semibold text-[#1a1a2e] mb-4">
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
                <td className="w-40 py-3 pr-4 text-[13px] font-medium text-[#1a1a2e]">
                  {label}
                </td>
                <td className="py-3 text-[13px] text-gray-600">{val}</td>
              </tr>
            );
          })}
          <tr>
            <td className="py-3 pr-4 text-[13px] font-medium text-[#1a1a2e]">
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
