import type { JobDefinition } from "../types";
import scrapeJob from "./scrape";
import trackKeywordsJob from "./track-keywords";
import analyzeJob from "./analyze";
import extractKeywordsJob from "./extract-keywords";
import discoverKeywordsJob from "./discover-keywords";
import syncAnalyticsJob from "./sync-analytics";

export const allJobs: JobDefinition[] = [
  scrapeJob,
  analyzeJob,
  extractKeywordsJob,
  discoverKeywordsJob,
  trackKeywordsJob,
  syncAnalyticsJob,
];
