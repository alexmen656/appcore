import { badge, cardCls, textMuted, textSecondary } from "../../styles";
import type { LastJob } from "../../types";
export type { LastJob };

interface Props {
  lastJob: LastJob;
}

export default function LastJobStatus({ lastJob }: Props) {
  return (
    <div className={cardCls}>
      <div
        className={`text-xs font-medium uppercase tracking-wide ${textMuted} mb-2`}
      >
        Last Job
      </div>
      <div className={`text-sm ${textSecondary} flex items-center gap-2`}>
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
