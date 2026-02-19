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
    <div className="bg-white border border-[#e5e7eb] rounded-xl p-6 mb-5">
      <h2 className="text-[15px] font-semibold text-[#1a1a2e] mb-1">{title}</h2>
      {desc && <p className="text-xs text-gray-400 mb-5">{desc}</p>}
      {children}
    </div>
  );
}
