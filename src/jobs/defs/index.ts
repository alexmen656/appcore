import type { JobDefinition } from "../types";
import scrapeJob from "./scrape";
import trackKeywordsJob from "./track-keywords";
import analyzeJob from "./analyze";
import extractKeywordsJob from "./extract-keywords";
import discoverKeywordsJob from "./discover-keywords";
import discoverCompetitorsJob from "./discover-competitors";
import syncAnalyticsJob from "./sync-analytics";

export const allJobs: JobDefinition[] = [
  scrapeJob,
  analyzeJob,
  extractKeywordsJob,
  discoverKeywordsJob,
  discoverCompetitorsJob,
  trackKeywordsJob,
  syncAnalyticsJob,
];
