import { useState } from "react";
import { useApi, apiPut, apiPost } from "../hooks/useApi";
import SectionCard from "./comps/settings/SectionCard";
import Field from "./comps/settings/Field";

interface McpConfig {
  mcpEnabled: boolean;
  mcpApiKey: string | null;
}

interface Props {
  addToast: (msg: string, type?: "success" | "error") => void;
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-[#e5e7eb] bg-white text-[13px] text-[#1a1a2e] outline-none focus:ring-2 focus:ring-[#ea0e2b]/20 focus:border-[#ea0e2b] transition-all";

const btnSecondary =
  "inline-flex items-center gap-1.5 px-3 py-[7px] rounded-lg border border-[#e5e7eb] bg-transparent text-[#1a1a2e] text-[13px] font-medium transition-all hover:border-[#ea0e2b] hover:text-[#ea0e2b] disabled:opacity-50 disabled:cursor-not-allowed";

const MCP_TOOLS = [
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
    desc: "Downloads and revenue summary for a configurable date range",
  },
  {
    name: "trigger_job",
    desc: "Trigger a background job: scrape, analyze, sync, track-keywords, discover-keywords",
  },
];

export default function Agents({ addToast }: Props) {
  const { data: config, refetch } = useApi<McpConfig>("/mcp/config", [], true);
  const [toggling, setToggling] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [localKey, setLocalKey] = useState<string | null>(null);
  const [configTab, setConfigTab] = useState<"http" | "stdio">("http");

  const displayKey = localKey ?? config?.mcpApiKey ?? null;
  const mcpUrl =
    typeof window !== "undefined" ? `${window.location.origin}/mcp` : "/mcp";

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
      ? window.location.origin.replace(/:\d+$/, "") // strip port — just a hint
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
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto px-8 py-8">
        <div className="mb-7">
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">Agents</h1>
          <p className="text-sm text-gray-400 mt-1">
            Connect AI agents like Claude to your AppCore data via the Model
            Context Protocol (MCP).
          </p>
        </div>

        {/* ── Status ── */}
        <SectionCard
          title="MCP Server"
          desc="Expose AppCore as an MCP server so Claude Desktop and other MCP clients can read your ASO data and trigger jobs."
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-[#1a1a2e]">
                MCP Server Status
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {config?.mcpEnabled
                  ? `Active — endpoint available at ${mcpUrl}`
                  : "Disabled — no MCP connections are accepted"}
              </div>
            </div>
            <button
              onClick={handleToggle}
              disabled={toggling || !config}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                config?.mcpEnabled ? "bg-[#ea0e2b]" : "bg-gray-200"
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

        {/* ── Connection Details ── */}
        <SectionCard
          title="Connection Details"
          desc="Use these credentials when configuring your MCP client. Treat the API key like a password."
        >
          <div className="flex flex-col gap-4">
            <Field label="Server URL">
              <div className="flex gap-2">
                <input
                  readOnly
                  className={inputCls}
                  value={mcpUrl}
                />
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
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Regenerating invalidates the current key immediately.
                </p>
              )}
            </div>
          </div>
        </SectionCard>

        {/* ── Available Tools ── */}
        <SectionCard
          title="Available MCP Tools"
          desc="These tools are exposed to your MCP client and can be called by Claude."
        >
          <div className="flex flex-col gap-2">
            {MCP_TOOLS.map((tool) => (
              <div
                key={tool.name}
                className="flex items-start gap-3 p-3 bg-[#f7f8fa] rounded-lg border border-[#e5e7eb]"
              >
                <code className="text-[12px] font-mono font-semibold text-[#ea0e2b] shrink-0 mt-0.5">
                  {tool.name}
                </code>
                <span className="text-xs text-gray-500 mt-0.5">{tool.desc}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ── Claude Desktop Setup ── */}
        <SectionCard
          title="Claude Desktop Configuration"
          desc='Add this snippet to your claude_desktop_config.json under "mcpServers" and restart Claude Desktop.'
        >
          {/* Tab switcher */}
          <div className="flex gap-1 mb-4 bg-[#f7f8fa] p-1 rounded-lg border border-[#e5e7eb] w-fit">
            <button
              onClick={() => setConfigTab("http")}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                configTab === "http"
                  ? "bg-white text-[#1a1a2e] shadow-sm border border-[#e5e7eb]"
                  : "text-gray-400 hover:text-[#1a1a2e]"
              }`}
            >
              HTTP (Remote)
            </button>
            <button
              onClick={() => setConfigTab("stdio")}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                configTab === "stdio"
                  ? "bg-white text-[#1a1a2e] shadow-sm border border-[#e5e7eb]"
                  : "text-gray-400 hover:text-[#1a1a2e]"
              }`}
            >
              Local (stdio)
            </button>
          </div>

          {configTab === "stdio" && (
            <p className="text-[11px] text-[#ea0e2b] bg-[#ea0e2b]/5 border border-[#ea0e2b]/20 rounded-lg px-3 py-2 mb-3">
              Replace <code className="font-mono">/path/to/appcore</code> with
              the absolute path to your AppCore directory and set{" "}
              <code className="font-mono">DATABASE_URL</code> to your PostgreSQL
              connection string. No HTTP server needs to be running.
            </p>
          )}

          <div className="relative">
            <pre className="bg-[#1a1a2e] text-[#e5e7eb] text-[12px] font-mono p-4 rounded-lg overflow-x-auto leading-relaxed">
              {activeJson}
            </pre>
            <button
              onClick={() => copyToClipboard(activeJson)}
              className="absolute top-2 right-2 px-2.5 py-1 rounded text-[11px] font-medium bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              Copy
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-3">
            Config file location on macOS:{" "}
            <code className="font-mono text-[#1a1a2e]">
              ~/Library/Application Support/Claude/claude_desktop_config.json
            </code>
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
