import { useState, useEffect } from "react";
import { authHeaders, getActiveBundleId } from "../../hooks/useApi";
import type {
  CompetitorDetail,
  CompetitorReview,
  CompetitorKeywordRanking,
  MetadataChange,
} from "../../types";
import AppIcon from "./competitors/AppIcon";

interface Props {
  appId: string;
  onClose: () => void;
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}

type Tab = "overview" | "reviews" | "changes" | "keywords";

export default function CompetitorDetailModal({
  appId,
  onClose,
  addToast,
}: Props) {
  const [data, setData] = useState<CompetitorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    const bundleId = getActiveBundleId();
    const url = `/api/apps/${appId}/competitor-detail${bundleId ? `?bundleId=${bundleId}` : ""}`;
    fetch(url, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        addToast(`Load failed: ${err.message}`, "error");
        setLoading(false);
      });
  }, [appId]);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "reviews", label: "Reviews", count: data?.reviews.length },
    { key: "changes", label: "Changes", count: data?.metadataChanges.length },
    {
      key: "keywords",
      label: "Keywords",
      count: data?.keywordRankings.filter((k) => k.competitorRank != null)
        .length,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 pb-10">
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60"
        onClick={onClose}
      />
      <div className="relative w-full max-w-4xl max-h-[calc(100vh-5rem)] flex flex-col bg-white dark:bg-[#161920] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#eef0f3] dark:border-[#2a2f3d] shrink-0">
          {data ? (
            <div className="flex items-center gap-3">
              <AppIcon url={data.iconUrl} name={data.name} />
              <div>
                <h2 className="text-lg font-semibold text-[#111827] dark:text-[#e8eaf0]">
                  {data.name}
                </h2>
                <div className="flex items-center gap-3 text-xs text-[#9ca3af] dark:text-[#5c6478]">
                  <span>{data.bundleId}</span>
                  {data.rating != null && (
                    <span className="flex items-center gap-1">
                      <span className="text-amber-400">&#9733;</span>
                      {data.rating.toFixed(1)}
                      {data.ratingsCount != null && (
                        <span>({data.ratingsCount.toLocaleString()})</span>
                      )}
                    </span>
                  )}
                  {data.version && <span>v{data.version}</span>}
                  {data.category && <span>{data.category}</span>}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-[#9ca3af]">Loading…</div>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#e8eaf0] hover:bg-gray-100 dark:hover:bg-[#252b38] transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex gap-1 px-6 pt-3 border-b border-[#eef0f3] dark:border-[#2a2f3d] shrink-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-2 text-[13px] font-medium rounded-t-lg transition-colors ${
                tab === t.key
                  ? "text-[#ea0e2b] border-b-2 border-[#ea0e2b] -mb-px"
                  : "text-[#9ca3af] dark:text-[#5c6478] hover:text-[#111827] dark:hover:text-[#e8eaf0]"
              }`}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-[#252b38] text-[11px]">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-gray-400 dark:text-[#5c6478]">
              <div className="spinner" /> Loading…
            </div>
          ) : !data ? (
            <div className="text-center py-20 text-[#9ca3af]">
              Failed to load competitor data
            </div>
          ) : (
            <>
              {tab === "overview" && <OverviewTab data={data} />}
              {tab === "reviews" && <ReviewsTab data={data} />}
              {tab === "changes" && (
                <ChangesTab changes={data.metadataChanges} />
              )}
              {tab === "keywords" && (
                <KeywordsTab rankings={data.keywordRankings} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ data }: { data: CompetitorDetail }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {data.subtitle && <InfoCard label="Subtitle" value={data.subtitle} />}
        {data.developerName && (
          <InfoCard label="Developer" value={data.developerName} />
        )}
        {data.category && <InfoCard label="Category" value={data.category} />}
        {data.version && <InfoCard label="Version" value={data.version} />}
      </div>
      {data.description && (
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-[#9ca3af] dark:text-[#5c6478] mb-2">
            Description
          </div>
          <div className="text-[13px] text-[#374151] dark:text-[#c0c5d0] bg-gray-50 dark:bg-[#1c2028] rounded-xl p-4 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
            {data.description}
          </div>
        </div>
      )}
      {data.reviewSummary && (
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-[#9ca3af] dark:text-[#5c6478] mb-2">
            Review Summary ({data.reviewSummary.reviewCount} reviews, avg{" "}
            {data.reviewSummary.averageRating.toFixed(1)}★)
          </div>
          <div className="bg-gray-50 dark:bg-[#1c2028] rounded-xl p-4 space-y-3">
            {data.reviewSummary.sentiment && (
              <SentimentBadge sentiment={data.reviewSummary.sentiment} />
            )}
            <p className="text-[13px] text-[#374151] dark:text-[#c0c5d0] leading-relaxed">
              {data.reviewSummary.summary}
            </p>
            <div className="grid grid-cols-2 gap-4 mt-3">
              {data.reviewSummary.strengths.length > 0 && (
                <div>
                  <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                    Strengths
                  </div>
                  <ul className="space-y-1">
                    {data.reviewSummary.strengths.map((s, i) => (
                      <li
                        key={i}
                        className="text-xs text-[#374151] dark:text-[#c0c5d0] flex items-start gap-1.5"
                      >
                        <span className="text-emerald-500 mt-0.5">+</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.reviewSummary.weaknesses.length > 0 && (
                <div>
                  <div className="text-[11px] font-medium text-red-500 dark:text-red-400 mb-1">
                    Weaknesses
                  </div>
                  <ul className="space-y-1">
                    {data.reviewSummary.weaknesses.map((w, i) => (
                      <li
                        key={i}
                        className="text-xs text-[#374151] dark:text-[#c0c5d0] flex items-start gap-1.5"
                      >
                        <span className="text-red-400 mt-0.5">−</span> {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {data.reviewSummary.topThemes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {data.reviewSummary.topThemes.map((theme, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-[#252b38] text-[11px] text-[#374151] dark:text-[#c0c5d0]"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Reviews"
          value={data.reviews.length.toString()}
          sub="scraped"
        />
        <StatCard
          label="Changes"
          value={data.metadataChanges.length.toString()}
          sub="detected"
        />
        <StatCard
          label="Keywords"
          value={data.keywordRankings
            .filter((k) => k.competitorRank != null)
            .length.toString()}
          sub="ranked"
        />
      </div>
    </div>
  );
}

function ReviewsTab({ data }: { data: CompetitorDetail }) {
  if (data.reviews.length === 0) {
    return (
      <EmptyState
        icon="reviews"
        title="No reviews scraped yet"
        subtitle="Run 'Competitor Intel' from Actions to scrape reviews"
      />
    );
  }

  const ratingDist = [5, 4, 3, 2, 1].map((r) => ({
    stars: r,
    count: data.reviews.filter((rev) => rev.rating === r).length,
  }));
  const maxCount = Math.max(...ratingDist.map((d) => d.count), 1);

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 dark:bg-[#1c2028] rounded-xl p-4">
        <div className="text-xs font-medium text-[#9ca3af] dark:text-[#5c6478] mb-2">
          Rating Distribution
        </div>
        <div className="space-y-1.5">
          {ratingDist.map((d) => (
            <div key={d.stars} className="flex items-center gap-2 text-xs">
              <span className="w-4 text-right text-[#6b7280] dark:text-[#8b93a5]">
                {d.stars}★
              </span>
              <div className="flex-1 h-3 bg-gray-200 dark:bg-[#252b38] rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all"
                  style={{ width: `${(d.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="w-6 text-right text-[#9ca3af] dark:text-[#5c6478]">
                {d.count}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {data.reviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: CompetitorReview }) {
  const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
  return (
    <div className="bg-white dark:bg-[#1c2028] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-xs tracking-wide">{stars}</span>
          {review.author && (
            <span className="text-[11px] text-[#9ca3af] dark:text-[#5c6478]">
              {review.author}
            </span>
          )}
        </div>
        <span className="text-[11px] text-[#9ca3af] dark:text-[#5c6478]">
          {new Date(review.reviewedAt).toLocaleDateString()}
        </span>
      </div>
      {review.title && (
        <div className="text-[13px] font-medium text-[#111827] dark:text-[#e8eaf0] mb-0.5">
          {review.title}
        </div>
      )}
      {review.body && (
        <div className="text-xs text-[#6b7280] dark:text-[#8b93a5] leading-relaxed line-clamp-4">
          {review.body}
        </div>
      )}
    </div>
  );
}

function ChangesTab({ changes }: { changes: MetadataChange[] }) {
  if (changes.length === 0) {
    return (
      <EmptyState
        icon="changes"
        title="No metadata changes detected"
        subtitle="Changes are tracked each time a scrape runs"
      />
    );
  }

  const fieldColors: Record<string, string> = {
    title:
      "bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400",
    subtitle: "bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400",
    description:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
    version: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
    rating:
      "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
    price: "bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400",
    releaseNotes:
      "bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  };

  return (
    <div className="space-y-2">
      {changes.map((change) => (
        <div
          key={change.id}
          className="bg-white dark:bg-[#1c2028] border border-[#eef0f3] dark:border-[#2a2f3d] rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                fieldColors[change.field] ??
                "bg-gray-100 text-gray-600 dark:bg-[#252b38] dark:text-[#8b93a5]"
              }`}
            >
              {change.field}
            </span>
            <span className="text-[11px] text-[#9ca3af] dark:text-[#5c6478]">
              {new Date(change.detectedAt).toLocaleDateString()}{" "}
              {new Date(change.detectedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          {change.field !== "description" && change.field !== "releaseNotes" ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-red-400 dark:text-red-400 line-through max-w-[45%] truncate">
                {change.oldValue || "(empty)"}
              </span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-3.5 h-3.5 text-[#9ca3af] shrink-0"
              >
                <path
                  d="M5 12h14M12 5l7 7-7 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium max-w-[45%] truncate">
                {change.newValue || "(empty)"}
              </span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {change.oldValue && (
                <div className="text-xs text-red-400 bg-red-50 dark:bg-red-900/10 rounded-lg p-2 max-h-20 overflow-y-auto line-clamp-3">
                  {change.oldValue.substring(0, 300)}
                  {(change.oldValue?.length ?? 0) > 300 ? "…" : ""}
                </div>
              )}
              {change.newValue && (
                <div className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg p-2 max-h-20 overflow-y-auto line-clamp-3">
                  {change.newValue.substring(0, 300)}
                  {(change.newValue?.length ?? 0) > 300 ? "…" : ""}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function KeywordsTab({ rankings }: { rankings: CompetitorKeywordRanking[] }) {
  const [sortBy, setSortBy] = useState<
    "keyword" | "competitor" | "ours" | "popularity"
  >("popularity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir(col === "keyword" ? "asc" : "desc");
    }
  };

  const sorted = [...rankings].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortBy) {
      case "keyword":
        return a.keyword.localeCompare(b.keyword) * dir;
      case "competitor":
        return ((a.competitorRank ?? 999) - (b.competitorRank ?? 999)) * dir;
      case "ours":
        return ((a.ourRank ?? 999) - (b.ourRank ?? 999)) * dir;
      case "popularity":
        return ((a.popularity ?? 0) - (b.popularity ?? 0)) * dir;
    }
  });

  if (rankings.length === 0) {
    return (
      <EmptyState
        icon="keywords"
        title="No keywords tracked"
        subtitle="Add keywords in the Keywords page to see competitor rankings"
      />
    );
  }

  const thCls =
    "text-left text-[11px] font-medium uppercase tracking-wide text-[#9ca3af] dark:text-[#5c6478] px-3 py-2.5 cursor-pointer select-none hover:text-[#6b7280] dark:hover:text-[#8b93a5] transition-colors";
  const tdCls = "px-3 py-2.5 text-[13px]";

  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#eef0f3] dark:border-[#2a2f3d]">
            <th className={thCls} onClick={() => toggleSort("keyword")}>
              Keyword {sortBy === "keyword" && (sortDir === "asc" ? "↑" : "↓")}
            </th>
            <th
              className={`${thCls} text-center`}
              onClick={() => toggleSort("popularity")}
            >
              Pop. {sortBy === "popularity" && (sortDir === "asc" ? "↑" : "↓")}
            </th>
            <th
              className={`${thCls} text-center`}
              onClick={() => toggleSort("competitor")}
            >
              Their Rank{" "}
              {sortBy === "competitor" && (sortDir === "asc" ? "↑" : "↓")}
            </th>
            <th
              className={`${thCls} text-center`}
              onClick={() => toggleSort("ours")}
            >
              Our Rank {sortBy === "ours" && (sortDir === "asc" ? "↑" : "↓")}
            </th>
            <th className={`${thCls} text-center`}>Diff</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const diff =
              r.competitorRank != null && r.ourRank != null
                ? r.competitorRank - r.ourRank
                : null;
            return (
              <tr
                key={r.keywordId}
                className="border-b border-[#f3f4f6] dark:border-[#2a2f3d] hover:bg-gray-50 dark:hover:bg-[#1c2028] transition-colors"
              >
                <td
                  className={`${tdCls} font-medium text-[#111827] dark:text-[#e8eaf0]`}
                >
                  {r.keyword}
                </td>
                <td className={`${tdCls} text-center`}>
                  {r.popularity != null ? (
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        r.popularity >= 60
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                          : r.popularity >= 30
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                            : "bg-gray-100 text-gray-600 dark:bg-[#252b38] dark:text-[#8b93a5]"
                      }`}
                    >
                      {Math.round(r.popularity)}
                    </span>
                  ) : (
                    <span className="text-[#9ca3af] dark:text-[#5c6478]">
                      —
                    </span>
                  )}
                </td>
                <td className={`${tdCls} text-center font-mono`}>
                  {r.competitorRank != null ? (
                    <span className="text-[#374151] dark:text-[#c0c5d0]">
                      #{r.competitorRank}
                    </span>
                  ) : (
                    <span className="text-[#9ca3af] dark:text-[#5c6478]">
                      —
                    </span>
                  )}
                </td>
                <td className={`${tdCls} text-center font-mono`}>
                  {r.ourRank != null ? (
                    <span className="text-[#374151] dark:text-[#c0c5d0]">
                      #{r.ourRank}
                    </span>
                  ) : (
                    <span className="text-[#9ca3af] dark:text-[#5c6478]">
                      —
                    </span>
                  )}
                </td>
                <td className={`${tdCls} text-center`}>
                  {diff != null ? (
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        diff > 0
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                          : diff < 0
                            ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                            : "bg-gray-100 text-gray-600 dark:bg-[#252b38] dark:text-[#8b93a5]"
                      }`}
                    >
                      {diff > 0 ? `+${diff}` : diff === 0 ? "=" : diff}
                    </span>
                  ) : (
                    <span className="text-[#9ca3af] dark:text-[#5c6478]">
                      —
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 dark:bg-[#1c2028] rounded-xl p-3">
      <div className="text-[11px] text-[#9ca3af] dark:text-[#5c6478] mb-0.5">
        {label}
      </div>
      <div className="text-[13px] font-medium text-[#111827] dark:text-[#e8eaf0] truncate">
        {value}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-gray-50 dark:bg-[#1c2028] rounded-xl p-4 text-center">
      <div className="text-2xl font-semibold text-[#111827] dark:text-[#e8eaf0]">
        {value}
      </div>
      <div className="text-xs text-[#9ca3af] dark:text-[#5c6478]">
        {label} {sub}
      </div>
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const cls =
    sentiment === "positive"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
      : sentiment === "negative"
        ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
        : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400";

  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize ${cls}`}
    >
      {sentiment}
    </span>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="py-16 text-center">
      <div className="flex justify-center mb-3 opacity-20">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="w-12 h-12 text-[#9ca3af]"
        >
          {icon === "reviews" && (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
            />
          )}
          {icon === "changes" && (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3"
            />
          )}
          {icon === "keywords" && (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605"
            />
          )}
        </svg>
      </div>
      <div className="text-sm font-medium text-[#6b7280] dark:text-[#8b93a5] mb-1">
        {title}
      </div>
      <div className="text-xs text-[#9ca3af] dark:text-[#5c6478]">
        {subtitle}
      </div>
    </div>
  );
}
