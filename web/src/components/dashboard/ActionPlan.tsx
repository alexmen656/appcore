import { Link } from "react-router-dom";
import {
  Search,
  Type,
  Tag,
  Image as ImageIcon,
  Users,
  AlignLeft,
  KeyRound,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { borderDefault, cardCls, textMuted, textPrimary, textSecondary } from "../../styles";

interface ScanFinding {
  key: string;
  title: string;
  desc: string;
  impact: "high" | "med";
  metric?: [string, string];
}

interface ScanResult {
  ready: boolean;
  score?: number;
  target?: number;
  findings?: ScanFinding[];
}

interface CtaMeta {
  to: string;
  label: string;
  icon: LucideIcon;
}

const CTA_BY_KEY: Record<string, CtaMeta> = {
  title: { to: "/versions", label: "Edit metadata", icon: Type },
  subtitle: { to: "/versions", label: "Edit metadata", icon: Tag },
  description: { to: "/versions", label: "Edit description", icon: AlignLeft },
  screenshots: { to: "/versions", label: "Manage screenshots", icon: ImageIcon },
  keyword: { to: "/keywords", label: "Open Keywords", icon: Search },
  competitor: { to: "/competitors", label: "Find competitors", icon: Users },
};

const FALLBACK_CTA: CtaMeta = { to: "/keywords", label: "Open Keywords", icon: Search };

function AscConnectCard() {
  return (
    <div className="mb-5 rounded-2xl border border-[#D94412]/30 bg-gradient-to-br from-[#fff5f1] to-[#fdeee9] dark:from-[#2a1812] dark:to-[#231210] p-5">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#D94412] to-[#C4001E] flex items-center justify-center shrink-0 shadow-sm">
          <KeyRound className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-[15px] font-bold ${textPrimary}`}>Connect App Store Connect</div>
          <p className={`text-[13px] ${textSecondary} mt-1 max-w-xl`}>
            Add your App Store Connect API key to push metadata, sync versions, and apply AI suggestions straight to
            your listing. Without it, Marteso can only read your public data.
          </p>
          <Link
            to="/settings/team-settings"
            className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-xl text-[13px] font-semibold bg-[#D94412] text-white hover:bg-[#c80b24] transition-all"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Connect via API key
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ActionPlan({ hasASC }: { hasASC: boolean }) {
  const { data: scan } = useApi<ScanResult>("/asc/scan");
  const findings = scan?.ready ? (scan.findings ?? []) : [];

  return (
    <>
      {!hasASC && <AscConnectCard />}

      {scan?.ready && (
        <div className={`${cardCls} mb-5`}>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className={`text-[15px] font-bold ${textPrimary}`}>Your ASO action plan</div>
              <p className={`text-[13px] ${textMuted} mt-0.5`}>
                {findings.length === 0
                  ? "No open gaps right now — your listing is in good shape."
                  : `${findings.length} quick win${findings.length === 1 ? "" : "s"} to climb the rankings.`}
              </p>
            </div>
            {scan.score != null && (
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <div className={`text-2xl font-bold leading-none ${textPrimary}`}>{scan.score}</div>
                  <div className={`text-[10px] uppercase tracking-wide ${textMuted} mt-0.5`}>ASO score</div>
                </div>
                {scan.target != null && scan.target > scan.score && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-full px-2 py-1 self-center">
                    <TrendingUp className="w-3 h-3" />~{scan.target}
                  </span>
                )}
              </div>
            )}
          </div>

          {findings.length === 0 ? (
            <div className="flex items-center gap-2.5 py-2 text-[13px] text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              All caught up. Keep tracking keywords and competitors to stay ahead.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {findings.map((f) => {
                const cta = CTA_BY_KEY[f.key] ?? FALLBACK_CTA;
                const Icon = cta.icon;
                return (
                  <div
                    key={f.key}
                    className={`flex items-center gap-3.5 px-4 py-3 rounded-xl border ${borderDefault} bg-[#fafbfc] dark:bg-[#252b38]`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-white dark:bg-[#1c2028] border border-[#eef0f3] dark:border-[#2a2f3d] flex items-center justify-center text-[#C4001E] shrink-0">
                      <Icon className="w-[18px] h-[18px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[13.5px] font-semibold ${textPrimary}`}>{f.title}</span>
                        <span
                          className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            f.impact === "high"
                              ? "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400"
                              : "text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400"
                          }`}
                        >
                          {f.impact === "high" ? "High impact" : "Medium"}
                        </span>
                      </div>
                      <div className={`text-[12.5px] ${textSecondary} leading-snug mt-0.5`}>{f.desc}</div>
                    </div>
                    <Link
                      to={cta.to}
                      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold border ${borderDefault} bg-white dark:bg-[#1c2028] ${textPrimary} hover:border-[#D94412] hover:text-[#D94412] transition-all`}
                    >
                      {cta.label}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
