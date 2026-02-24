import { inputCls, btnPrimSm } from "../../../styles";

export const COUNTRIES: { code: string; label: string; lang: string }[] = [
  { code: "de", label: "DE — Deutschland", lang: "de" },
  { code: "us", label: "US — United States", lang: "en" },
  { code: "gb", label: "GB — United Kingdom", lang: "en" },
  { code: "at", label: "AT — Österreich", lang: "de" },
  { code: "ch", label: "CH — Schweiz", lang: "de" },
  { code: "fr", label: "FR — France", lang: "fr" },
  { code: "es", label: "ES — España", lang: "es" },
  { code: "it", label: "IT — Italia", lang: "it" },
  { code: "nl", label: "NL — Netherlands", lang: "nl" },
  { code: "pl", label: "PL — Poland", lang: "pl" },
  { code: "tr", label: "TR — Türkiye", lang: "tr" },
  { code: "br", label: "BR — Brasil", lang: "pt" },
  { code: "mx", label: "MX — México", lang: "es" },
  { code: "ca", label: "CA — Canada", lang: "en" },
  { code: "au", label: "AU — Australia", lang: "en" },
  { code: "jp", label: "JP — Japan", lang: "ja" },
  { code: "kr", label: "KR — Korea", lang: "ko" },
  { code: "cn", label: "CN — China", lang: "zh" },
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
