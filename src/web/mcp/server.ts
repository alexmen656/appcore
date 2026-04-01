import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTools } from "./tools/app-tools";
import { registerAscTools } from "./tools/asc-tools";
import { registerJobTools } from "./tools/job-tools";
import { registerSuggestionTools } from "./tools/suggestion-tools";

export function createMcpServer(userId: string): McpServer {
  const server = new McpServer({
    name: "Marteso",
    version: "1.0.0",
  });

  registerAppTools(server, userId);
  registerAscTools(server, userId);
  registerSuggestionTools(server, userId);
  registerJobTools(server, userId);

  return server;
}
