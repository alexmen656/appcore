import { TH, TD, btnSecSm, badge } from "../../../styles";
import type { Job } from "../../../types";
export type { Job };

interface Props {
  jobs: Job[] | null;
  onRefresh: () => void;
}

export default function JobHistoryTable({ jobs, onRefresh }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-[#111827]">Job History</div>
        <button className={btnSecSm} onClick={onRefresh}>
          Refresh
        </button>
      </div>
      {!jobs || jobs.length === 0 ? (
        <div className="py-16 text-center">
          <div className="flex justify-center mb-3 opacity-20">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-[#9ca3af]">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <div className="text-sm font-medium text-[#6b7280] mb-1">
            No jobs recorded yet
          </div>
          <div className="text-xs text-[#9ca3af]">
            Trigger an action above to create a job
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#eef0f3] rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>Type</th>
                <th className={TH}>Status</th>
                <th className={TH}>Items</th>
                <th className={TH}>Started</th>
                <th className={TH}>Completed</th>
                <th className={TH}>Error</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="hover:bg-gray-50/60">
                  <td className={`${TD} font-medium text-[#111827]`}>
                    {j.type}
                  </td>
                  <td className={TD}>
                    <span className={badge(j.status)}>{j.status}</span>
                  </td>
                  <td className={`${TD} text-[#6b7280]`}>{j.itemsCount}</td>
                  <td className={`${TD} text-xs text-[#9ca3af]`}>
                    {j.startedAt ? new Date(j.startedAt).toLocaleString() : "—"}
                  </td>
                  <td className={`${TD} text-xs text-[#9ca3af]`}>
                    {j.completedAt
                      ? new Date(j.completedAt).toLocaleString()
                      : "—"}
                  </td>
                  <td
                    className={`${TD} text-xs text-red-500 max-w-[200px] truncate`}
                  >
                    {j.error || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
