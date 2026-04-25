import { borderDefault, textMuted, textPrimary } from "../../styles";
export default function SectionCard({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-white dark:bg-[#1c2028] border ${borderDefault} rounded-2xl p-5 mb-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)]`}
    >
      <h2 className={`text-[18px] font-semibold ${textPrimary} mb-1`}>{title}</h2>
      {desc && <p className={`text-xs ${textMuted} mb-5`}>{desc}</p>}
      {children}
    </div>
  );
}
