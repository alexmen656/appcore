const inputCls =
  "px-3 py-[7px] rounded-[6px] border border-[#e5e7eb] bg-white text-[#1a1a2e] text-[13px] outline-none focus:border-[#ea0e2b] transition-colors font-[inherit]";
const btnPrimSm =
  "inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-[6px] text-xs font-medium bg-[#ea0e2b] text-white hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed";

export const COUNTRIES: { code: string; label: string; lang: string }[] = [
  { code: "de", label: "🇩🇪 Deutschland", lang: "de" },
  { code: "us", label: "🇺🇸 United States", lang: "en" },
  { code: "gb", label: "🇬🇧 United Kingdom", lang: "en" },
  { code: "at", label: "🇦🇹 Österreich", lang: "de" },
  { code: "ch", label: "🇨🇭 Schweiz", lang: "de" },
  { code: "fr", label: "🇫🇷 France", lang: "fr" },
  { code: "es", label: "🇪🇸 España", lang: "es" },
  { code: "it", label: "🇮🇹 Italia", lang: "it" },
  { code: "nl", label: "🇳🇱 Netherlands", lang: "nl" },
  { code: "pl", label: "🇵🇱 Poland", lang: "pl" },
  { code: "tr", label: "🇹🇷 Türkiye", lang: "tr" },
  { code: "br", label: "🇧🇷 Brasil", lang: "pt" },
  { code: "mx", label: "🇲🇽 México", lang: "es" },
  { code: "ca", label: "🇨🇦 Canada", lang: "en" },
  { code: "au", label: "🇦🇺 Australia", lang: "en" },
  { code: "jp", label: "🇯🇵 Japan", lang: "ja" },
  { code: "kr", label: "🇰🇷 Korea", lang: "ko" },
  { code: "cn", label: "🇨🇳 China", lang: "zh" },
];

interface Props {
  newTerm: string;
  setNewTerm: (v: string) => void;
  newCountry: string;
  setNewCountry: (v: string) => void;
  adding: boolean;
  sortBy: "popularity" | "term" | "rank";
  setSortBy: (v: "popularity" | "term" | "rank") => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function KeywordForm({
  newTerm,
  setNewTerm,
  newCountry,
  setNewCountry,
  adding,
  sortBy,
  setSortBy,
  onSubmit,
}: Props) {
  return (
    <form
      onSubmit={onSubmit}
      className="flex items-center gap-2.5 flex-wrap mb-6"
    >
      <input
        className={`${inputCls} w-52`}
        type="text"
        placeholder="Add keyword to track…"
        value={newTerm}
        onChange={(e) => setNewTerm(e.target.value)}
      />
      <select
        className={`${inputCls} cursor-pointer`}
        value={newCountry}
        onChange={(e) => setNewCountry(e.target.value)}
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.label}
          </option>
        ))}
      </select>
      <button type="submit" className={btnPrimSm} disabled={adding}>
        + Add
      </button>
      <div className="flex-1" />
      <select
        className={`${inputCls} cursor-pointer`}
        value={sortBy}
        onChange={(e) =>
          setSortBy(e.target.value as "popularity" | "term" | "rank")
        }
      >
        <option value="popularity">Sort by Popularity</option>
        <option value="rank">Sort by Rank</option>
        <option value="term">Sort by Term</option>
      </select>
    </form>
  );
}
