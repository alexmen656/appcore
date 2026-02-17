import { useState } from "react";
import { apiPost, useApi } from "../hooks/useApi";

const TH = "text-left text-[11px] font-semibold uppercase tracking-[0.5px] text-gray-400 px-3.5 py-2.5 border-b border-[#e5e7eb] whitespace-nowrap";
const TD = "px-3.5 py-3 border-b border-[#f0f0f0] text-[13px] align-middle";
const badgeVariants: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  applied:  "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-700",
  running:  "bg-blue-100 text-blue-700",
};
const badge = (v: string) =>
  `inline-block px-2 py-0.5 rounded text-[11px] font-semibold tracking-[0.3px] ${badgeVariants[v.toLowerCase()] ?? "bg-gray-100 text-gray-700"}`;
const btnPrimSm = "inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-[6px] text-xs font-medium bg-[#ea0e2b] text-white hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecSm  = "inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-[6px] text-xs font-medium border border-[#e5e7eb] bg-white text-[#1a1a2e] hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

interface Job {
  id: string; type: string; status: string; result: string | null;
  error: string | null; itemsCount: number;
  startedAt: string | null; completedAt: string | null; createdAt: string;
}
interface Props { addToast: (msg: string, type: "success" | "error" | "info") => void; }

interface ActionCard {
  id: string; label: string; title: string; desc: string; primary?: boolean;
}

const ACTION_CARDS: ActionCard[] = [
  { id: "scrape",         label: "Scrape",   title: "Discover Competitors",         desc: "Scrape iTunes API for competitor apps and save snapshots." },
  { id: "analyze",        label: "Analyze",  title: "AI ASO Analysis",              desc: "Generate multi-locale ASO suggestions using AI.", primary: true },
  { id: "sync",           label: "Sync",     title: "Sync with App Store Connect",  desc: "Pull current ASO state (title, subtitle, keywords) from ASC." },
  { id: "track-keywords", label: "Track",    title: "Track Keywords",               desc: "Check current rankings for all tracked keywords." },
];

export default function Actions({ addToast }: Props) {
  const { data: jobs, refetch } = useApi<Job[]>("/actions/jobs");
  const [running, setRunning] = useState<string | null>(null);

  const triggerAction = async (endpoint: string, label: string) => {
    setRunning(endpoint);
    try {
      const res = await apiPost(`/actions/${endpoint}`, {});
      addToast(res.message || `${label} started`, "success");
      setTimeout(refetch, 2000);
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setRunning(null);
    }
  };

  const statusBadge = (status: string) => badge(status.toLowerCase());

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-[#1a1a2e] mb-1">Actions</h1>
      <p className="text-base text-gray-500 mb-7">Manually trigger scraping, analysis, and sync operations</p>

      {/* Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {ACTION_CARDS.map((ac) => {
          const isRunning = running === ac.id;
          return (
            <div key={ac.id} className="bg-white border border-[#e5e7eb] rounded-lg p-5 flex flex-col justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">{ac.label}</div>
                <div className="text-[15px] font-semibold text-[#1a1a2e] mb-2">
                  {isRunning ? "Running…" : ac.title}
                </div>
                <div className="text-xs text-gray-500 leading-relaxed">{ac.desc}</div>
              </div>
              <button
                className={ac.primary ? btnPrimSm : btnSecSm}
                disabled={!!running}
                onClick={() => !running && triggerAction(ac.id, ac.label)}
              >
                {isRunning ? "⏳ Running…" : `▶ Run ${ac.label}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Job History */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-[#1a1a2e]">Job History</div>
          <button className={btnSecSm} onClick={refetch}>Refresh</button>
        </div>

        {!jobs || jobs.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3 opacity-30">📊</div>
            <div className="text-sm font-medium text-gray-500 mb-1">No jobs recorded yet</div>
            <div className="text-xs text-gray-400">Trigger an action above to create a job</div>
          </div>
        ) : (
          <div className="bg-white border border-[#e5e7eb] rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr><th className={TH}>Type</th><th className={TH}>Status</th><th className={TH}>Items</th><th className={TH}>Started</th><th className={TH}>Completed</th><th className={TH}>Error</th></tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-gray-50/60">
                    <td className={`${TD} font-medium text-[#1a1a2e]`}>{j.type}</td>
                    <td className={TD}><span className={statusBadge(j.status)}>{j.status}</span></td>
                    <td className={`${TD} text-gray-500`}>{j.itemsCount}</td>
                    <td className={`${TD} text-xs text-gray-400`}>{j.startedAt ? new Date(j.startedAt).toLocaleString() : "—"}</td>
                    <td className={`${TD} text-xs text-gray-400`}>{j.completedAt ? new Date(j.completedAt).toLocaleString() : "—"}</td>
                    <td className={`${TD} text-xs text-red-500 max-w-[200px] truncate`}>{j.error || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
