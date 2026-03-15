import { useState } from "react";
import { useApi, apiPut, apiPost, apiDelete } from "../hooks/useApi";
import SectionCard from "./comps/settings/SectionCard";
import Field from "./comps/settings/Field";
import type { McpConfig, OAuthClient } from "../types";
import { inputCls, btnSecondary, btnSecSm, TH, TD } from "../styles";

interface Props {
  addToast: (msg: string, type?: "success" | "error") => void;
}

const MCP_TOOLS = [
  {
    name: "list_apps",
    desc: "Discover all managed apps with bundle IDs and live stats — start here for multi-app workflows",
  },
  {
    name: "get_app_info",
    desc: "Current title, subtitle, keywords and description for an app",
  },
  {
    name: "get_keywords",
    desc: "Tracked keywords with popularity scores and current rankings",
  },
  {
    name: "get_competitors",
    desc: "Competitor apps with relevance scores and latest ratings",
  },
  {
    name: "get_suggestions",
    desc: "AI-generated ASO suggestions, filterable by status (PENDING, APPROVED, etc.)",
  },
  {
    name: "get_analytics",
    desc: "Downloads, revenue, impressions and page views for a configurable date range",
  },
  {
    name: "get_reviews",
    desc: "App Store reviews with optional rating and territory filters",
  },
  {
    name: "update_suggestion",
    desc: "Approve, reject, or mark an ASO suggestion as applied",
  },
  {
    name: "trigger_job",
    desc: "Trigger a background job: scrape, analyze, sync, track-keywords, discover-keywords",
  },
];

