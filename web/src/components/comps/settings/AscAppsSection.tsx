import SectionCard from "./SectionCard";
import { AscApp } from "./types";

interface Props {
  ascApps: AscApp[] | null;
  ascLoading: boolean;
  importing: string | null;
  btnSecondary: string;
  btnSecondarySmall: string;
  onLoadApps: () => void;
  onImport: (app: AscApp) => void;
}

export default function AscAppsSection({
  ascApps,
  ascLoading,
  importing,
  btnSecondary,
  btnSecondarySmall,
  onLoadApps,
  onImport,
}: Props) {
  return (
    <SectionCard
      title="Apps from App Store Connect"
      desc="Load all apps from your ASC account and import them for tracking. Save your credentials above first."
    >
      <button
        type="button"
        className={btnSecondary}
        onClick={onLoadApps}
        disabled={ascLoading}
      >
        {ascLoading ? "Loading…" : "Load my apps from App Store Connect"}
      </button>
      {ascApps !== null && ascApps.length === 0 && (
        <p className="text-xs text-gray-400 mt-3">
          No apps found. Check that your ASC credentials have access.
        </p>
      )}
      {ascApps && ascApps.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {ascApps.map((app) => (
            <div
              key={app.ascId}
              className="flex items-center justify-between gap-3 px-4 py-3 bg-[#eff3f6] rounded-xl border border-gray-200"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#1a1a2e] truncate">
                  {app.name}
                </div>
                <div className="text-[11px] text-gray-400 font-mono">
                  {app.bundleId} · ID {app.ascId}
                  {app.primaryLocale ? ` · ${app.primaryLocale}` : ""}
                </div>
              </div>
              <button
                type="button"
                className={`${btnSecondarySmall} shrink-0`}
                disabled={importing === app.ascId}
                onClick={() => onImport(app)}
              >
                {importing === app.ascId ? "Importing…" : "Import"}
              </button>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
