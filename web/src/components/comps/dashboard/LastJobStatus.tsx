const card = "bg-white border border-[#eef0f3] rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]";

const badgeVariants: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-600",
};
const badge = (v: string) =>
  `inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium ${badgeVariants[v.toLowerCase()] ?? "bg-gray-50 text-gray-600"}`;

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
      <div className="text-xs font-medium uppercase tracking-wide text-[#9ca3af] mb-2">Last Job</div>
      <div className="text-sm text-[#6b7280] flex items-center gap-2">
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
