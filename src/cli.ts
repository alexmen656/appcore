import { Command } from "commander";
import { logger, prisma, env } from "./config";
import { AppStoreScraper, KeywordTracker, AIAnalyzer } from "./services";
import { Scheduler } from "./jobs/scheduler";

const program = new Command();

program
  .name("appcore")
  .description("Automated ASO optimization engine for Kalbuddy")
  .version("0.1.0");

// ─── Scrape Commands ────────────────────────────────────────────────────

program
  .command("scrape")
  .description("Scrape app metadata from the App Store")
  .option("-b, --bundle-id <bundleId>", "Bundle ID to scrape")
  .option("--discover <terms...>", "Discover competitors by search terms")
  .option("--full", "Run full scrape (own app + all competitors)")
  .action(async (options) => {
    const scraper = new AppStoreScraper();

    if (options.full) {
      logger.info("Running full scrape job...");
      await scraper.runFullScrapeJob();
    } else if (options.discover) {
      logger.info(`Discovering competitors for: ${options.discover.join(", ")}`);
      await scraper.scrapeAndSaveApp(env.ASC_BUNDLE_ID, true);
      const ids = await scraper.discoverCompetitors(
        options.discover,
        env.ASC_BUNDLE_ID,
        env.MAX_COMPETITORS
      );
      logger.info(`Found ${ids.length} competitors`);
    } else if (options.bundleId) {
      await scraper.scrapeAndSaveApp(options.bundleId, false);
    } else {
      // Default: scrape our own app
      await scraper.scrapeAndSaveApp(env.ASC_BUNDLE_ID, true);
    }

    await prisma.$disconnect();
  });

// ─── Keyword Commands ───────────────────────────────────────────────────

program
  .command("track")
  .description("Track keyword rankings")
  .option("-a, --add <keywords...>", "Add keywords to track")
  .option("--all", "Track all monitored keywords now")
  .option("--summary", "Show current ranking summary")
  .option("--history <keyword>", "Show ranking history for a keyword")
  .action(async (options) => {
    const tracker = new KeywordTracker();

    if (options.add) {
      await tracker.addKeywords(options.add);
      logger.info(`Added keywords: ${options.add.join(", ")}`);
    }

    if (options.all) {
      const rankings = await tracker.trackAllKeywords();
      for (const [keyword, rank] of rankings) {
        console.log(
          `  ${keyword}: ${rank ? `#${rank}` : "not ranked"}`
        );
      }
    }

    if (options.summary) {
      const summary = await tracker.getCurrentRankingSummary();
      console.log("\n📊 Keyword Ranking Summary:");
      console.log("─".repeat(70));
      for (const item of summary) {
        const ourRank = item.ourRank ? `#${item.ourRank}` : "—";
        const comp = item.topCompetitor
          ? `${item.topCompetitor} #${item.topCompetitorRank}`
          : "—";
        console.log(
          `  ${item.keyword.padEnd(30)} Rang: ${ourRank.padEnd(8)} Popularität: ${String(item.popularity ?? "?").padEnd(8)} Top-Konkurrenz: ${comp}`
        );
      }
    }

    if (options.history) {
      const history = await tracker.getRankingHistory(options.history);
      console.log(`\n📈 Ranking-Verlauf für "${options.history}":`);
      for (const entry of history) {
        console.log(
          `  ${entry.date.toISOString().split("T")[0]} | ${entry.appName.padEnd(25)} | Rang: ${entry.rank ?? "—"}`
        );
      }
    }

    await prisma.$disconnect();
  });

// ─── AI Analysis Commands ───────────────────────────────────────────────

