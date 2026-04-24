import { textPrimary } from "../../styles";
export default function MonetizationProducts() {
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
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      </div>
      <div>
        <h2 className={`text-lg font-semibold ${textPrimary}`}>
          In-App Products
        </h2>
        <p className="text-sm text-gray-500 dark:text-[#8b93a5] mt-1 max-w-sm">
          Manage your one-time in-app purchases here. This feature is coming
          soon.
        </p>
      </div>
    </div>
  );
}
