import { inputCls, btnPrimSm } from "../../../styles";
import { COUNTRIES } from "./storefronts";

export { COUNTRIES } from "./storefronts";

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
