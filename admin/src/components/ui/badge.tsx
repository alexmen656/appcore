import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "brand";

function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: BadgeVariant }) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variant === "default" && "border-transparent bg-primary text-primary-foreground shadow",
        variant === "secondary" && "border-transparent bg-secondary text-secondary-foreground",
        variant === "destructive" && "border-transparent bg-destructive text-white shadow",
        variant === "outline" && "text-foreground",
        variant === "success" && "border-transparent bg-success/15 text-success",
        variant === "warning" && "border-transparent bg-warning/20 text-warning",
        variant === "brand" && "border-transparent bg-brand/15 text-brand",
        className,
      )}
      {...props}
    />
  );
}

// --- Semantic / deterministic coloring for enum & status values -------------

const GREEN = "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
const RED = "border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300";
const AMBER = "border-transparent bg-amber-500/20 text-amber-700 dark:text-amber-300";
const VIOLET = "border-transparent bg-violet-500/15 text-violet-700 dark:text-violet-300";
const BLUE = "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-300";
const SLATE = "border-transparent bg-slate-500/15 text-slate-600 dark:text-slate-300";

const PALETTE = [
  BLUE,
  GREEN,
  VIOLET,
  AMBER,
  "border-transparent bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  "border-transparent bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
  "border-transparent bg-teal-500/15 text-teal-700 dark:text-teal-300",
  "border-transparent bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  "border-transparent bg-orange-500/15 text-orange-700 dark:text-orange-300",
  "border-transparent bg-lime-500/20 text-lime-700 dark:text-lime-300",
  "border-transparent bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "border-transparent bg-pink-500/15 text-pink-700 dark:text-pink-300",
];

const SEMANTIC: Record<string, string> = {
  // positive / active
  active: GREEN,
  completed: GREEN,
  complete: GREEN,
  accepted: GREEN,
  enabled: GREEN,
  connected: GREEN,
  success: GREEN,
  succeeded: GREEN,
  paid: GREEN,
  live: GREEN,
  published: GREEN,
  approved: GREEN,
  ready: GREEN,
  done: GREEN,
  yes: GREEN,
  true: GREEN,
  owner: GREEN,
  // negative / terminal
  failed: RED,
  error: RED,
  cancelled: RED,
  canceled: RED,
  disabled: RED,
  missing: RED,
  expired: RED,
  rejected: RED,
  deleted: RED,
  banned: RED,
  inactive: RED,
  blocked: RED,
  no: RED,
  false: RED,
  unpaid: RED,
  past_due: RED,
  // in progress / caution
  pending: AMBER,
  retry: AMBER,
  created: AMBER,
  waiting: AMBER,
  draft: AMBER,
  queued: AMBER,
  processing: AMBER,
  trialing: AMBER,
  trial: AMBER,
  paused: AMBER,
  scheduled: AMBER,
  running: AMBER,
  // roles
  admin: VIOLET,
  member: BLUE,
  viewer: SLATE,
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function autoBadgeClass(value: string): string {
  const key = value.trim().toLowerCase();
  if (key in SEMANTIC) return SEMANTIC[key];
  return PALETTE[hashString(key) % PALETTE.length];
}

export function AutoBadge({ value, className }: { value: React.ReactNode; className?: string }) {
  const text = String(value);
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md border px-2.5 py-0.5 text-xs font-semibold",
        autoBadgeClass(text),
        className,
      )}
    >
      {text}
    </span>
  );
}

export { Badge };
