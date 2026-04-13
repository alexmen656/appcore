import "dotenv/config";
import express from "express";
import AdminJS, { ComponentLoader } from "adminjs";
import AdminJSExpress from "@adminjs/express";
import { Database, Resource, getModelByName } from "@adminjs/prisma";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma } from "@prisma/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Prisma
// ---------------------------------------------------------------------------
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// BigInt serialization
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

// ---------------------------------------------------------------------------
// AdminJS adapter
// ---------------------------------------------------------------------------
AdminJS.registerAdapter({ Database, Resource });

// ---------------------------------------------------------------------------
// Component Loader
// ---------------------------------------------------------------------------
const componentLoader = new ComponentLoader();
const Components = {
  Dashboard: componentLoader.add(
    "Dashboard",
    path.join(__dirname, "components/dashboard"),
  ),
};

// ---------------------------------------------------------------------------
// Prisma 7 DMMF enrichment (restores stripped metadata)
// ---------------------------------------------------------------------------
function enrichDmmfFromSchema() {
  const schemaPath = path.join(process.cwd(), "prisma/schema.prisma");
  if (!fs.existsSync(schemaPath)) {
    const parentSchema = path.join(process.cwd(), "../prisma/schema.prisma");
    if (fs.existsSync(parentSchema)) {
      return enrichFromFile(parentSchema);
    }
    console.warn("[admin] schema.prisma not found, skipping DMMF enrichment");
    return;
  }
  enrichFromFile(schemaPath);
}

function enrichFromFile(schemaPath: string) {
  const schema = fs.readFileSync(schemaPath, "utf-8");
  const modelBlocks = new Map<string, string>();
  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
  let match;
  while ((match = modelRegex.exec(schema)) !== null) {
    modelBlocks.set(match[1], match[2]);
  }

  const models = (Prisma.dmmf.datamodel.models as any[]);
  for (const model of models) {
    const block = modelBlocks.get(model.name);
    if (!block) continue;
    const lines = block
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l && !l.startsWith("@@") && !l.startsWith("//"));

    for (const field of model.fields) {
      const fieldLine = lines.find((l: string) => l.split(/\s+/)[0] === field.name);
      if (!fieldLine) continue;

      field.isId = fieldLine.includes("@id");
      field.isUnique = fieldLine.includes("@unique");
      field.isUpdatedAt = fieldLine.includes("@updatedAt");
      field.hasDefaultValue = fieldLine.includes("@default(");
      field.isGenerated = false;
      field.isReadOnly = false;

      if (field.kind === "scalar" || field.kind === "enum") {
        const typeStr = fieldLine.split(/\s+/)[1] || "";
        field.isList = typeStr.endsWith("[]");
        field.isRequired = !typeStr.includes("?") && !field.isList;
      } else {
        field.isRequired = false;
        field.isList = fieldLine.split(/\s+/)[1]?.endsWith("[]") ?? false;
      }

      if (field.hasDefaultValue) {
        const dm = fieldLine.match(/@default\(([^)]+)\)/);
        if (dm) {
          const val = dm[1];
          if (val === "now()") field.default = { name: "now", args: [] };
          else if (val === "cuid()") field.default = { name: "cuid", args: [] };
          else if (val === "uuid()") field.default = { name: "uuid", args: [] };
          else if (val === "autoincrement()") field.default = { name: "autoincrement", args: [] };
          else if (val === "true" || val === "false") field.default = val === "true";
          else if (!isNaN(Number(val))) field.default = Number(val);
          else field.default = val.replace(/^"|"$/g, "");
        }
      }

      if (field.kind === "object" && fieldLine.includes("@relation")) {
        const rm = fieldLine.match(/@relation\(([^)]+)\)/);
        if (rm) {
          const fm = rm[1].match(/fields:\s*\[([^\]]+)\]/);
          const rfm = rm[1].match(/references:\s*\[([^\]]+)\]/);
          if (fm) field.relationFromFields = fm[1].split(",").map((s: string) => s.trim());
          if (rfm) field.relationToFields = rfm[1].split(",").map((s: string) => s.trim());
        }
        if (!field.relationFromFields) field.relationFromFields = [];
        if (!field.relationToFields) field.relationToFields = [];
      }
    }
  }
}

