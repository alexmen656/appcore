// ─── Shared formatting utilities ──────────────────────────────────────────────

/** Short date: "24.02" */
export function fmtShortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Medium date: "24 Feb 2026" */
export function fmtMediumDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Date + time: "24 Feb, 14:30" */
export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Locale-formatted number (1,234) or "—" */
export function fmtNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

/** Large numbers: 1.2M, 3.4k */
export function fmtLargeNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

/** Currency (USD): "$1,234.56" or "—" */
export function fmtRevenue(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

/** Short revenue for chart axes: "$1.2k" */
export function fmtRevenueShort(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

/** Percentage: "42.1%" or "—" */
export function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n.toFixed(1)}%`;
}

/** Country code → display name */
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
export function countryName(code: string): string {
  if (code === "WW") return "Worldwide";
  if (code.length !== 2 || !/^[A-Z]{2}$/.test(code.toUpperCase())) return code;
  try {
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
