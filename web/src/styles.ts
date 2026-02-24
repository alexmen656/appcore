// ─── Shared Tailwind class constants ──────────────────────────────────────────
// Single source of truth for recurring CSS class strings across all components.

// ─── Table styles ─────────────────────────────────────────────────────────────
export const TH =
  "text-left text-[11px] font-medium uppercase tracking-wide text-[#9ca3af] px-4 py-3 border-b border-[#f3f4f6] whitespace-nowrap";
export const TD =
  "px-4 py-3.5 border-b border-[#f3f4f6] text-[13px] align-middle";

// ─── Card wrapper ─────────────────────────────────────────────────────────────
export const cardCls =
  "bg-white border border-[#eef0f3] rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]";

// ─── Buttons ──────────────────────────────────────────────────────────────────
export const btnPrimary =
  "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium bg-[#ea0e2b] text-white hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed";

export const btnPrimSm =
  "inline-flex items-center gap-1.5 px-3 py-[6px] rounded-xl text-xs font-medium bg-[#ea0e2b] text-white hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed";

export const btnSecondary =
  "inline-flex items-center gap-1.5 px-3 py-[7px] rounded-xl border border-[#eef0f3] bg-transparent text-[#111827] text-[13px] font-medium transition-all hover:border-[#ea0e2b] hover:text-[#ea0e2b] disabled:opacity-50 disabled:cursor-not-allowed";

export const btnSecSm =
  "inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-xl text-xs font-medium border border-[#eef0f3] bg-white text-[#111827] hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

// ─── Inputs ───────────────────────────────────────────────────────────────────
export const inputCls =
  "w-full px-3.5 py-[9px] rounded-xl border border-[#eef0f3] bg-white text-[#111827] text-[13px] outline-none transition-colors focus:border-[#ea0e2b] font-[inherit]";

export const textareaCls =
  `${inputCls} resize-y font-mono text-xs`;

// ─── Badges ───────────────────────────────────────────────────────────────────
export const badgeVariants: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  applied: "bg-blue-50 text-blue-700",
  rejected: "bg-red-50 text-red-600",
  running: "bg-blue-50 text-blue-700",
  title: "bg-violet-50 text-violet-700",
  subtitle: "bg-sky-50 text-sky-700",
  keywords: "bg-pink-50 text-pink-700",
  description: "bg-emerald-50 text-emerald-700",
};

export const badge = (v: string) =>
  `inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium ${badgeVariants[v.toLowerCase()] ?? "bg-gray-50 text-gray-600"}`;
