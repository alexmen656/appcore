import { useState } from "react";

interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  reviewerNickname: string | null;
  territory: string | null;
  reviewedAt: string;
}

interface Props {
  reviews: Review[];
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-[13px] leading-none">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rating ? "text-amber-400" : "text-[#d1d5db]"}>
          ★
        </span>
      ))}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const PAGE_SIZE = 20;

export default function ReviewsList({ reviews }: Props) {
  const [shown, setShown] = useState(PAGE_SIZE);

  if (reviews.length === 0) {
    return (
      <div className="bg-white border border-[#e5e7eb] rounded-xl p-5">
        <div className="text-[15px] font-semibold text-[#1a1a2e] mb-1">Customer Reviews</div>
        <div className="text-[13px] text-[#9ca3af] py-8 text-center">No reviews yet.</div>
      </div>
    );
  }

  const visible = reviews.slice(0, shown);

  return (
    <div className="bg-white border border-[#e5e7eb] rounded-xl p-5">
      <div className="text-[15px] font-semibold text-[#1a1a2e] mb-4">
        Customer Reviews
        <span className="ml-2 text-[12px] font-normal text-[#9ca3af]">
          {reviews.length} total
        </span>
      </div>

      <div className="divide-y divide-[#f0f0f0]">
        {visible.map((r) => (
          <div key={r.id} className="py-3.5 first:pt-0 last:pb-0">
            <div className="flex items-center gap-2 mb-1">
              <Stars rating={r.rating} />
              {r.title && (
                <span className="text-[13px] font-medium text-[#1a1a2e] truncate max-w-[280px]">
                  {r.title}
                </span>
              )}
              <div className="ml-auto flex items-center gap-1.5 shrink-0">
                {r.territory && (
                  <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium bg-[#f7f8fa] text-[#6b7280] border border-[#e5e7eb]">
                    {r.territory.slice(0, 2)}
                  </span>
                )}
                <span className="text-[11px] text-[#9ca3af]">{fmtDate(r.reviewedAt)}</span>
              </div>
            </div>
            {r.body && (
              <p className="text-[13px] text-[#4b5563] leading-relaxed line-clamp-3">{r.body}</p>
            )}
            {r.reviewerNickname && (
              <div className="text-[11px] text-[#9ca3af] mt-1">— {r.reviewerNickname}</div>
            )}
          </div>
        ))}
      </div>

      {shown < reviews.length && (
        <button
          onClick={() => setShown((s) => s + PAGE_SIZE)}
          className="mt-4 w-full py-2 rounded-[6px] text-[13px] font-medium text-[#6b7280] border border-[#e5e7eb] hover:bg-[#f7f8fa] transition-colors"
        >
          Load more ({reviews.length - shown} remaining)
        </button>
      )}
    </div>
  );
}
