import { useState } from "react";
import { apiPost, useApi, getActiveBundleId } from "../hooks/useApi";
import ActionCard, { ActionCardDef } from "./comps/actions/ActionCard";
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

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function Actions({ addToast }: Props) {
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
        Trigger jobs, and review screenshot/build runs
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
