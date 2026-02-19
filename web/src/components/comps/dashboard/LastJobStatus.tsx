const card = "bg-white border border-[#e5e7eb] rounded-lg p-5";

const badgeVariants: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-700",
};
const badge = (v: string) =>
  `inline-block px-2 py-0.5 rounded text-[11px] font-semibold tracking-[0.3px] ${badgeVariants[v.toLowerCase()] ?? "bg-gray-100 text-gray-700"}`;

export interface LastJob {
  type: string;
  status: string;
  createdAt: string;
  itemsCount: number;
}

interface Props {
  lastJob: LastJob;
}

export default function LastJobStatus({ lastJob }: Props) {
  return (
    <div className={card}>
      <div className="text-sm font-semibold text-[#1a1a2e] mb-2">Last Job</div>
      <div className="text-sm text-gray-500 flex items-center gap-2">
        <span
          className={badge(
            lastJob.status === "COMPLETED"
              ? "approved"
              : lastJob.status === "FAILED"
                ? "rejected"
                : "pending",
          )}
        >
          {lastJob.status}
        </span>
        {lastJob.type} &middot; {lastJob.itemsCount} items &middot;{" "}
        {new Date(lastJob.createdAt).toLocaleString()}
      </div>
    </div>
  );
}
