import { inputCls, btnPrimSm, btnPrimary } from "../../styles";
import { COUNTRIES } from "./storefronts";

export { COUNTRIES } from "./storefronts";

interface Props {
  newTerm: string;
  setNewTerm: (v: string) => void;
  newCountry: string;
  setNewCountry: (v: string) => void;
  adding: boolean;
  filterCountry: string;
  setFilterCountry: (v: string) => void;
  availableCountries: string[];
  onSubmit: (e: React.FormEvent) => void;
}

export default function KeywordForm({
  newTerm,
  setNewTerm,
  newCountry,
  setNewCountry,
  adding,
  filterCountry,
  setFilterCountry,
  availableCountries,
  onSubmit,
}: Props) {
  return (
    <div className="flex items-center gap-2.5 flex-wrap mb-6">
      <form onSubmit={onSubmit} className="flex items-center gap-2.5">
        <input
          className={`${inputCls} w-100`}
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
        <button type="submit" className={`${btnPrimary} w-100`} disabled={adding}>
          + Add
        </button>
      </form>
      <div className="flex-1" />
      {availableCountries.length > 1 && (
        <select
          className={`${inputCls} cursor-pointer`}
          value={filterCountry}
          onChange={(e) => setFilterCountry(e.target.value)}
        >
          <option value="">All Markets</option>
          {availableCountries.map((code) => {
            const label = COUNTRIES.find((c) => c.code === code)?.label ?? code.toUpperCase();
            return (
              <option key={code} value={code}>
                {label}
              </option>
            );
          })}
        </select>
      )}
    </div>
  );
}
