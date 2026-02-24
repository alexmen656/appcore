import { cardCls, badge } from "../../../styles";
import type { DashboardConfig } from "../../../types";

export type Config = DashboardConfig;

interface Props {
  config: DashboardConfig;
}

export default function ConfigurationTable({ config }: Props) {
  return (
    <div className={cardCls}>
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
