import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { prisma } from "./config";
import { createMcpServer } from "./web/mcp";

async function main() {
  const apiKey = process.env.MCP_API_KEY;
  if (!apiKey) {
    process.stderr.write(
      "AppCore MCP: MCP_API_KEY environment variable is required.\n" +
        "Generate a key on the /agents page and add it to your Claude Desktop config.\n",
    );
    process.exit(1);
  }

  const settings = await prisma.userSettings.findFirst({
    where: { mcpApiKey: apiKey, mcpEnabled: true },
  });

  if (!settings) {
    process.stderr.write(
      "AppCore MCP: Invalid or disabled API key.\n" +
        "Make sure the key is correct and MCP is enabled on the /agents page.\n",
    );
    process.exit(1);
  }

  const server = createMcpServer(settings.userId);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`AppCore MCP fatal error: ${err}\n`);
  process.exit(1);
});
