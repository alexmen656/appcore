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
          className={
            currentLocale === loc
              ? "px-3 py-1 rounded-full border text-[13px] font-medium cursor-pointer transition-colors bg-[#1a1a2e] border-[#1a1a2e] text-white"
              : "px-3 py-1 rounded-full border text-[13px] font-medium cursor-pointer transition-colors bg-white border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-800"
          }
          onClick={() => onSelect(loc)}
        >
          {loc} <span className="opacity-70">({groups[loc]?.length || 0})</span>
        </button>
      ))}
    </div>
  );
}
