import { useRef, useState, useCallback, useMemo } from "react";
import { ChevronDown, Globe } from "lucide-react";
import { borderDefault, textMuted, textPrimary, textSecondary } from "../../styles";
import { useClickOutside } from "../../hooks/useClickOutside";
import { countryName } from "../../utils/formatters";
import { LANGUAGE_BY_COUNTRY } from "./storefronts";

const languageNames = new Intl.DisplayNames(["en"], { type: "language" });
const languageLabel = (country: string): string => {
  const lang = LANGUAGE_BY_COUNTRY[country] ?? "en";
  try {
    return languageNames.of(lang) ?? lang.toUpperCase();
  } catch {
    return lang.toUpperCase();
  }
};

interface Props {
  value: string;
  options: string[];
  onChange: (code: string) => void;
}

export default function MarketSelector({ value, options, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(
    ref,
    useCallback(() => setOpen(false), []),
  );

  const sorted = useMemo(() => [...options].sort((a, b) => countryName(a).localeCompare(countryName(b))), [options]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-2 pl-3 pr-2.5 py-[7px] rounded-full border bg-white dark:bg-[#1c2028] text-[13px] font-medium ${textPrimary} transition-all ${
          open
            ? "border-blue-500 ring-2 ring-blue-500/20 dark:border-blue-400 dark:ring-blue-400/25"
            : `${borderDefault} hover:border-gray-300 dark:hover:border-[#3a4050]`
        }`}
      >
        {value ? (
          <img
            src={`/country-flags/${value.toLowerCase()}.svg`}
            alt={value}
            className="w-4 h-3 rounded-xs object-cover shrink-0"
          />
        ) : (
          <Globe className={`w-4 h-4 ${textSecondary}`} />
        )}
        <span>
          {value ? (
            <>
              {countryName(value)} <span className={textMuted}>·</span> {languageLabel(value)}
            </>
          ) : (
            "All Markets"
          )}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 ${textMuted} transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          className={`absolute right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#1c2028] border ${borderDefault} rounded-xl shadow-lg py-1 min-w-[220px] max-h-[320px] overflow-auto`}
        >
          <button
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] ${textPrimary} hover:bg-[#fafbfc] dark:hover:bg-[#252b38] transition-colors text-left ${
              value === "" ? "font-semibold" : ""
            }`}
          >
            <Globe className={`w-4 h-4 ${textSecondary} shrink-0`} />
            All Markets
          </button>
          <div className={`my-1 border-t ${borderDefault}`} />
          {sorted.map((code) => (
            <button
              key={code}
              onClick={() => {
                onChange(code);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] ${textPrimary} hover:bg-[#fafbfc] dark:hover:bg-[#252b38] transition-colors text-left ${
                value === code ? "font-semibold" : ""
              }`}
            >
              <img
                src={`/country-flags/${code.toLowerCase()}.svg`}
                alt={code}
                className="w-4 h-3 rounded-xs object-cover shrink-0"
              />
              <span className="truncate">
                {countryName(code)} <span className={textMuted}>·</span> {languageLabel(code)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
