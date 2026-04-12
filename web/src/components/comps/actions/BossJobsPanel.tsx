import { useState } from "react";
import { useApi, apiPost } from "../../../hooks/useApi";
import { TH, TD, cardCls, btnSecSm, btnPrimSm, badge } from "../../../styles";

interface BossJob {
  id: string;
  name: string;
  state: string;
  data: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  retry_count: number;
  created_on: string;
  started_on: string | null;
  completed_on: string | null;
}

interface BossSchedule {
  name: string;
  cron: string;
  timezone: string;
  updated_on: string;
}

const QUEUES = ["scrape", "track-keywords", "sync-analytics"] as const;

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

function shortId(id: string) {
  return id.slice(0, 8) + "…";
}

export default function BossJobsPanel({ addToast }: Props) {
  const [selectedQueue, setSelectedQueue] = useState<string>("");
  const [sending, setSending] = useState<string | null>(null);

  const queueParam = selectedQueue ? `?queue=${selectedQueue}` : "";
  const { data: jobs, refetch: refetchJobs } = useApi<BossJob[]>(
    `/boss/jobs${queueParam}`,
    [selectedQueue],
    true,
  );
  const { data: schedules, refetch: refetchSchedules } = useApi<BossSchedule[]>(
    "/boss/schedules",
    [],
    true,
  );

  const triggerDispatch = async (queue: string) => {
    setSending(queue);
    try {
      const res = await apiPost("/boss/send", { queue });
      addToast(res.message ?? `${queue} dispatched`, "success");
      setTimeout(refetchJobs, 1500);
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="mt-10 space-y-8">
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-[#111827] dark:text-[#e8eaf0]">
            pg-boss Schedules
          </span>
          <button className={btnSecSm} onClick={refetchSchedules}>
            Refresh
          </button>
        </div>
        <div className={cardCls + " overflow-hidden p-0"}>
          {!schedules || schedules.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#9ca3af] dark:text-[#5c6478]">
              No schedules registered yet
            </p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={TH}>Queue</th>
                  <th className={TH}>Cron</th>
                  <th className={TH}>Timezone</th>
                  <th className={TH}>Updated</th>
                  <th className={TH}>Trigger</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => {
                  const queue = s.name.replace(/\/dispatch$/, "");
                  const isDispatch = s.name.endsWith("/dispatch");
                  return (
                    <tr
                      key={s.name}
                      className="hover:bg-gray-50/60 dark:hover:bg-white/[0.03]"
                    >
                      <td
                        className={`${TD} font-mono text-xs text-[#111827] dark:text-[#e8eaf0]`}
                      >
                        {s.name}
                      </td>
                      <td
                        className={`${TD} font-mono text-xs text-[#6b7280] dark:text-[#8b93a5]`}
                      >
                        {s.cron}
                      </td>
                      <td
                        className={`${TD} text-xs text-[#9ca3af] dark:text-[#5c6478]`}
                      >
                        {s.timezone}
                      </td>
                      <td
                        className={`${TD} text-xs text-[#9ca3af] dark:text-[#5c6478]`}
                      >
                        {fmtDate(s.updated_on)}
                      </td>
                      <td className={TD}>
                        {isDispatch && (
                          <button
                            className={btnPrimSm}
                            disabled={!!sending}
                            onClick={() => triggerDispatch(queue)}
                          >
                            {sending === queue ? "Dispatching…" : "Run now"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-semibold text-[#111827] dark:text-[#e8eaf0] mr-auto">
            pg-boss Jobs
          </span>
          <select
            className="text-xs rounded-xl border border-[#eef0f3] dark:border-[#2a2f3d] bg-white dark:bg-[#1c2028] text-[#111827] dark:text-[#e8eaf0] px-2.5 py-1.5 focus:outline-none"
            value={selectedQueue}
            onChange={(e) => setSelectedQueue(e.target.value)}
          >
            <option value="">All queues</option>
            {QUEUES.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
          <button className={btnSecSm} onClick={refetchJobs}>
            Refresh
          </button>
        </div>
        <div className={cardCls + " overflow-hidden p-0"}>
          {!jobs || jobs.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#9ca3af] dark:text-[#5c6478]">
              No jobs found
            </p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={TH}>ID</th>
                  <th className={TH}>Queue</th>
                  <th className={TH}>State</th>
                  <th className={TH}>App</th>
                  <th className={TH}>Retries</th>
                  <th className={TH}>Created</th>
                  <th className={TH}>Completed</th>
                  <th className={TH}>Error</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const bundleId =
                    (j.data?.bundleId as string) ??
                    (j.data?.appId as string) ??
                    null;
                  const errMsg =
                    j.state === "failed"
                      ? ((j.output as any)?.message ??
                        JSON.stringify(j.output ?? ""))
                      : null;
                  return (
                    <tr
                      key={j.id}
                      className="hover:bg-gray-50/60 dark:hover:bg-white/[0.03]"
                    >
                      <td
                        className={`${TD} font-mono text-xs text-[#9ca3af] dark:text-[#5c6478]`}
                        title={j.id}
                      >
                        {shortId(j.id)}
                      </td>
                      <td
                        className={`${TD} font-mono text-xs text-[#111827] dark:text-[#e8eaf0]`}
                      >
                        {j.name}
                      </td>
                      <td className={TD}>
                        <span className={badge(j.state)}>{j.state}</span>
                      </td>
                      <td
                        className={`${TD} text-xs text-[#6b7280] dark:text-[#8b93a5]`}
                      >
                        {bundleId ?? "—"}
                      </td>
                      <td
                        className={`${TD} text-xs text-[#9ca3af] dark:text-[#5c6478]`}
                      >
                        {j.retry_count}
                      </td>
                      <td
                        className={`${TD} text-xs text-[#9ca3af] dark:text-[#5c6478]`}
                      >
                        {fmtDate(j.created_on)}
                      </td>
                      <td
                        className={`${TD} text-xs text-[#9ca3af] dark:text-[#5c6478]`}
                      >
                        {fmtDate(j.completed_on)}
                      </td>
                      <td
                        className={`${TD} text-xs text-red-500 max-w-[180px] truncate`}
                        title={errMsg ?? undefined}
                      >
                        {errMsg ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
