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
        className="filter-select"
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
        className="filter-select"
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
      <button className="btn-secondary btn-sm" onClick={onBulkApprove}>
        Approve All Pending ({currentLocale})
      </button>
    </div>
  );
}
