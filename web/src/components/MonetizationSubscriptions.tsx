export default function MonetizationSubscriptions() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 text-center">
      <div className="w-12 h-12 rounded-2xl bg-[#fef2f3] dark:bg-[#2a1f23] flex items-center justify-center">
        <svg
          className="w-6 h-6 text-[#C4001E]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-[#111827] dark:text-[#e8eaf0]">
          Subscriptions
        </h2>
        <p className="text-sm text-gray-500 dark:text-[#8b93a5] mt-1 max-w-sm">
          Manage your in-app subscriptions here. This feature is coming soon.
        </p>
      </div>
    </div>
  );
}
