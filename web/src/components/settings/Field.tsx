export default function Field({
  label,
  hint,
  children,
  fullWidth,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "col-span-2" : ""}>
      <label className="text-sm font-medium text-[#111827] dark:text-[#e8eaf0] block mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-[#9ca3af] dark:text-[#5c6478] mb-1.5">{hint}</p>}
    </div>
  );
}
