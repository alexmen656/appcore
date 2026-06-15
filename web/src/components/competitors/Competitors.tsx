import { useState, useRef, useCallback } from "react";
import { borderDefault, pageTitle, textMuted, textPrimary, textSecondary } from "../../styles";
import { ChevronDown, LayoutGrid, List, Plus, Users } from "lucide-react";
import { useApi, apiPost, apiDelete, getActiveBundleId } from "../../hooks/useApi";
import { useClickOutside } from "../../hooks/useClickOutside";
import { usePermissions } from "../../hooks/usePermissions";
import { usePostHog } from "@posthog/react";
import OwnAppCard, { AppItem } from "./OwnAppCard";
import CompetitorCard from "./CompetitorCard";
import CompetitorTable from "./CompetitorTable";
import CompetitorDetailModal from "./CompetitorDetailModal";
import AddCompetitorsModal from "./AddCompetitorsModal";

type ViewMode = "grid" | "table";

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function Competitors({ addToast }: Props) {
  const posthog = usePostHog();
  const { canWrite } = usePermissions();
  const { data, loading, refetch } = useApi<AppItem[]>("/apps");
  const [discovering, setDiscovering] = useState(false);
  const [intelRunning, setIntelRunning] = useState(false);
  const [detailAppId, setDetailAppId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(
    menuRef,
    useCallback(() => setMenuOpen(false), []),
  );

  const discoverCompetitors = async () => {
    setDiscovering(true);
    try {
      const res = await apiPost("/actions/discover-competitors", {
        bundleId: getActiveBundleId(),
      });
      posthog?.capture("competitor_discovery_started", { bundle_id: getActiveBundleId() });
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
        <h1 className={`${pageTitle}`}>Competitors</h1>
        <div className="flex items-center gap-2.5">
          <div
            className={`inline-flex items-center p-1 rounded-full border ${borderDefault} bg-gray-50/60 dark:bg-[#181c24]`}
          >
            <button
              onClick={() => setViewMode("grid")}
              aria-pressed={viewMode === "grid"}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold transition-all ${
                viewMode === "grid"
                  ? `bg-white dark:bg-[#252b38] ${textPrimary} shadow-[0_1px_2px_rgba(0,0,0,0.06)]`
                  : `${textMuted}`
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Grid
            </button>
            <button
              onClick={() => setViewMode("table")}
              aria-pressed={viewMode === "table"}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold transition-all ${
                viewMode === "table"
                  ? `bg-white dark:bg-[#252b38] ${textPrimary} shadow-[0_1px_2px_rgba(0,0,0,0.06)]`
                  : `${textMuted}`
              }`}
            >
              <List className="w-3.5 h-3.5" /> List
            </button>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            disabled={!canWrite || !ownApp}
            title={!ownApp ? "Add your app first" : undefined}
            className={`inline-flex items-center gap-1.5 pl-3 pr-3.5 py-[7px] rounded-full border ${borderDefault} bg-white dark:bg-[#1c2028] text-[13px] font-medium ${textPrimary} hover:border-[#D94412] hover:text-[#D94412] transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Plus className="w-3.5 h-3.5" />
            Add competitor
          </button>
          <div ref={menuRef} className="relative flex items-stretch">
          <button
            onClick={discoverCompetitors}
            disabled={discovering || intelRunning}
            className="inline-flex items-center gap-1.5 pl-3.5 pr-3 py-2 rounded-l-xl text-sm font-semibold bg-[#D94412] text-white hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {discovering ? (
              <>
                <div className="spinner !w-3.5 !h-3.5" /> Discovering…
              </>
            ) : (
              "Discover Competitors"
            )}
          </button>
          <div className="w-px bg-[#c80b24] opacity-40" />
          <button
            onClick={() => setMenuOpen((o) => !o)}
            disabled={discovering || intelRunning}
            className="px-2.5 rounded-r-xl bg-[#D94412] text-white hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="More actions"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
          </button>
          {menuOpen && (
            <div
              className={`absolute right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#1c2028] border ${borderDefault} rounded-xl shadow-lg py-1 min-w-[160px]`}
            >
              <button
                onClick={() => {
                  setMenuOpen(false);
                  runCompetitorIntel();
                }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] ${textPrimary} hover:bg-[#fafbfc] dark:hover:bg-[#252b38] transition-colors text-left`}
              >
                Gather Intel
              </button>
            </div>
          )}
          </div>
        </div>
      </div>
      <p className={`text-sm ${textMuted} mb-8`}>
        {competitors.length} competitor{competitors.length !== 1 ? "s" : ""} discovered and tracked
      </p>

      {ownApp && <OwnAppCard app={ownApp} />}

      <div className={`text-xs font-medium uppercase tracking-wide ${textMuted} mb-3`}>Competitor Apps</div>
      {competitors.length === 0 ? (
        <div className="py-16 text-center">
          <div className="flex justify-center mb-3 opacity-20">
            <Users className="w-12 h-12 text-[#9ca3af]" />
          </div>
          <div className={`text-sm font-medium ${textSecondary} mb-1`}>No competitors discovered yet</div>
          <div className={`text-xs ${textMuted}`}>Run a scrape from the Actions page</div>
        </div>
      ) : viewMode === "table" ? (
        <CompetitorTable
          competitors={competitors}
          ownAppId={ownApp?.id}
          onRemove={ownApp ? (competitorId) => removeCompetitor(ownApp.id, competitorId) : undefined}
          onRowClick={(id) => setDetailAppId(id)}
        />
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
        <CompetitorDetailModal appId={detailAppId} onClose={() => setDetailAppId(null)} addToast={addToast} />
      )}

      <AddCompetitorsModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        ownAppId={ownApp?.id ?? null}
        onAdded={() => refetch()}
        addToast={addToast}
      />
    </div>
  );
}
