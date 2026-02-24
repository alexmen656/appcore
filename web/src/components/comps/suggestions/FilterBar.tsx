interface Props {
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  currentLocale: string;
  onBulkApprove: () => void;
}

export default function FilterBar({
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  currentLocale,
  onBulkApprove,
}: Props) {
  return (
    <div className="flex items-center gap-3 flex-wrap mb-5">
      <select
        className="px-3 py-1.5 border border-[#eef0f3] rounded-xl bg-white text-sm text-[#111827] outline-none cursor-pointer focus:border-[#ea0e2b] transition-colors"
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
      >
        <option value="">All Statuses</option>
        <option value="PENDING">Pending</option>
        <option value="APPROVED">Approved</option>
        <option value="APPLIED">Applied</option>
        <option value="REJECTED">Rejected</option>
      </select>
      <select
        className="px-3 py-1.5 border border-[#eef0f3] rounded-xl bg-white text-sm text-[#111827] outline-none cursor-pointer focus:border-[#ea0e2b] transition-colors"
        value={typeFilter}
        onChange={(e) => setTypeFilter(e.target.value)}
      >
        <option value="">All Types</option>
        <option value="TITLE">Title</option>
        <option value="SUBTITLE">Subtitle</option>
        <option value="KEYWORDS">Keywords</option>
        <option value="DESCRIPTION">Description</option>
      </select>
      <div className="flex-1" />
      <button
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium bg-white text-[#111827] border border-[#eef0f3] hover:bg-gray-50 transition-colors cursor-pointer"
        onClick={onBulkApprove}
      >
        Approve All Pending ({currentLocale})
      </button>
    </div>
  );
}
