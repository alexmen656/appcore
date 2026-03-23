import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

interface SearchItem {
  id: string;
  label: string;
  sublabel?: string;
  category: string;
  to: string;
  icon: "page" | "keyword" | "competitor" | "suggestion";
}

const STATIC_ITEMS: SearchItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    category: "Pages",
    to: "/dashboard",
    icon: "page",
  },
  {
    id: "analytics",
    label: "Analytics",
    category: "Pages",
    to: "/analytics",
    icon: "page",
  },
  {
    id: "keywords",
    label: "Keywords",
    category: "Pages",
    to: "/keywords",
    icon: "page",
  },
  {
    id: "competitors",
    label: "Competitors",
    category: "Pages",
    to: "/competitors",
    icon: "page",
  },
  {
    id: "suggestions",
    label: "Suggestions",
    category: "Pages",
    to: "/suggestions",
    icon: "page",
  },
  {
    id: "agents",
    label: "Agents",
    category: "Pages",
    to: "/agents",
    icon: "page",
  },
  {
    id: "logs",
    label: "Logs",
    category: "Pages",
    to: "/actions",
    icon: "page",
  },
  {
    id: "settings",
    label: "Settings",
    category: "Pages",
    to: "/app-settings",
    icon: "page",
  },
  {
    id: "team",
    label: "Team",
    category: "Pages",
    to: "/settings",
    icon: "page",
  },
];

const IconPage = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 9h6M9 13h4" />
  </svg>
);

const IconKeywordItem = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4"
  >
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const IconCompetitorItem = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4"
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M6 20v-2a6 6 0 0 1 12 0v2" />
  </svg>
);

const IconSuggestionItem = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4"
  >
    <path d="M12 2a10 10 0 1 0 10 10" />
    <path d="M12 8v4l3 3" />
  </svg>
);

function ItemIcon({ type }: { type: SearchItem["icon"] }) {
  switch (type) {
    case "keyword":
      return <IconKeywordItem />;
    case "competitor":
      return <IconCompetitorItem />;
    case "suggestion":
      return <IconSuggestionItem />;
    default:
      return <IconPage />;
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SearchModal({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [apiResults, setApiResults] = useState<SearchItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setApiResults([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setApiResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("appcore_token") ?? ""}`,
            },
          },
        );
        if (!res.ok) return;
        const data = await res.json();
        setApiResults(data as SearchItem[]);
      } catch {
        // ignore
      }
    }, 200);
  }, [query]);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setResults([]);
      setActiveIndex(0);
      return;
    }
    const staticMatches = STATIC_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q),
    );
    const merged = [...staticMatches, ...apiResults];
    setResults(merged);
    setActiveIndex(0);
  }, [query, apiResults]);

  const handleSelect = useCallback(
    (item: SearchItem) => {
      navigate(item.to);
      onClose();
    },
    [navigate, onClose],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[activeIndex]) handleSelect(results[activeIndex]);
    }
  };

  if (!open) return null;

  // Group results by category
  const grouped: Record<string, SearchItem[]> = {};
  for (const item of results) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  let globalIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-[560px] mx-4 bg-white dark:bg-[#1c2028] rounded-xl shadow-2xl border border-[#eef0f3] dark:border-[#2a2f3d] overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#eef0f3] dark:border-[#2a2f3d]">
          <svg
            className="w-4 h-4 text-[#9ca3af] dark:text-[#5c6478] shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search…"
            className="flex-1 text-sm bg-transparent outline-none text-[#111827] dark:text-[#e8eaf0] placeholder-[#9ca3af] dark:placeholder-[#5c6478]"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-[#9ca3af] dark:text-[#5c6478] hover:text-[#6b7280] dark:hover:text-[#8b93a5] text-xs"
            >
              Clear
            </button>
          )}
        </div>

        {results.length > 0 && (
          <div className="max-h-[380px] overflow-y-auto py-2">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-[#9ca3af] dark:text-[#5c6478]">
                  {category}
                </div>
                {items.map((item) => {
                  const idx = globalIndex++;
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={item.id}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => handleSelect(item)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isActive
                          ? "bg-[#f3f4f6] dark:bg-[#252b38]"
                          : "hover:bg-[#f9fafb] dark:hover:bg-[#252b38]"
                      }`}
                    >
                      <span
                        className={`shrink-0 ${isActive ? "text-[#ea0e2b]" : "text-[#9ca3af] dark:text-[#5c6478]"}`}
                      >
                        <ItemIcon type={item.icon} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-[#111827] dark:text-[#e8eaf0] truncate">
                          {item.label}
                        </span>
                        {item.sublabel && (
                          <span className="block text-xs text-[#9ca3af] dark:text-[#5c6478] truncate">
                            {item.sublabel}
                          </span>
                        )}
                      </span>
                      {isActive && (
                        <span className="shrink-0 text-[10px] text-[#9ca3af] dark:text-[#5c6478] font-mono bg-[#eef0f3] dark:bg-[#2a2f3d] px-1.5 py-0.5 rounded">
                          ↵
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {query.trim() && results.length === 0 && (
          <div className="py-10 text-center text-sm text-[#9ca3af] dark:text-[#5c6478]">
            No results for &ldquo;{query}&rdquo;
          </div>
        )}

        {!query && (
          <div className="py-8 text-center text-sm text-[#9ca3af] dark:text-[#5c6478]">
            Type to search pages, keywords, and more…
          </div>
        )}

        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-[#eef0f3] dark:border-[#2a2f3d] text-[11px] text-[#c4c9d4] dark:text-[#3d4556]">
          <span>
            <kbd className="font-mono">↑↓</kbd> Navigate
          </span>
          <span>
            <kbd className="font-mono">↵</kbd> Open
          </span>
          <span>
            <kbd className="font-mono">Esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
}
