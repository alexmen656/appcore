interface Props {
  locales: string[];
  groups: Record<string, any[]>;
  currentLocale: string;
  onSelect: (loc: string) => void;
}

export default function LocalePills({
  locales,
  groups,
  currentLocale,
  onSelect,
}: Props) {
  if (locales.length === 0) return null;
  return (
    <div className="flex gap-2 flex-wrap mb-5">
      {locales.map((loc) => (
        <button
          key={loc}
          className={`locale-pill${currentLocale === loc ? " active" : ""}`}
          onClick={() => onSelect(loc)}
        >
          {loc} <span className="opacity-70">({groups[loc]?.length || 0})</span>
        </button>
      ))}
    </div>
  );
}