enrichDmmfFromSchema();

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------
const modelNames = [
  "Team", "TeamMember", "User", "App", "AppSnapshot",
  "Keyword", "KeywordRanking", "ASOSuggestion",
  "AppStoreAnalytics", "AppReview", "ScreenshotJob", "BuildJob",
  "AsoExperiment", "CompetitorReview", "CompetitorReviewSummary",
  "AppMetadataChange", "DeviceToken", "PushNotificationLog",
  "OAuthClient", "TeamSettings",
];

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
function getNavigation(modelName: string) {
  const groups: Record<string, { models: string[]; icon: string }> = {
    "Benutzer & Teams": { models: ["User", "Team", "TeamMember", "TeamSettings"], icon: "User" },
    Apps: { models: ["App", "AppSnapshot", "AppMetadataChange"], icon: "Smartphone" },
    "ASO Engine": { models: ["Keyword", "KeywordRanking", "ASOSuggestion", "AsoExperiment"], icon: "Activity" },
    "Analytics & Reviews": { models: ["AppStoreAnalytics", "AppReview", "CompetitorReview", "CompetitorReviewSummary"], icon: "BarChart" },
    Jobs: { models: ["ScreenshotJob", "BuildJob"], icon: "Settings" },
    Notifications: { models: ["DeviceToken", "PushNotificationLog"], icon: "Bell" },
    System: { models: ["OAuthClient"], icon: "Shield" },
  };
  for (const [group, cfg] of Object.entries(groups)) {
    if (cfg.models.includes(modelName)) return { name: group, icon: cfg.icon };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Resource config
// ---------------------------------------------------------------------------
function getResourceConfig(name: string) {
  const base = {
    resource: { model: getModelByName(name), client: prisma },
    options: { navigation: getNavigation(name) } as any,
  };

  switch (name) {
    case "App":
      base.options = {
        ...base.options,
        listProperties: ["id", "name", "bundleId", "country", "isOwnApp", "createdAt"],
        showProperties: [
          "id", "name", "bundleId", "teamId", "trackId", "country", "isOwnApp",
          "currentTitle", "currentSubtitle", "currentKeywords",
          "githubRepoFullName", "createdAt", "updatedAt",
        ],
        editProperties: [
          "name", "bundleId", "teamId", "country", "isOwnApp",
          "currentTitle", "currentSubtitle", "currentKeywords", "currentDescription",
          "githubRepoOwner", "githubRepoName", "githubRepoFullName", "githubIosDir",
          "signingTeamId", "snapshotEnvVars",
        ],
        properties: {
          currentDescription: { type: "textarea" },
          currentKeywords: { type: "textarea" },
          snapshotEnvVars: { type: "textarea" },
          signingCertP12: { isVisible: false },
          signingCertPassword: { isVisible: false },
          signingProvisioningProfile: { isVisible: false },
          githubWebhookSecret: { isVisible: false },
        },
        sort: { sortBy: "createdAt", direction: "desc" as const },
      };
      break;
    case "User":
      base.options = {
        ...base.options,
        listProperties: ["id", "email", "name", "role", "createdAt"],
        properties: { passwordHash: { isVisible: false } },
        sort: { sortBy: "createdAt", direction: "desc" as const },
      };
      break;
    case "Keyword":
      base.options = {
        ...base.options,
        listProperties: ["id", "term", "country", "language", "popularity", "difficulty", "searchVolume"],
        sort: { sortBy: "popularity", direction: "desc" as const },
      };
      break;
    case "KeywordRanking":
      base.options = {
        ...base.options,
        listProperties: ["id", "keywordId", "appId", "rank", "country", "trackedAt"],
        sort: { sortBy: "trackedAt", direction: "desc" as const },
      };
      break;
    case "ASOSuggestion":
      base.options = {
        ...base.options,
        listProperties: ["id", "type", "locale", "status", "confidenceScore", "aiModel", "createdAt"],
        showProperties: [
          "id", "type", "locale", "suggestedValue", "reasoning", "currentValue",
          "confidenceScore", "estimatedImpact", "status", "aiProvider", "aiModel",
          "promptTokens", "completionTokens", "appliedAt", "createdAt",
        ],
        properties: {
          suggestedValue: { type: "textarea" },
          reasoning: { type: "textarea" },
          currentValue: { type: "textarea" },
        },
        sort: { sortBy: "createdAt", direction: "desc" as const },
      };
      break;
    case "AsoExperiment":
      base.options = {
        ...base.options,
        listProperties: ["id", "appId", "type", "status", "confidence", "deployedAt", "createdAt"],
        properties: {
          fromValue: { type: "textarea" },
          toValue: { type: "textarea" },
          reason: { type: "textarea" },
        },
        sort: { sortBy: "createdAt", direction: "desc" as const },
      };
      break;
    case "ScreenshotJob":
      base.options = {
        ...base.options,
        listProperties: ["id", "appId", "commitSha", "status", "createdAt"],
        properties: {
          logs: { type: "textarea", isVisible: { list: false, show: true, edit: false, filter: false } },
          error: { type: "textarea" },
        },
        sort: { sortBy: "createdAt", direction: "desc" as const },
      };
      break;
    case "BuildJob":
      base.options = {
        ...base.options,
        listProperties: ["id", "appId", "branch", "status", "createdAt"],
        properties: {
          logs: { type: "textarea", isVisible: { list: false, show: true, edit: false, filter: false } },
          errors: { type: "textarea" },
        },
        sort: { sortBy: "createdAt", direction: "desc" as const },
      };
      break;
    case "AppStoreAnalytics":
      base.options = {
        ...base.options,
        listProperties: ["id", "bundleId", "reportDate", "country", "downloads", "impressions", "pageViews"],
        sort: { sortBy: "reportDate", direction: "desc" as const },
      };
      break;
    case "AppReview":
      base.options = {
        ...base.options,
        listProperties: ["id", "bundleId", "rating", "title", "territory", "reviewedAt"],
        properties: { body: { type: "textarea" } },
        sort: { sortBy: "reviewedAt", direction: "desc" as const },
      };
      break;
    case "CompetitorReview":
      base.options = {
        ...base.options,
        listProperties: ["id", "appId", "rating", "title", "author", "reviewedAt"],
        properties: { body: { type: "textarea" } },
        sort: { sortBy: "reviewedAt", direction: "desc" as const },
      };
      break;
    case "CompetitorReviewSummary":
      base.options = {
        ...base.options,
        listProperties: ["id", "appId", "reviewCount", "averageRating", "sentiment", "createdAt"],
        properties: { summary: { type: "textarea" } },
        sort: { sortBy: "createdAt", direction: "desc" as const },
      };
      break;
    case "AppSnapshot":
      base.options = {
        ...base.options,
        listProperties: ["id", "appId", "title", "rating", "ratingsCount", "version", "scrapedAt"],
        properties: {
          description: { type: "textarea", isVisible: { list: false, show: true, edit: true, filter: false } },
          releaseNotes: { type: "textarea" },
        },
        sort: { sortBy: "scrapedAt", direction: "desc" as const },
      };
      break;
    case "PushNotificationLog":
      base.options = {
        ...base.options,
        listProperties: ["id", "title", "category", "status", "sentAt"],
        sort: { sortBy: "sentAt", direction: "desc" as const },
      };
      break;
    case "TeamSettings":
      base.options = {
        ...base.options,
        properties: {
          ascPrivateKey: { isVisible: false },
          openaiApiKey: { isVisible: { list: false, show: false, edit: true, filter: false } },
          anthropicApiKey: { isVisible: { list: false, show: false, edit: true, filter: false } },
          githubAccessToken: { isVisible: false },
        },
      };
      break;
    case "OAuthClient":
      base.options = {
        ...base.options,
        properties: {
          clientSecret: { isVisible: { list: false, show: false, edit: true, filter: false } },
        },
      };
      break;
  }
  return base;
}

// ---------------------------------------------------------------------------
// Dashboard stats handler
// ---------------------------------------------------------------------------
async function dashboardHandler() {
  const [
    apps, users, teams, keywords, suggestions, experiments,
    screenshotJobs, buildJobs, analyticsRecords, reviews,
    recentExperiments, recentScreenshotJobs, recentBuildJobs, recentApps,
  ] = await Promise.all([
    prisma.app.count(),
    prisma.user.count(),
    prisma.team.count(),
    prisma.keyword.count(),
    prisma.aSOSuggestion.count(),
    prisma.asoExperiment.count(),
    prisma.screenshotJob.count(),
    prisma.buildJob.count(),
    prisma.appStoreAnalytics.count(),
    prisma.appReview.count(),
    prisma.asoExperiment.findMany({
      orderBy: { createdAt: "desc" }, take: 8,
      include: { app: { select: { name: true, bundleId: true } } },
    }),
    prisma.screenshotJob.findMany({
      orderBy: { createdAt: "desc" }, take: 5,
      include: { app: { select: { name: true } } },
    }),
    prisma.buildJob.findMany({
      orderBy: { createdAt: "desc" }, take: 5,
      include: { app: { select: { name: true } } },
    }),
    prisma.app.findMany({
      orderBy: { updatedAt: "desc" }, take: 5,
      select: { name: true, bundleId: true, country: true, isOwnApp: true, updatedAt: true },
    }),
  ]);

  const recentJobs = [
    ...recentScreenshotJobs.map((j: any) => ({ ...j, _type: "Screenshot", appName: j.app?.name })),
    ...recentBuildJobs.map((j: any) => ({ ...j, _type: "Build", appName: j.app?.name })),
  ]
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return {
    apps, users, teams, keywords, suggestions, experiments,
    screenshotJobs, buildJobs, analyticsRecords, reviews,
    recentExperiments, recentJobs, recentApps,
  };
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
const PORT = process.env.ADMIN_PORT ?? 3200;
const app = express();

const resources = modelNames.map((name) => getResourceConfig(name));

const admin = new AdminJS({
  resources,
  componentLoader,
  rootPath: "/admin",
  dashboard: {
    component: Components.Dashboard,
    handler: async () => ({ data: await dashboardHandler() }),
  },
  branding: {
    companyName: "Marteso",
    logo: false,
    theme: {
      colors: {
        primary100: "#D94412",
        primary80: "#E0622F",
        primary60: "#E8844F",
        primary40: "#F0A97A",
        primary20: "#FAEAE2",
        accent: "#1a1a1a",
        filterBg: "#1a1a1a",
        hoverBg: "#2a2a2a",
      },
    },
    withMadeWithLove: false,
  },
  locale: {
    language: "de",
    translations: {
      de: {
        labels: {
          App: "Apps", User: "Benutzer", Team: "Teams",
          TeamMember: "Team-Mitglieder", TeamSettings: "Team-Einstellungen",
          Keyword: "Keywords", KeywordRanking: "Keyword Rankings",
          ASOSuggestion: "ASO Vorschlaege", AsoExperiment: "ASO Experiments",
          AppSnapshot: "App Snapshots", AppStoreAnalytics: "App Store Analytics",
          AppReview: "App Reviews", CompetitorReview: "Wettbewerber Reviews",
          CompetitorReviewSummary: "Review Zusammenfassungen",
          AppMetadataChange: "Metadaten Aenderungen",
          ScreenshotJob: "Screenshot Jobs", BuildJob: "Build Jobs",
          DeviceToken: "Push Tokens", PushNotificationLog: "Push Logs",
          OAuthClient: "OAuth Clients",
        },
        messages: {
          welcomeOnBoard_title: "Willkommen bei Marteso Admin",
          welcomeOnBoard_subtitle: "ASO Engine Control Center",
        },
      },
    },
  },
});

const router = AdminJSExpress.buildRouter(admin);
app.use(admin.options.rootPath, router);

app.listen(PORT, () => {
  console.log(`[admin] Marteso Admin running at http://localhost:${PORT}/admin`);
});
