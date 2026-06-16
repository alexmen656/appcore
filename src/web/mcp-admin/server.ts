import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerUserTools } from "./tools/user-tools";
import { registerTeamTools } from "./tools/team-tools";
import { registerStatsTools } from "./tools/stats-tools";
import { registerSubscriptionTools } from "./tools/subscription-tools";

export function createAdminMcpServer(adminUserId: string | null): McpServer {
  const server = new McpServer({
    name: "Marteso Admin",
    version: "1.0.0",
  });

  registerUserTools(server, adminUserId);
  registerTeamTools(server, adminUserId);
  registerSubscriptionTools(server, adminUserId);
  registerStatsTools(server, adminUserId);

  return server;
}
