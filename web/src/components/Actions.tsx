import { useState } from "react";
import { apiPost, useApi, getActiveBundleId } from "../hooks/useApi";
import ActionCard, { ActionCardDef } from "./comps/actions/ActionCard";
import JobHistoryTable, { Job } from "./comps/actions/JobHistoryTable";
import BossJobsPanel from "./comps/actions/BossJobsPanel";
import { ScreenshotJobsTable, BuildJobsTable } from "./Screenshots";
import type { AppItem } from "../types";

const ACTION_CARDS: ActionCardDef[] = [
  {
    id: "scrape",
    label: "Scrape",
    title: "Discover Competitors",
    desc: "Scrape iTunes API for competitor apps and save snapshots.",
  },
  {
    id: "analyze",
    label: "Analyze",
    title: "AI ASO Analysis",
    desc: "Generate multi-locale ASO suggestions using AI.",
    primary: true,
  },
  {
    id: "sync",
    label: "Sync",
    title: "Sync with App Store Connect",
    desc: "Pull current ASO state (title, subtitle, keywords) from ASC.",
  },
  {
    id: "track-keywords",
    label: "Track",
    title: "Track Keywords",
    desc: "Check current rankings for all tracked keywords.",
  },
  {
    id: "discover-keywords",
    label: "Discover",
    title: "Discover Keywords",
    desc: "Find new keywords via AI, competitor texts and autocomplete expansion.",
  },
];

interface SchedulerStatus {
  running: boolean;
  jobCount: number;
}

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function Actions({ addToast }: Props) {
  const { data: jobs, refetch } = useApi<Job[]>("/actions/jobs");
  const { data: schedulerStatus, refetch: refetchScheduler } =
    useApi<SchedulerStatus>("/scheduler/status", [], true);
  const [running, setRunning] = useState<string | null>(null);

  const { data: apps } = useApi<AppItem[]>("/apps", [], true);
  const bundleId = getActiveBundleId();
  const activeApp = apps?.find((a) => a.bundleId === bundleId && a.isOwnApp);

  const triggerAction = async (endpoint: string, label: string) => {
    setRunning(endpoint);
    try {
      const res = await apiPost(`/actions/${endpoint}`, {
        bundleId: getActiveBundleId(),
      });
      addToast(res.message || `${label} started`, "success");
      setTimeout(refetch, 2000);
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setRunning(null);
    }
  };

  const toggleScheduler = async () => {
    const action = schedulerStatus?.running ? "stop" : "start";
    try {
      const res = await apiPost(`/scheduler/${action}`);
      addToast(res.message, "success");
      refetchScheduler();
    } catch (e: any) {
      addToast(e.message, "error");
    }
  };

  const runAll = async () => {
    setRunning("run-all");
    try {
      const res = await apiPost("/scheduler/run-all");
      addToast(res.message || "Running all jobs…", "success");
      setTimeout(refetch, 5000);
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setRunning(null);
    }
  };

  const autoApply = async () => {
    setRunning("auto-apply");
    try {
      const res = await apiPost("/suggestions/auto-apply", {
        minConfidence: 0.8,
      });
      addToast(
        `Auto-apply: ${res.applied} changes applied across ${res.results?.length ?? 0} locale(s)`,
        res.applied > 0 ? "success" : "info",
      );
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setRunning(null);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-[#111827] dark:text-[#e8eaf0] mb-1">
        Logs
      </h1>
      <p className="text-sm text-[#9ca3af] dark:text-[#5c6478] mb-8">
        Trigger jobs, manage the scheduler, auto-apply suggestions, and review
        screenshot runs
      </p>

      <div className="bg-white dark:bg-[#1c2028] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-2xl p-5 mb-6 flex flex-wrap items-center gap-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
        <div className="flex items-center gap-2 mr-auto">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              schedulerStatus?.running
                ? "bg-emerald-500"
                : "bg-[#d1d5db] dark:bg-[#3a4050]"
            }`}
          />
          <span className="text-sm font-medium text-[#111827] dark:text-[#e8eaf0]">
            Scheduler:{" "}
            {schedulerStatus?.running
              ? `Running (${schedulerStatus.jobCount} jobs)`
              : "Stopped"}
          </span>
        </div>
        <button
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-[#eef0f3] dark:border-[#2a2f3d] bg-white dark:bg-[#1c2028] text-[#111827] dark:text-[#e8eaf0] hover:bg-gray-50 dark:hover:bg-[#252b38] transition-all disabled:opacity-50"
          onClick={toggleScheduler}
        >
          {schedulerStatus?.running ? "Stop" : "Start"}
        </button>
        <button
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-[#eef0f3] dark:border-[#2a2f3d] bg-white dark:bg-[#1c2028] text-[#111827] dark:text-[#e8eaf0] hover:bg-gray-50 dark:hover:bg-[#252b38] transition-all disabled:opacity-50"
          disabled={!!running}
          onClick={runAll}
        >
          {running === "run-all" ? "Running..." : "Run All Now"}
        </button>
        <button
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-[#ea0e2b] text-white hover:bg-[#c80b24] transition-all disabled:opacity-50"
          disabled={!!running}
          onClick={autoApply}
        >
          {running === "auto-apply" ? "Applying..." : "Auto-Apply"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {ACTION_CARDS.map((ac) => (
          <ActionCard
            key={ac.id}
            card={ac}
            running={running}
            onTrigger={triggerAction}
          />
        ))}
      </div>

      <JobHistoryTable jobs={jobs ?? null} onRefresh={refetch} />

      <BossJobsPanel addToast={addToast} />

      {activeApp && (
        <>
          <BuildJobsTable appId={activeApp.id} addToast={addToast} />
          <ScreenshotJobsTable appId={activeApp.id} addToast={addToast} />
        </>
      )}
    </div>
  );
}
