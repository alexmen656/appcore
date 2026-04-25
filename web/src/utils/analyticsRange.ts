export type RangeKey = "7d" | "14d" | "30d" | "90d" | "180d" | "365d" | "ytd" | "all" | "custom";

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7d" },
  { key: "14d", label: "14d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "180d", label: "180d" },
  { key: "365d", label: "1y" },
  { key: "ytd", label: "YTD" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom" },
];

export function rangeToParams(range: RangeKey, customStart?: string, customEnd?: string): string {
  if (range === "all") return "&period=all";
  if (range === "ytd") return "&period=ytd";
  if (range === "custom") {
    const parts: string[] = [];
    if (customStart) parts.push(`startDate=${customStart}`);
    if (customEnd) parts.push(`endDate=${customEnd}`);
    return parts.length ? "&" + parts.join("&") : "&days=30";
  }
  const days = parseInt(range, 10);
  return `&days=${days}`;
}

export function rangeLabel(range: RangeKey): string {
  const map: Record<RangeKey, string> = {
    "7d": "last 7 days",
    "14d": "last 14 days",
    "30d": "last 30 days",
    "90d": "last 90 days",
    "180d": "last 180 days",
    "365d": "last 12 months",
    ytd: "year to date",
    all: "all time",
    custom: "custom range",
  };
  return map[range];
}

export function prevPeriodParams(range: RangeKey, customStart?: string, customEnd?: string): string | null {
  if (range === "all" || range === "ytd") return null;
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (range === "custom") {
    if (!customStart || !customEnd) return null;
    const start = new Date(customStart);
    const end = new Date(customEnd);
    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - days + 1);
    return `&startDate=${fmt(prevStart)}&endDate=${fmt(prevEnd)}`;
  }
  const days = parseInt(range, 10);
  const today = new Date();
  const prevEnd = new Date(today);
  prevEnd.setDate(prevEnd.getDate() - days);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - days + 1);
  return `&startDate=${fmt(prevStart)}&endDate=${fmt(prevEnd)}`;
}
