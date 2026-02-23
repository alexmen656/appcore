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
        className="px-3 py-1.5 border border-gray-200 rounded-md bg-white text-sm text-gray-800 outline-none cursor-pointer focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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
        className="px-3 py-1.5 border border-gray-200 rounded-md bg-white text-sm text-gray-800 outline-none cursor-pointer focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-white text-gray-800 border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
        onClick={onBulkApprove}
      >
        Approve All Pending ({currentLocale})
      </button>
    </div>
  );
}
