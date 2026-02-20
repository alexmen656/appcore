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

export interface AscApp {
  ascId: string;
  name: string;
  bundleId: string;
  sku: string | null;
  primaryLocale: string | null;
}
