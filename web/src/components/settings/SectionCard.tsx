import { useState } from "react";
import { Info } from "lucide-react";
import { borderDefault, textPrimary } from "../../styles";

export default function SectionCard({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`bg-white dark:bg-[#1c2028] border ${borderDefault} rounded-2xl p-5 mb-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)]`}
    >
      <div className="flex items-center gap-1.5 mb-5">
        <h2 className={`text-[18px] font-semibold ${textPrimary}`}>{title}</h2>
        {desc && (
          <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
            <button
              type="button"
              aria-label={desc}
              onClick={(e) => {
                e.preventDefault();
                setOpen((v) => !v);
              }}
              className="text-gray-400 dark:text-[#5c6478] hover:text-gray-600 dark:hover:text-[#8b93a5] transition-colors"
            >
              <Info className="w-4 h-4" />
            </button>
            {open && (
              <span className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+6px)] z-20 w-64 px-3 py-2 rounded-lg bg-[#1a1a2e] dark:bg-[#252b38] text-white text-[11px] leading-relaxed shadow-lg pointer-events-none">
                {desc}
              </span>
            )}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
