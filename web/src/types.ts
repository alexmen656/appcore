// ─── Shared types used across multiple components ─────────────────────────────

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface DayData {
  date: string;
  downloads: number;
  updates: number;
  proceeds: number;
  impressions: number;
  pageViews: number;
  sessions: number;
}

/** Subset of DayData used in DownloadsChart (no engagement metrics) */
export type DownloadsDayData = Pick<DayData, "date" | "downloads" | "updates" | "proceeds">;

export interface CountryData {
  country: string;
  downloads: number;
  impressions: number;
  pageViews: number;
}

export interface DownloadsData {
  byDay: DayData[];
  byCountry: CountryData[];
}

export interface AnalyticsSummary {
  totalDownloads: number;
  totalProceeds: number;
  totalImpressions: number;
  totalPageViews: number;
  totalSessions: number;
  conversionRate: number | null;
  avgRating: number | null;
  reviewCount: number;
  lastSyncAt: string | null;
}

export interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  reviewerNickname: string | null;
  territory: string | null;
  reviewedAt: string;
}

// ─── Apps ─────────────────────────────────────────────────────────────────────

export interface AppItem {
  id: string;
  bundleId: string;
  name: string;
  isOwnApp: boolean;
  rating: number | null;
  ratingsCount: number | null;
  iconUrl: string | null;
  subtitle: string | null;
  competitorCount: number;
  updatedAt: string;
}

export interface AscApp {
  ascId: string;
  name: string;
  bundleId: string;
  sku: string | null;
  primaryLocale: string | null;
  iconUrl: string | null;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface AppInfo {
  name: string;
  bundleId: string;
  title: string;
  subtitle: string;
  keywords: string;
  rating: number;
  ratingsCount: number;
  iconUrl: string;
}

export interface Stats {
  apps: number;
  snapshots: number;
  keywords: number;
  rankings: number;
  pendingSuggestions: number;
  appliedSuggestions: number;
  jobs: number;
}

export interface DashboardConfig {
  bundleId: string;
  country: string;
  locales: string;
  aiProvider: string;
  hasOpenAI: boolean;
  hasAnthropic: boolean;
  hasASC: boolean;
  hasSearchAds: boolean;
  scrapeInterval: number;
}

export interface LastJob {
  type: string;
  status: string;
  createdAt: string;
  itemsCount: number;
}

export interface RecentSuggestion {
  id: string;
  type: string;
  locale: string;
  value: string;
  confidence: number;
  status: string;
  createdAt: string;
}

export interface DashboardData {
  app: AppInfo | null;
  stats: Stats;
  config: DashboardConfig;
  lastJob: LastJob | null;
  recentSuggestions: RecentSuggestion[];
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export interface Job {
  id: string;
  type: string;
  status: string;
  result: string | null;
  error: string | null;
  itemsCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

// ─── Keywords ─────────────────────────────────────────────────────────────────

export interface Keyword {
  id: string;
  term: string;
  country: string;
  language: string;
  popularity: number | null;
  difficulty: number | null;
  searchVolume: number | null;
  ourRank: number | null;
  topCompetitor: { name: string; rank: number } | null;
  trackingCount: number;
  suggestionCount: number;
  updatedAt: string;
}

export interface RankingEntry {
  rank: number | null;
  appName: string;
  appBundleId: string;
  country: string;
  trackedAt: string;
}

export interface KeywordHistoryData {
  keyword: {
    id: string;
    term: string;
    popularity: number | null;
    difficulty: number | null;
  };
  rankings: RankingEntry[];
}

// ─── Suggestions ──────────────────────────────────────────────────────────────

export interface Suggestion {
  id: string;
  type: string;
  locale: string;
  suggestedValue: string;
  currentValue: string | null;
  reasoning: string;
  confidenceScore: number | null;
  estimatedImpact: number | null;
  status: string;
  aiProvider: string;
  aiModel: string;
  keyword: string | null;
  createdAt: string;
  appliedAt: string | null;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface SettingsData {
  ascIssuerId: string;
  ascKeyId: string;
  ascPrivateKey: string;
  ascPrivateKeySet: boolean;
  ascAppId: string;
  ascBundleId: string;
  ascVendorNumber: string;
  openaiApiKey: string;
  openaiApiKeySet: boolean;
  anthropicApiKey: string;
  anthropicApiKeySet: boolean;
  aiProvider: string;
  scrapeCountry: string;
  scrapeIntervalHours: number;
  maxCompetitors: number;
  asoLocales: string;
}

// ─── GitHub ───────────────────────────────────────────────────────────────────

export interface GitHubStatus {
  connected: boolean;
  username: string | null;
  avatarUrl: string | null;
  connectedAt: string | null;
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
}

export interface AppRepoLink {
  linked: boolean;
  repoFullName: string | null;
  repoOwner: string | null;
  repoName: string | null;
}

export interface ScreenshotJob {
  id: string;
  appId: string;
  commitSha: string;
  commitMessage: string | null;
  branch: string | null;
  pusher: string | null;
  status: string;
  logs: string[];
  error: string | null;
  screenshotUrls: string[];
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export interface ActionCardDef {
  id: string;
  label: string;
  title: string;
  desc: string;
  primary?: boolean;
}

export interface SchedulerStatus {
  running: boolean;
  jobCount: number;
}

// ─── MCP / Agents ─────────────────────────────────────────────────────────────

export interface McpConfig {
  mcpEnabled: boolean;
  mcpApiKey: string | null;
}
// ─── Versions / Metadata ──────────────────────────────────────────────────────

export interface VersionSummary {
  versionId: string;
  versionString: string;
  appStoreState: string;
  platform: string;
  isEditable: boolean;
}

export interface VersionLocalization {
  locale: string;
  appInfoLocalizationId: string | null;
  versionLocalizationId: string | null;
  name: string;
  subtitle: string;
  description: string;
  keywords: string;
  whatsNew: string;
  promotionalText: string;
  supportUrl?: string;
  privacyPolicyUrl?: string;
}

export interface VersionsData {
  appId: string;
  appName: string;
  bundleId: string;
  versionId: string | null;
  versionString: string | null;
  appStoreState: string | null;
  isEditable: boolean;
  copyright?: string;
  ageRating?: string;
  localizations: VersionLocalization[];
}