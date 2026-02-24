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
    <div className="bg-white border border-[#eef0f3] rounded-2xl p-6 mb-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <h2 className="text-[15px] font-semibold text-[#111827] mb-1">{title}</h2>
      {desc && <p className="text-xs text-[#9ca3af] mb-5">{desc}</p>}
      {children}
    </div>
  );
}
