import { borderDefault, textSecondary } from "../../styles";
interface Props {
  locales: string[];
  groups: Record<string, any[]>;
  currentLocale: string;
  onSelect: (loc: string) => void;
}

export default function LocalePills({ locales, groups, currentLocale, onSelect }: Props) {
  if (locales.length === 0) return null;
  return (
    <div className="flex gap-2 flex-wrap mb-5">
      {locales.map((loc) => (
        <button
          key={loc}
          className={
            currentLocale === loc
              ? "px-3.5 py-1.5 rounded-full border text-[13px] font-medium cursor-pointer transition-colors bg-[#111827] dark:bg-[#e8eaf0] border-[#111827] dark:border-[#e8eaf0] text-white dark:text-[#111827]"
              : `px-3.5 py-1.5 rounded-full border text-[13px] font-medium cursor-pointer transition-colors bg-white dark:bg-[#1c2028] ${borderDefault} ${textSecondary} hover:border-[#d1d5db] dark:hover:border-[#5c6478] hover:text-[#111827] dark:hover:text-[#e8eaf0]`
          }
          onClick={() => onSelect(loc)}
        >
          {loc} <span className="opacity-70">({groups[loc]?.length || 0})</span>
        </button>
      ))}
    </div>
  );
}