export default function Agents({ addToast }: Props) {
  const { data: config, refetch } = useApi<McpConfig>("/mcp/config", [], true);
  const { data: oauthClients, refetch: refetchClients } = useApi<OAuthClient[]>(
    "/mcp/oauth-clients",
    [],
    true,
  );

  const [toggling, setToggling] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [localKey, setLocalKey] = useState<string | null>(null);
  const [configTab, setConfigTab] = useState<"http" | "stdio">("http");

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const displayKey = localKey ?? config?.mcpApiKey ?? null;
  const mcpUrl =
    typeof window !== "undefined" ? `${window.location.origin}/mcp` : "/mcp";
  const mcpBaseUrl =
    typeof window !== "undefined" ? window.location.origin : "";

  const handleToggle = async () => {
    if (!config) return;
    setToggling(true);
    try {
      await apiPut("/mcp/config", { mcpEnabled: !config.mcpEnabled });
      await refetch();
      addToast(
        config.mcpEnabled ? "MCP server disabled" : "MCP server enabled",
        "success",
      );
    } catch {
      addToast("Failed to update MCP status", "error");
    } finally {
      setToggling(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const result = await apiPost<{ ok: boolean; mcpApiKey: string }>(
        "/mcp/regenerate-key",
      );
      setLocalKey(result.mcpApiKey);
      setShowKey(true);
      addToast("New API key generated", "success");
    } catch {
      addToast("Failed to generate key", "error");
    } finally {
      setRegenerating(false);
    }
  };

  const handleDeleteClient = async (id: string) => {
    setDeletingId(id);
    try {
      await apiDelete(`/mcp/oauth-clients/${id}`);
      await refetchClients();
      addToast("OAuth client deleted", "success");
    } catch {
      addToast("Failed to delete OAuth client", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const copyToClipboard = async (text: string | null) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    addToast("Copied to clipboard", "success");
  };

  const claudeDesktopHttpJson = JSON.stringify(
    {
      appcore: {
        type: "http",
        url: mcpUrl,
        headers: {
          Authorization: `Bearer ${displayKey ?? "<your-api-key>"}`,
        },
      },
    },
    null,
    2,
  );

  const appDir =
    typeof window !== "undefined"
      ? window.location.origin.replace(/:\d+$/, "")
      : "/path/to/appcore";

  const claudeDesktopStdioJson = JSON.stringify(
    {
      appcore: {
        command: "npx",
        args: ["tsx", `${appDir}/src/mcp-stdio.ts`],
        env: {
          DATABASE_URL: "<your-database-url>",
          MCP_API_KEY: displayKey ?? "<your-api-key>",
        },
      },
    },
    null,
    2,
  );

  const activeJson =
    configTab === "http" ? claudeDesktopHttpJson : claudeDesktopStdioJson;

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight text-[#111827] dark:text-[#e8eaf0] mb-1">
        Agents
      </h1>
      <p className="text-sm text-[#9ca3af] dark:text-[#5c6478] mb-8">
        Connect AI agents like Claude to your AppCore data via the Model Context
        Protocol (MCP).
      </p>

      <SectionCard
        title="MCP Server"
        desc="Expose AppCore as an MCP server so Claude Desktop and other MCP clients can read your ASO data and trigger jobs."
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-[#111827] dark:text-[#e8eaf0]">
              MCP Server Status
            </div>
            <div className="text-xs text-[#9ca3af] dark:text-[#5c6478] mt-0.5">
              {config?.mcpEnabled
                ? `Active — endpoint available at ${mcpUrl}`
                : "Disabled — no MCP connections are accepted"}
            </div>
          </div>
          <button
            onClick={handleToggle}
            disabled={toggling || !config}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
              config?.mcpEnabled
                ? "bg-[#ea0e2b]"
                : "bg-gray-200 dark:bg-[#2a2f3d]"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                config?.mcpEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title="Connection Details"
        desc="Use these credentials when configuring your MCP client. Treat the API key like a password."
      >
        <div className="flex flex-col gap-4">
          <Field label="Server URL">
            <div className="flex gap-2">
              <input readOnly className={inputCls} value={mcpUrl} />
              <button
                onClick={() => copyToClipboard(mcpUrl)}
                className={btnSecondary}
              >
                Copy
              </button>
            </div>
          </Field>

          <Field
            label="API Key"
            hint={
              displayKey
                ? undefined
                : "No key generated yet. Click Regenerate to create one."
            }
          >
            <div className="flex gap-2">
              <input
                readOnly
                type={showKey ? "text" : "password"}
                className={`${inputCls} font-mono`}
                value={displayKey ?? ""}
                placeholder={displayKey ? undefined : "No key generated"}
              />
              {displayKey && (
                <button
                  onClick={() => setShowKey((v) => !v)}
                  className={btnSecondary}
                >
                  {showKey ? "Hide" : "Show"}
                </button>
              )}
              {displayKey && (
                <button
                  onClick={() => copyToClipboard(displayKey)}
                  className={btnSecondary}
                >
                  Copy
                </button>
              )}
            </div>
          </Field>

          <div>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className={btnSecondary}
            >
              {regenerating ? "Generating…" : "Regenerate Key"}
            </button>
            {displayKey && (
              <p className="text-[11px] text-gray-400 dark:text-[#5c6478] mt-1.5">
                Regenerating invalidates the current key immediately.
              </p>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="OAuth Clients"
        desc="Clients that have connected via OAuth. Claude.ai registers itself automatically — no manual setup needed."
      >
        <div className="mb-5 p-3.5 rounded-xl bg-[#f8f9fb] dark:bg-[#252b38] border border-[#eef0f3] dark:border-[#2a2f3d]">
          <p className="text-[12px] font-medium text-[#111827] dark:text-[#e8eaf0] mb-1.5">
            How to connect Claude.ai
          </p>
          <ol className="text-[12px] text-[#9ca3af] dark:text-[#5c6478] space-y-1 list-decimal list-inside">
            <li>
              In Claude.ai → Settings → Connectors → Add custom connector.
            </li>
            <li>
              Enter the MCP Server URL:{" "}
              <code
                className="font-mono text-[#111827] dark:text-[#e8eaf0] cursor-pointer hover:text-[#ea0e2b]"
                onClick={() => copyToClipboard(mcpUrl)}
                title="Click to copy"
              >
                {mcpUrl}
              </code>
            </li>
            <li>
              Leave OAuth Client ID and Secret{" "}
              <strong className="text-[#111827] dark:text-[#e8eaf0]">
                empty
              </strong>{" "}
              — Claude.ai self-registers via DCR.
            </li>
            <li>
              Claude.ai opens an AppCore login page — sign in to authorize.
            </li>
            <li>Done. The client appears in the table below.</li>
          </ol>
        </div>

        {oauthClients && oauthClients.length > 0 ? (
          <div className="rounded-xl border border-[#eef0f3] dark:border-[#2a2f3d] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f8f9fb] dark:bg-[#252b38]">
                  <th className={TH}>Name</th>
                  <th className={TH}>Client ID</th>
                  <th className={TH}>Registered</th>
                  <th className={TH}></th>
                </tr>
              </thead>
              <tbody>
                {oauthClients.map((client) => (
                  <tr key={client.id}>
                    <td className={TD}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#111827] dark:text-[#e8eaf0]">
                          {client.name}
                        </span>
                        {client.userId === null && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium">
                            auto
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={TD}>
                      <div className="flex items-center gap-1.5">
                        <code className="text-[11px] font-mono text-[#9ca3af] dark:text-[#5c6478]">
                          {client.clientId}
                        </code>
                        <button
                          onClick={() => copyToClipboard(client.clientId)}
                          className="text-[10px] text-[#9ca3af] dark:text-[#5c6478] hover:text-[#ea0e2b] transition-colors"
                          title="Copy Client ID"
                        >
                          ⎘
                        </button>
                      </div>
                    </td>
                    <td className={`${TD} text-[#9ca3af] dark:text-[#5c6478]`}>
                      {new Date(client.createdAt).toLocaleDateString()}
                    </td>
                    <td className={TD}>
                      <button
                        onClick={() => handleDeleteClient(client.id)}
                        disabled={deletingId === client.id}
                        className={`${btnSecSm} !text-red-500 hover:!border-red-300 hover:!text-red-600`}
                      >
                        {deletingId === client.id ? "Revoking…" : "Revoke"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[13px] text-[#9ca3af] dark:text-[#5c6478]">
            No clients connected yet.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Available MCP Tools"
        desc="These tools are exposed to your MCP client and can be called by Claude."
      >
        <div className="flex flex-col gap-2">
          {MCP_TOOLS.map((tool) => (
            <div
              key={tool.name}
              className="flex items-start gap-3 p-3 bg-[#f8f9fb] dark:bg-[#252b38] rounded-xl border border-[#eef0f3] dark:border-[#2a2f3d]"
            >
              <code className="text-[12px] font-mono font-semibold text-[#ea0e2b] shrink-0 mt-0.5">
                {tool.name}
              </code>
              <span className="text-xs text-gray-500 dark:text-[#8b93a5] mt-0.5">
                {tool.desc}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Claude Desktop Configuration"
        desc='Add this snippet to your claude_desktop_config.json under "mcpServers" and restart Claude Desktop.'
      >
        <div className="flex gap-1 mb-4 bg-[#f8f9fb] dark:bg-[#252b38] p-1 rounded-xl border border-[#eef0f3] dark:border-[#2a2f3d] w-fit">
          <button
            onClick={() => setConfigTab("http")}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
              configTab === "http"
                ? "bg-white dark:bg-[#1c2028] text-[#111827] dark:text-[#e8eaf0] shadow-sm border border-[#eef0f3] dark:border-[#2a2f3d]"
                : "text-[#9ca3af] dark:text-[#5c6478] hover:text-[#111827] dark:hover:text-[#e8eaf0]"
            }`}
          >
            HTTP (Remote)
          </button>
          <button
            onClick={() => setConfigTab("stdio")}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
              configTab === "stdio"
                ? "bg-white dark:bg-[#1c2028] text-[#111827] dark:text-[#e8eaf0] shadow-sm border border-[#eef0f3] dark:border-[#2a2f3d]"
                : "text-[#9ca3af] dark:text-[#5c6478] hover:text-[#111827] dark:hover:text-[#e8eaf0]"
            }`}
          >
            Local (stdio)
          </button>
        </div>

        {configTab === "stdio" && (
          <p className="text-[11px] text-[#ea0e2b] bg-[#ea0e2b]/5 border border-[#ea0e2b]/20 rounded-xl px-3 py-2 mb-3">
            Replace <code className="font-mono">/path/to/appcore</code> with the
            absolute path to your AppCore directory and set{" "}
            <code className="font-mono">DATABASE_URL</code> to your PostgreSQL
            connection string. No HTTP server needs to be running.
          </p>
        )}

        <div className="relative">
          <pre className="bg-[#111827] text-[#e5e7eb] text-[12px] font-mono p-4 rounded-xl overflow-x-auto leading-relaxed">
            {activeJson}
          </pre>
          <button
            onClick={() => copyToClipboard(activeJson)}
            className="absolute top-2 right-2 px-2.5 py-1 rounded text-[11px] font-medium bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            Copy
          </button>
        </div>
        <p className="text-[11px] text-[#9ca3af] dark:text-[#5c6478] mt-3">
          Config file location on macOS:{" "}
          <code className="font-mono text-[#111827] dark:text-[#e8eaf0]">
            ~/Library/Application Support/Claude/claude_desktop_config.json
          </code>
        </p>
      </SectionCard>
    </div>
  );
}
