import { useState, useEffect } from "react";
import { useApi, apiPost, authHeaders } from "../../../hooks/useApi";
import SectionCard from "./SectionCard";
import type { GitHubStatus } from "../../../types";
import { btnPrimary, btnSecondary } from "../../../styles";

export default function GitHubSection() {
  const { data: status, loading, refetch } = useApi<GitHubStatus>(
    "/github/status",
    [],
    true,
  );
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnect = async () => {
    try {
      const res = await fetch("/api/github/oauth/start", {
        headers: authHeaders(),
      });
      const { url } = await res.json();
      window.location.href = url;
    } catch (err: any) {
      alert(`Failed to start GitHub OAuth: ${err.message}`);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect your GitHub account? Existing repo links will stop receiving webhooks.")) return;
    setDisconnecting(true);
    try {
      await apiPost("/github/disconnect");
      refetch();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDisconnecting(false);
    }
  };

  // Check for ?github=connected in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("github") === "connected") {
      refetch();
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  if (loading) return null;

  return (
    <SectionCard
      title="GitHub"
      desc="Connect your GitHub account to enable automatic screenshot generation on push."
    >
      {status?.connected ? (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {status.avatarUrl && (
              <img
                src={status.avatarUrl}
                alt=""
                className="w-10 h-10 rounded-full border border-[#eef0f3] dark:border-[#2a2f3d]"
              />
            )}
            <div>
              <div className="text-sm font-medium text-[#111827] dark:text-[#e8eaf0]">
                @{status.username}
              </div>
              <div className="text-[11px] text-[#9ca3af] dark:text-[#5c6478]">
                Connected{" "}
                {status.connectedAt
                  ? new Date(status.connectedAt).toLocaleDateString()
                  : ""}
              </div>
            </div>
          </div>
          <div className="ml-auto">
            <button
              className={btnSecondary}
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="text-sm text-[#6b7280] dark:text-[#8b93a5]">
            No GitHub account connected.
          </div>
          <button className={btnPrimary} onClick={handleConnect}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
            Connect GitHub
          </button>
        </div>
      )}
    </SectionCard>
  );
}
