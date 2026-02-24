import { useState } from "react";
import { useApi, apiPost, getActiveBundleId } from "../hooks/useApi";
import DownloadsChart from "./comps/analytics/DownloadsChart";
import ReviewsList from "./comps/analytics/ReviewsList";

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

interface Summary {
  totalDownloads30d: number;
  totalProceeds30d: number;
  avgRating: number | null;
  reviewCount: number;
  lastSyncAt: string | null;
}

interface DownloadsData {
  byDay: {
    date: string;
    downloads: number;
    updates: number;
    proceeds: number;
  }[];
  byCountry: { country: string; downloads: number }[];
}

interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  reviewerNickname: string | null;
  territory: string | null;
  reviewedAt: string;
}

const TH =
  "text-left text-[11px] font-medium uppercase tracking-wide text-[#9ca3af] px-4 py-3 border-b border-[#f3f4f6]";
const TD = "px-4 py-3.5 border-b border-[#f3f4f6] text-[13px] align-middle";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
function countryName(code: string): string {
  if (code.length !== 2 || !/^[A-Z]{2}$/.test(code.toUpperCase())) return "Unknown";
  try {
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

function countryCodeLabel(code: string): string {
  return code.length === 2 && /^[A-Z]{2}$/i.test(code) ? code.toUpperCase() : "";
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-white border border-[#eef0f3] rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="text-[11px] font-medium uppercase tracking-wide text-[#9ca3af] mb-2">
        {label}
      </div>
      <div className="text-[26px] font-semibold text-[#111827] leading-none">
        {value}
      </div>
      {sub && <div className="text-[12px] text-[#9ca3af] mt-1.5">{sub}</div>}
    </div>
  );
}

function fmtNumber(n: number) {
  return n.toLocaleString();
}

function fmtRevenue(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Analytics({ addToast }: Props) {
  const bundleId = getActiveBundleId() ?? "";
  const [syncing, setSyncing] = useState(false);

  const {
    data: summary,
    loading: sumLoading,
    refetch: refetchSummary,
  } = useApi<Summary>(`/analytics/summary?bundleId=${bundleId}`);
  const {
    data: downloads,
    loading: dlLoading,
    refetch: refetchDownloads,
  } = useApi<DownloadsData>(
    `/analytics/downloads?bundleId=${bundleId}&days=90`,
  );
  const {
    data: reviews,
    loading: rvLoading,
    refetch: refetchReviews,
  } = useApi<Review[]>(`/analytics/reviews?bundleId=${bundleId}&limit=200`);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await apiPost("/analytics/sync", { bundleId });
      addToast("Analytics sync started — data will appear shortly", "info");
      setTimeout(() => {
        refetchSummary();
        refetchDownloads();
        refetchReviews();
      }, 3000);
    } catch (err: any) {
      addToast(err.message ?? "Sync failed", "error");
    } finally {
      setSyncing(false);
    }
  };

  const loading = sumLoading || dlLoading || rvLoading;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#111827] mb-1">
            Analytics
          </h1>
          <p className="text-sm text-[#9ca3af] mb-8">
            Downloads, revenue and reviews from App Store Connect
            {summary?.lastSyncAt && (
              <span className="ml-2">
                · Last synced {fmtDate(summary.lastSyncAt)}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium bg-[#ea0e2b] text-white hover:bg-[#c80b24] disabled:opacity-60 transition-colors"
        >
          {syncing ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Syncing…
            </>
          ) : (
            <>
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Sync Now
            </>
          )}
        </button>
      </div>

      {!loading && !summary?.totalDownloads30d && reviews?.length === 0 && (
        <div className="mb-5 px-4 py-3.5 rounded-2xl bg-amber-50 border border-amber-100 text-[13px] text-amber-800">
          <strong>No analytics data yet.</strong> Make sure your{" "}
          <a href="/settings" className="underline font-medium">
            Vendor Number
          </a>{" "}
          is configured in Settings, then click <strong>Sync Now</strong>.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard
          label="Downloads (30d)"
          value={sumLoading ? "—" : fmtNumber(summary?.totalDownloads30d ?? 0)}
          sub="New installs"
        />
        <StatCard
          label="Revenue (30d)"
          value={sumLoading ? "—" : fmtRevenue(summary?.totalProceeds30d ?? 0)}
          sub="Developer proceeds"
        />
        <StatCard
          label="Avg Rating"
          value={
            sumLoading || summary?.avgRating == null
              ? "—"
              : summary.avgRating.toFixed(1)
          }
          sub="All-time average"
        />
        <StatCard
          label="Reviews"
          value={sumLoading ? "—" : fmtNumber(summary?.reviewCount ?? 0)}
          sub="Synced reviews"
        />
      </div>

      <div className="mb-5">
        <DownloadsChart data={downloads?.byDay ?? []} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="bg-white border border-[#eef0f3] rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="px-5 py-4 border-b border-[#f3f4f6]">
            <div className="text-[15px] font-semibold text-[#111827]">
              Top Countries
            </div>
            <div className="text-[12px] text-[#9ca3af] mt-0.5">
              Downloads by country (all time)
            </div>
          </div>
          {(downloads?.byCountry ?? []).length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-[#9ca3af]">
              No data yet
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className={TH}>Country</th>
                  <th className={`${TH} text-right`}>Downloads</th>
                  <th className={`${TH} text-right pr-5`}>Share</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const total = (downloads?.byCountry ?? []).reduce(
                    (s, r) => s + r.downloads,
                    0,
                  );
                  return (downloads?.byCountry ?? []).slice(0, 10).map((r) => (
                    <tr
                      key={r.country}
                      className="hover:bg-[#f7f8fa] transition-colors"
                    >
                      <td className={TD}>
                        <span className="font-medium text-[#111827]">
                          {r.country}
                        </span>
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>
                        {fmtNumber(r.downloads)}
                      </td>
                      <td className={`${TD} text-right pr-5`}>
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-[#f3f4f6] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#ea0e2b] rounded-full"
                              style={{
                                width: `${total > 0 ? (r.downloads / total) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <span className="text-[12px] text-[#9ca3af] w-9 text-right">
                            {total > 0
                              ? Math.round((r.downloads / total) * 100)
                              : 0}
                            %
                          </span>
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white border border-[#eef0f3] rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="text-[15px] font-semibold text-[#111827] mb-1">
            Rating Distribution
          </div>
          <div className="text-[12px] text-[#9ca3af] mb-4">
            Based on synced reviews
          </div>
          {(reviews ?? []).length === 0 ? (
            <div className="py-8 text-center text-[13px] text-[#9ca3af]">
              No reviews yet
            </div>
          ) : (
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = (reviews ?? []).filter(
                  (r) => r.rating === star,
                ).length;
                const pct =
                  (reviews ?? []).length > 0
                    ? (count / (reviews ?? []).length) * 100
                    : 0;
                return (
                  <div key={star} className="flex items-center gap-3">
                    <span className="text-[13px] text-[#111827] w-5 text-right">
                      {star}
                    </span>
                    <span className="text-amber-400 text-[13px]">&#9733;</span>
                    <div className="flex-1 h-2 bg-[#f3f4f6] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[12px] text-[#9ca3af] w-8 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ReviewsList reviews={reviews ?? []} />

      <div className="bg-white border border-[#eef0f3] rounded-2xl overflow-hidden mt-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="px-5 py-4 border-b border-[#f3f4f6]">
          <div className="text-[15px] font-semibold text-[#111827]">
            Downloads by Country
          </div>
          <div className="text-[12px] text-[#9ca3af] mt-0.5">
            All-time downloads per country
          </div>
        </div>
        {(downloads?.byCountry ?? []).length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-[#9ca3af]">
            No data yet
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={TH}>Country</th>
                <th className={`${TH} text-right`}>Downloads</th>
                <th className={`${TH} text-right pr-5`}>Share</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const total = (downloads?.byCountry ?? []).reduce(
                  (s, r) => s + r.downloads,
                  0,
                );
                return (downloads?.byCountry ?? []).map((r) => (
                  <tr
                    key={r.country}
                    className="hover:bg-[#f7f8fa] transition-colors"
                  >
                    <td className={TD}>
                      <span className="font-medium text-[#111827]">
                        {countryName(r.country)}
                      </span>
                      {countryCodeLabel(r.country) && (
                        <span className="ml-1.5 text-[11px] text-[#9ca3af]">
                          {countryCodeLabel(r.country)}
                        </span>
                      )}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {fmtNumber(r.downloads)}
                    </td>
                    <td className={`${TD} text-right pr-5`}>
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-[#f3f4f6] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#ea0e2b] rounded-full"
                            style={{
                              width: `${total > 0 ? (r.downloads / total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-[12px] text-[#9ca3af] w-9 text-right">
                          {total > 0
                            ? Math.round((r.downloads / total) * 100)
                            : 0}
                          %
                        </span>
                      </div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
