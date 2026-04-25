import { useState, useEffect } from "react";
import { useApi, apiPost, authHeaders } from "../../hooks/useApi";
import SectionCard from "./SectionCard";
import type { GitHubStatus } from "../../types";
import { borderDefault, btnPrimary, btnSecondary, textMuted, textPrimary, textSecondary } from "../../styles";
import { GitBranch } from "lucide-react";

export default function GitHubSection() {
  const { data: status, loading, refetch } = useApi<GitHubStatus>("/github/status", [], true);
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("github") === "connected") {
      refetch();
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  if (loading) return null;

  return (
    <SectionCard title="GitHub" desc="Connect your GitHub account to enable automatic screenshot generation on push.">
      {status?.connected ? (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {status.avatarUrl && (
              <img src={status.avatarUrl} alt="" className={`w-10 h-10 rounded-full border ${borderDefault}`} />
            )}
            <div>
              <div className={`text-sm font-medium ${textPrimary}`}>@{status.username}</div>
              <div className={`text-[11px] ${textMuted}`}>
                Connected {status.connectedAt ? new Date(status.connectedAt).toLocaleDateString() : ""}
              </div>
            </div>
          </div>
          <div className="ml-auto">
            <button className={btnSecondary} onClick={handleDisconnect} disabled={disconnecting}>
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <div className={`text-sm ${textSecondary}`}>No GitHub account connected.</div>
          <button className={btnPrimary} onClick={handleConnect}>
            <GitBranch className="w-4 h-4" />
            Connect GitHub
          </button>
        </div>
      )}
    </SectionCard>
  );
}
