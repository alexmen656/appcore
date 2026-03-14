import { useState, useRef, useCallback } from "react";
import { useApi, apiPost, apiDelete, getActiveBundleId } from "../hooks/useApi";
import { useClickOutside } from "../hooks/useClickOutside";
import OwnAppCard, { AppItem } from "./comps/competitors/OwnAppCard";
import CompetitorCard from "./comps/competitors/CompetitorCard";
import CompetitorDetailModal from "./comps/CompetitorDetailModal";

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function Competitors({ addToast }: Props) {
  const { data, loading, refetch } = useApi<AppItem[]>("/apps");
  const [discovering, setDiscovering] = useState(false);
  const [intelRunning, setIntelRunning] = useState(false);
  const [detailAppId, setDetailAppId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, useCallback(() => setMenuOpen(false), []));

  const discoverCompetitors = async () => {
    setDiscovering(true);
    try {
      const res = await apiPost("/actions/discover-competitors", {
        bundleId: getActiveBundleId(),
      });
      addToast(res.message || "Competitor discovery started", "success");
      setTimeout(refetch, 3000);
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setDiscovering(false);
    }
  };

  const runCompetitorIntel = async () => {
    setIntelRunning(true);
    try {
      const res = await apiPost("/actions/competitor-intel", {
        bundleId: getActiveBundleId(),
      });
      addToast(res.message || "Competitor intel started", "success");
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setIntelRunning(false);
    }
  };

  const removeCompetitor = async (ownAppId: string, competitorId: string) => {
    try {
      await apiDelete(`/apps/${ownAppId}/competitors/${competitorId}`);
      addToast("Competitor removed", "info");
      refetch();
    } catch (e: any) {
      addToast(e.message, "error");
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-gray-400 dark:text-[#5c6478]">
        <div className="spinner" /> Loading competitors…
      </div>
    );

  const apps = data || [];
  const ownApp = apps.find((a) => a.isOwnApp);
  const competitors = apps.filter((a) => !a.isOwnApp);

  return (
    <div>
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-3xl font-semibold tracking-tight text-[#111827] dark:text-[#e8eaf0]">
          Competitors
        </h1>
        <div ref={menuRef} className="relative flex items-stretch">
          <button
            onClick={discoverCompetitors}
            disabled={discovering || intelRunning}
            className="inline-flex items-center gap-1.5 pl-3.5 pr-3 py-2 rounded-l-xl text-sm font-semibold bg-[#ea0e2b] text-white hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {discovering ? <><div className="spinner !w-3.5 !h-3.5" /> Discovering…</> : "Discover Competitors"}
          </button>
          <div className="w-px bg-[#c80b24] opacity-40" />
          <button
            onClick={() => setMenuOpen((o) => !o)}
            disabled={discovering || intelRunning}
            className="px-2.5 rounded-r-xl bg-[#ea0e2b] text-white hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="More actions"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`w-3.5 h-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#1c2028] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-xl shadow-lg py-1 min-w-[160px]">
              <button
                onClick={() => { setMenuOpen(false); runCompetitorIntel(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#111827] dark:text-[#e8eaf0] hover:bg-[#fafbfc] dark:hover:bg-[#252b38] transition-colors text-left"
              >
                Gather Intel
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="text-sm text-[#9ca3af] dark:text-[#5c6478] mb-8">
        {competitors.length} competitor{competitors.length !== 1 ? "s" : ""}{" "}
        discovered and tracked
      </p>

      {ownApp && <OwnAppCard app={ownApp} />}

      <div className="text-xs font-medium uppercase tracking-wide text-[#9ca3af] dark:text-[#5c6478] mb-3">
        Competitor Apps
      </div>
      {competitors.length === 0 ? (
        <div className="py-16 text-center">
          <div className="flex justify-center mb-3 opacity-20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-12 h-12 text-[#9ca3af]"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
              />
            </svg>
          </div>
          <div className="text-sm font-medium text-[#6b7280] dark:text-[#8b93a5] mb-1">
            No competitors discovered yet
          </div>
          <div className="text-xs text-[#9ca3af] dark:text-[#5c6478]">
            Run a scrape from the Actions page
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {competitors.map((c) => (
            <CompetitorCard
              key={c.id}
              competitor={c}
              ownAppId={ownApp?.id}
              onRemove={ownApp ? (competitorId) => removeCompetitor(ownApp.id, competitorId) : undefined}
              onClick={() => setDetailAppId(c.id)}
            />
          ))}
        </div>
      )}

      {detailAppId && (
        <CompetitorDetailModal
          appId={detailAppId}
          onClose={() => setDetailAppId(null)}
          addToast={addToast}
        />
      )}
    </div>
  );
}
