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

export { Badge };
