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
              ? "px-3.5 py-1.5 rounded-full border text-[13px] font-medium cursor-pointer transition-colors bg-[#111827] border-[#111827] text-white"
              : "px-3.5 py-1.5 rounded-full border text-[13px] font-medium cursor-pointer transition-colors bg-white border-[#eef0f3] text-[#6b7280] hover:border-[#d1d5db] hover:text-[#111827]"
          }
          onClick={() => onSelect(loc)}
        >
          {loc} <span className="opacity-70">({groups[loc]?.length || 0})</span>
        </button>
      ))}
    </div>
  );
}
