import { AppStoreScraper } from "../src/services/appstore-scraper";

const APPS = [
  { bundleId: "com.duolingo.DuolingoMobile", country: "us" },
  { bundleId: "com.burbn.instagram", country: "us" },
  { bundleId: "com.spotify.client", country: "us" },
  { bundleId: "com.calm.calmapp", country: "us" },
];

const SUBSCRIPTION_HINT =
  /\b(week|weekly|month|monthly|year|yearly|annual|quarter|season|sub|subscription|premium|plus|pro|unlimited)\b/i;

async function main() {
  for (const { bundleId, country } of APPS) {
    const scraper = new AppStoreScraper(country);
    const itunes = await scraper.lookupByBundleId(bundleId);
    if (!itunes) {
      console.log(`\n### ${bundleId} — NOT FOUND`);
      continue;
    }
    const items = await scraper.scrapeMonetization(itunes.trackId);
    console.log(`\n### ${itunes.trackName} (${bundleId}, track ${itunes.trackId}) — ${items.length} products`);
    for (const i of items) {
      const kind = SUBSCRIPTION_HINT.test(i.name) ? "SUB" : "IAP";
      console.log(`  [${kind}] ${i.name}  —  ${i.price ?? "(no price)"}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
