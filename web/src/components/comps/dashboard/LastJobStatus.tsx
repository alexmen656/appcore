import { cardCls, badge } from "../../../styles";
import type { LastJob } from "../../../types";
export type { LastJob };

interface Props {
  lastJob: LastJob;
}

export default function LastJobStatus({ lastJob }: Props) {
  return (
    <div className={cardCls}>
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
