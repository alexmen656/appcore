import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  couldNotResolveAscAppId,
  createAscClient,
  getSettingsWithBundleId,
  hasAscCredentials,
  mcpToolMessages,
  resolveAscAppId,
} from "./shared";

export function registerAscTools(server: McpServer, userId: string) {
  // @ts-ignore
  server.registerTool(
    "list_asc_versions",
    {
      description:
        "List all App Store Connect versions for an app with their states (e.g. READY_FOR_SALE, PREPARE_FOR_SUBMISSION, IN_REVIEW). " +
        "Use this to discover versionId values for get_version_metadata and update_version_metadata.",
      inputSchema: {
        bundleId: z
          .string()
          .optional()
          .describe(
            "App bundle ID (e.g. 'com.example.myapp'). Uses the user's default app if omitted.",
          ),
      },
    },
    async ({ bundleId }) => {
      const { settings, resolvedBundleId } = await getSettingsWithBundleId(
        userId,
        bundleId,
      );

      if (!hasAscCredentials(settings)) {
        return {
          content: [
            {
              type: "text",
              text: mcpToolMessages.appStoreConnectCredentialsNotConfiguredInSettings,
            },
          ],
        };
      }

      try {
        const asc = await createAscClient(settings);
        const ascAppId = await resolveAscAppId(asc, settings, resolvedBundleId);

        if (!ascAppId) {
          return {
            content: [
              { type: "text", text: couldNotResolveAscAppId(resolvedBundleId) },
            ],
          };
        }

        const versions = await asc.listVersions(ascAppId);
        const result = versions.map((v: any) => ({
          versionId: v.id,
          versionString: v.attributes?.versionString,
          appStoreState: v.attributes?.appStoreState,
          platform: v.attributes?.platform,
          isEditable: [
            "PREPARE_FOR_SUBMISSION",
            "DEVELOPER_REJECTED",
            "REJECTED",
            "METADATA_REJECTED",
            "WAITING_FOR_REVIEW",
          ].includes(v.attributes?.appStoreState),
        }));

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [
            { type: "text", text: `ASC error: ${err?.message ?? String(err)}` },
          ],
        };
      }
    },
  );

  // @ts-ignore
  server.registerTool(
    "get_version_metadata",
    {
      description:
        "Get full App Store Connect metadata for a version across all locales. " +
        "Returns name, subtitle, keywords, description, whatsNew (release notes), and promotionalText per locale. " +
        "Use list_asc_versions to get a versionId, or omit it to use the current editable version.",
      inputSchema: {
        bundleId: z
          .string()
          .optional()
          .describe(
            "App bundle ID (e.g. 'com.example.myapp'). Uses the user's default app if omitted.",
          ),
        versionId: z
          .string()
          .optional()
          .describe(
            "ASC version ID from list_asc_versions. Uses the current editable version if omitted.",
          ),
        locale: z
          .string()
          .optional()
          .describe(
            "Return only this locale (e.g. 'en-US', 'de-DE'). Returns all locales if omitted.",
          ),
      },
    },
    async ({ bundleId, versionId, locale }) => {
      const { settings, resolvedBundleId } = await getSettingsWithBundleId(
        userId,
        bundleId,
      );
      if (!hasAscCredentials(settings)) {
        return {
          content: [
            {
              type: "text",
              text: mcpToolMessages.appStoreConnectCredentialsNotConfigured,
            },
          ],
        };
      }

      try {
        const asc = await createAscClient(settings);
        const ascAppId = await resolveAscAppId(asc, settings, resolvedBundleId);

        if (!ascAppId) {
          return {
            content: [
              { type: "text", text: couldNotResolveAscAppId(resolvedBundleId) },
            ],
          };
        }

        let resolvedVersionId = versionId;
        if (!resolvedVersionId) {
          const editable = await asc.getEditableVersion(ascAppId);
          if (!editable) {
            return {
              content: [
                {
                  type: "text",
                  text: mcpToolMessages.noEditableVersionFound,
                },
              ],
            };
          }
          resolvedVersionId = editable.id;
        }

        const [appInfoLocs, versionLocs] = await Promise.all([
          asc.getAppInfoLocalizations(ascAppId).catch(() => [] as any[]),
          asc
            .getVersionLocalizations(resolvedVersionId, locale)
            .catch(() => [] as any[]),
        ]);

        const appInfoByLocale: Record<string, any> = {};
        for (const l of appInfoLocs) {
          const loc = l.attributes?.locale ?? l.locale;
          appInfoByLocale[loc] = l;
        }

        const localeMap: Record<string, any> = {};
        for (const l of versionLocs) {
          const loc = l.attributes?.locale ?? l.locale;
          if (locale && loc !== locale) continue;
          const appInfo = appInfoByLocale[loc];
          localeMap[loc] = {
            locale: loc,
            appInfoLocalizationId: appInfo?.id ?? null,
            name: appInfo?.attributes?.name ?? null,
            subtitle: appInfo?.attributes?.subtitle ?? null,
            privacyPolicyUrl: appInfo?.attributes?.privacyPolicyUrl ?? null,
            versionLocalizationId: l.id,
            description: l.attributes?.description ?? null,
            keywords: l.attributes?.keywords ?? null,
            whatsNew: l.attributes?.whatsNew ?? null,
            promotionalText: l.attributes?.promotionalText ?? null,
            supportUrl: l.attributes?.supportUrl ?? null,
            marketingUrl: l.attributes?.marketingUrl ?? null,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  versionId: resolvedVersionId,
                  localizations: Object.values(localeMap),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            { type: "text", text: `ASC error: ${err?.message ?? String(err)}` },
          ],
        };
      }
    },
  );

  // @ts-ignore
  server.registerTool(
    "update_version_metadata",
    {
      description:
        "Update a single App Store Connect metadata field for a specific locale. " +
        "App info fields (name, subtitle): pass appInfoLocalizationId. " +
        "Version fields (description, keywords, whatsNew, promotionalText, supportUrl, marketingUrl): pass versionLocalizationId. " +
        "Get these IDs from get_version_metadata.",
      inputSchema: {
        appInfoLocalizationId: z
          .string()
          .optional()
          .describe(
            "ID for app info localization (needed for name, subtitle, privacyPolicyUrl).",
          ),
        versionLocalizationId: z
          .string()
          .optional()
          .describe(
            "ID for version localization (needed for description, keywords, whatsNew, promotionalText, supportUrl, marketingUrl).",
          ),
        field: z
          .string()
          .describe(
            "Which field to update. App info fields: name, subtitle, privacyPolicyUrl. Version fields: description, keywords, whatsNew, promotionalText, supportUrl, marketingUrl.",
          ),
        value: z.string().describe("New value for the field."),
      },
    },
    async ({ appInfoLocalizationId, versionLocalizationId, field, value }) => {
      const { settings } = await getSettingsWithBundleId(userId);
      if (!hasAscCredentials(settings)) {
        return {
          content: [
            {
              type: "text",
              text: mcpToolMessages.appStoreConnectCredentialsNotConfigured,
            },
          ],
        };
      }

      try {
        const asc = await createAscClient(settings);

        const appInfoFields = ["name", "subtitle", "privacyPolicyUrl"];
        if (appInfoFields.includes(field)) {
          if (!appInfoLocalizationId) {
            return {
              content: [
                {
                  type: "text",
                  text: `Field '${field}' requires appInfoLocalizationId. Get it from get_version_metadata.`,
                },
              ],
            };
          }

          await asc.updateAppInfoLocalization(appInfoLocalizationId, {
            [field]: value,
          });
        } else {
          if (!versionLocalizationId) {
            return {
              content: [
                {
                  type: "text",
                  text: `Field '${field}' requires versionLocalizationId. Get it from get_version_metadata.`,
                },
              ],
            };
          }

          await asc.updateVersionLocalization(versionLocalizationId, {
            [field]: value,
          });
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: true, field, value }, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            { type: "text", text: `ASC error: ${err?.message ?? String(err)}` },
          ],
        };
      }
    },
  );
}