program
  .command("analyze")
  .description("Run AI-powered ASO analysis")
  .option("--keywords", "Extract keywords from competitors")
  .option("--suggest", "Generate ASO optimization suggestions")
  .action(async (options) => {
    const analyzer = new AIAnalyzer();

    if (options.keywords) {
      logger.info("Extracting keywords from competitor data...");
      const keywords = await analyzer.extractKeywordsFromCompetitors();
      console.log("\n🔑 Extracted Keywords:");
      for (const kw of keywords) {
        console.log(
          `  ${kw.keyword.padEnd(30)} Häufigkeit: ${kw.frequency}  Relevanz: ${kw.relevance}`
        );
      }

      // Optionally add to tracking
      const tracker = new KeywordTracker();
      await tracker.addKeywords(keywords.map((k) => k.keyword));
    }

    if (options.suggest || (!options.keywords && !options.suggest)) {
      logger.info("Running AI ASO analysis...");
      const analysis = await analyzer.analyzeAndSuggest();

      console.log("\n🎯 ASO Optimierungsvorschläge:");
      console.log("═".repeat(70));

      if (analysis.titleSuggestions.length > 0) {
        console.log("\n📱 TITEL-VORSCHLÄGE:");
        for (const s of analysis.titleSuggestions) {
          console.log(`  ✦ "${s.value}" (Konfidenz: ${(s.confidence * 100).toFixed(0)}%)`);
          console.log(`    → ${s.reasoning}`);
        }
      }

      if (analysis.subtitleSuggestions.length > 0) {
        console.log("\n📝 UNTERTITEL-VORSCHLÄGE:");
        for (const s of analysis.subtitleSuggestions) {
          console.log(`  ✦ "${s.value}" (Konfidenz: ${(s.confidence * 100).toFixed(0)}%)`);
          console.log(`    → ${s.reasoning}`);
        }
      }

      if (analysis.keywordSuggestions.length > 0) {
        console.log("\n🔑 KEYWORD-VORSCHLÄGE:");
        for (const s of analysis.keywordSuggestions) {
          console.log(`  ✦ "${s.value}" (Konfidenz: ${(s.confidence * 100).toFixed(0)}%)`);
          console.log(`    → ${s.reasoning}`);
        }
      }

      if (analysis.descriptionSuggestions.length > 0) {
        console.log("\n📄 BESCHREIBUNGS-VORSCHLÄGE:");
        for (const s of analysis.descriptionSuggestions) {
          console.log(`  ✦ Konfidenz: ${(s.confidence * 100).toFixed(0)}%`);
          console.log(`    → ${s.reasoning}`);
          console.log(`    Auszug: "${s.value.substring(0, 150)}..."`);
        }
      }

      console.log("\n💡 KONKURRENZ-INSIGHTS:");
      console.log(`  ${analysis.competitorInsights}`);

      console.log("\n🗺️ GESAMTSTRATEGIE:");
      console.log(`  ${analysis.overallStrategy}`);
    }

    await prisma.$disconnect();
  });

// ─── Optimize Command (apply suggestions via ASC API) ───────────────────

program
  .command("optimize")
  .description("Apply ASO suggestions via App Store Connect API")
  .option("--dry-run", "Show what would be changed without applying")
  .option("--auto", "Automatically apply high-confidence suggestions")
  .action(async (options) => {
    const suggestions = await prisma.aSOSuggestion.findMany({
      where: { status: "PENDING" },
      orderBy: { confidenceScore: "desc" },
    });

    if (suggestions.length === 0) {
      console.log("Keine ausstehenden Vorschläge. Führe zuerst 'analyze' aus.");
      await prisma.$disconnect();
      return;
    }

    console.log(`\n📋 ${suggestions.length} ausstehende Vorschläge:`);
    for (const s of suggestions) {
      const confidence = s.confidenceScore
        ? `${(s.confidenceScore * 100).toFixed(0)}%`
        : "?";
      console.log(`  [${s.type}] "${s.suggestedValue.substring(0, 60)}" (${confidence})`);
      console.log(`    Grund: ${s.reasoning.substring(0, 100)}`);
    }

    if (options.dryRun) {
      console.log("\n(Dry run – keine Änderungen angewendet)");
    } else if (options.auto) {
      // Apply suggestions with confidence >= 0.8
      const highConfidence = suggestions.filter(
        (s) => s.confidenceScore && s.confidenceScore >= 0.8
      );

      if (highConfidence.length === 0) {
        console.log(
          "\nKeine Vorschläge mit >= 80% Konfidenz. Manuelle Prüfung empfohlen."
        );
      } else {
        console.log(
          `\n⚠️  Auto-Apply ist vorbereitet für ${highConfidence.length} Vorschläge.`
        );
        console.log(
          "Implementiere App Store Connect Update wenn ASC-Zugangsdaten konfiguriert sind."
        );

        // TODO: When ASC credentials are set up, uncomment this:
        // const ascClient = new AppStoreConnectClient();
        // const asoState = await ascClient.getCurrentASOState();
        // ... apply changes via ASC API
      }
    }

    await prisma.$disconnect();
  });

