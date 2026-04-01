import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma, getEffectiveSettings } from "../../../config";

export function registerSuggestionTools(server: McpServer, userId: string) {
  // @ts-ignore
  server.tool(
    "get_suggestions",
    "Get AI-generated ASO suggestions (title, subtitle, keywords, description) for an app. " +
      "Filter by status: PENDING (awaiting review), APPROVED (ready to apply), APPLIED, REJECTED, EXPIRED. " +
      "Use update_suggestion to approve or reject individual suggestions.",
    {
      bundleId: z
        .string()
        .optional()
        .describe(
          "App bundle ID (e.g. 'com.example.myapp'). Uses the user's default app if omitted.",
        ),
      status: z
        .enum(["PENDING", "APPROVED", "APPLIED", "REJECTED", "EXPIRED"])
        .optional()
        .describe(
          "Filter by suggestion status. Returns all statuses if omitted.",
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe("Max suggestions to return (default 20)"),
    },
    async ({ bundleId, status, limit }) => {
      const settings = await getEffectiveSettings(userId);
      const resolvedBundleId = bundleId || settings.ascBundleId;

      const where: Record<string, any> = {};
      if (resolvedBundleId) where.appBundleId = resolvedBundleId;
      if (status) where.status = status;

      const suggestions = await prisma.aSOSuggestion.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      const result = suggestions.map((s) => ({
        id: s.id,
        type: s.type,
        locale: s.locale,
        suggestedValue: s.suggestedValue,
        currentValue: s.currentValue,
        reasoning: s.reasoning,
        confidenceScore: s.confidenceScore,
        estimatedImpact: s.estimatedImpact,
        status: s.status,
        aiProvider: s.aiProvider,
        createdAt: s.createdAt,
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // @ts-ignore
  server.tool(
    "update_suggestion",
    "Update the status of an ASO suggestion. Use this to approve, reject, or mark suggestions as applied. " +
      "Get suggestion IDs from get_suggestions.",
    {
      id: z.string().describe("The suggestion ID returned by get_suggestions."),
      status: z
        .enum(["APPROVED", "REJECTED", "APPLIED", "PENDING", "EXPIRED"])
        .describe("New status to set for the suggestion."),
      resultNotes: z
        .string()
        .optional()
        .describe(
          "Optional notes to record (e.g. 'Applied to en-US locale', or reason for rejection).",
        ),
    },
    async ({ id, status, resultNotes }) => {
      const suggestion = await prisma.aSOSuggestion.findUnique({
        where: { id },
      });

      if (!suggestion) {
        return {
          content: [{ type: "text", text: `Suggestion not found: ${id}` }],
        };
      }

      const updated = await prisma.aSOSuggestion.update({
        where: { id },
        data: {
          status,
          ...(resultNotes ? { resultNotes } : {}),
          ...(status === "APPLIED" ? { appliedAt: new Date() } : {}),
        },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ok: true,
                id: updated.id,
                type: updated.type,
                locale: updated.locale,
                status: updated.status,
                appliedAt: updated.appliedAt,
                resultNotes: updated.resultNotes,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
