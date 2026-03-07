export const TH =
  "text-left text-[11px] font-medium uppercase tracking-wide text-[#9ca3af] dark:text-[#5c6478] px-4 py-3 border-b border-[#f3f4f6] dark:border-[#2a2f3d] whitespace-nowrap";

export const TD =
  "px-4 py-3.5 border-b border-[#f3f4f6] dark:border-[#2a2f3d] text-[13px] align-middle";

export const cardCls =
  "bg-white dark:bg-[#1c2028] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)]";

export const btnPrimary =
  "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium bg-[#ea0e2b] text-white hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed";

export const btnPrimSm =
  "inline-flex items-center gap-1.5 px-3 py-[6px] rounded-xl text-xs font-medium bg-[#ea0e2b] text-white hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed";

export const btnSecondary =
  "inline-flex items-center gap-1.5 px-3 py-[7px] rounded-xl border border-[#eef0f3] dark:border-[#2a2f3d] bg-transparent text-[#111827] dark:text-[#e8eaf0] text-[13px] font-medium transition-all hover:border-[#ea0e2b] hover:text-[#ea0e2b] disabled:opacity-50 disabled:cursor-not-allowed";

export const btnSecSm =
  "inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-xl text-xs font-medium border border-[#eef0f3] dark:border-[#2a2f3d] bg-white dark:bg-[#1c2028] text-[#111827] dark:text-[#e8eaf0] hover:bg-gray-50 dark:hover:bg-[#252b38] transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

export const inputCls =
  "w-full px-3.5 py-[9px] rounded-xl border border-[#eef0f3] dark:border-[#2a2f3d] bg-white dark:bg-[#1c2028] text-[#111827] dark:text-[#e8eaf0] text-[13px] outline-none transition-colors focus:border-[#ea0e2b] font-[inherit] placeholder:text-[#9ca3af] dark:placeholder:text-[#5c6478]";

export const textareaCls = `${inputCls} resize-y font-mono text-xs`;

export const badgeVariants: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
  applied: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  rejected: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
  running: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  title: "bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400",
  subtitle: "bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400",
  keywords: "bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400",
  description: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
};

export const badge = (v: string) =>
  `inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium ${badgeVariants[v.toLowerCase()] ?? "bg-gray-50 text-gray-600 dark:bg-[#252b38] dark:text-[#8b93a5]"}`;