// ─── Daemon Mode ────────────────────────────────────────────────────────

program
  .command("daemon")
  .description("Run as a background daemon with scheduled jobs")
  .action(async () => {
    logger.info("Starting AppCore ASO daemon...");
    const scheduler = new Scheduler();
    scheduler.start();

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      logger.info("Shutting down...");
      scheduler.stop();
      prisma.$disconnect().then(() => process.exit(0));
    });

    process.on("SIGTERM", () => {
      logger.info("Shutting down...");
      scheduler.stop();
      prisma.$disconnect().then(() => process.exit(0));
    });
  });

// ─── Status Command ────────────────────────────────────────────────────

program
  .command("status")
  .description("Show current system status")
  .action(async () => {
    const [appCount, snapshotCount, keywordCount, rankingCount, suggestionCount, jobCount] =
      await Promise.all([
        prisma.app.count(),
        prisma.appSnapshot.count(),
        prisma.keyword.count(),
        prisma.keywordRanking.count(),
        prisma.aSOSuggestion.count({ where: { status: "PENDING" } }),
        prisma.scrapeJob.count(),
      ]);

    const ownApp = await prisma.app.findUnique({
      where: { bundleId: env.ASC_BUNDLE_ID },
      include: { snapshots: { orderBy: { scrapedAt: "desc" }, take: 1 } },
    });

    const lastJob = await prisma.scrapeJob.findFirst({
      orderBy: { createdAt: "desc" },
    });

    console.log("\n📊 AppCore ASO Status");
    console.log("═".repeat(50));
    console.log(`  App:              ${ownApp?.name ?? "nicht gescrapt"}`);
    console.log(`  Bundle ID:        ${env.ASC_BUNDLE_ID}`);
    console.log(`  Land:             ${env.SCRAPE_COUNTRY}`);
    console.log(`  Apps getrackt:    ${appCount}`);
    console.log(`  Snapshots:        ${snapshotCount}`);
    console.log(`  Keywords:         ${keywordCount}`);
    console.log(`  Rankings:         ${rankingCount}`);
    console.log(`  Vorschläge:       ${suggestionCount} ausstehend`);
    console.log(`  Jobs ausgeführt:  ${jobCount}`);
    if (lastJob) {
      console.log(
        `  Letzter Job:      ${lastJob.type} (${lastJob.status}) @ ${lastJob.createdAt.toISOString()}`
      );
    }
    if (ownApp?.snapshots[0]) {
      const snap = ownApp.snapshots[0];
      console.log(`  Rating:           ${snap.rating ?? "?"} ⭐ (${snap.ratingsCount ?? "?"} Bewertungen)`);
    }

    console.log("\n🔧 Konfiguration:");
    console.log(`  AI Provider:      ${env.AI_PROVIDER}`);
    console.log(`  OpenAI Key:       ${env.OPENAI_API_KEY ? "✅" : "❌"}`);
    console.log(`  Anthropic Key:    ${env.ANTHROPIC_API_KEY ? "✅" : "❌"}`);
    console.log(`  ASC Credentials:  ${env.ASC_ISSUER_ID ? "✅" : "❌"}`);
    console.log(`  Search Ads:       ${env.APPLE_ADS_CLIENT_ID ? "✅" : "❌"}`);
    console.log(`  Scrape Interval:  ${env.SCRAPE_INTERVAL_HOURS}h`);

    await prisma.$disconnect();
  });

program.parse();
