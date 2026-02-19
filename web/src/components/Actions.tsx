import { useState } from "react";
import { apiPost, useApi, getActiveBundleId } from "../hooks/useApi";
import ActionCard, { ActionCardDef } from "./comps/actions/ActionCard";
import JobHistoryTable, { Job } from "./comps/actions/JobHistoryTable";

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

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function Actions({ addToast }: Props) {
  const { data: jobs, refetch } = useApi<Job[]>("/actions/jobs");
  const [running, setRunning] = useState<string | null>(null);

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

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-[#1a1a2e] mb-1">
        Actions
      </h1>
      <p className="text-base text-gray-500 mb-7">
        Manually trigger scraping, analysis, and sync operations
      </p>

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
    </div>
  );
}
