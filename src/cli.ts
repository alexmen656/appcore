import { Command } from "commander";
import { logger, prisma, env } from "./config";
import {
  AppStoreScraper,
  AppStoreConnectClient,
  KeywordTracker,
  AIAnalyzer,
} from "./services";
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
  .option("--auto", "Automatically apply high-confidence suggestions (>=80%)")
  .option(
    "--apply <ids...>",
    "Apply specific suggestion IDs"
  )
  .option("--locale <locale>", "Target locale", "en-US")
  .option("--reject <ids...>", "Reject specific suggestion IDs")
  .action(async (options) => {
    // ── Reject suggestions ──────────────────────────────────────
    if (options.reject) {
      for (const id of options.reject) {
        await prisma.aSOSuggestion.update({
          where: { id },
          data: { status: "REJECTED" },
        });
      }
      console.log(`\n❌ ${options.reject.length} Vorschläge abgelehnt.`);
      await prisma.$disconnect();
      return;
    }

    // ── Fetch pending suggestions ───────────────────────────────
    const suggestions = await prisma.aSOSuggestion.findMany({
      where: { status: "PENDING" },
      orderBy: { confidenceScore: "desc" },
    });

    if (suggestions.length === 0) {
      console.log(
        "Keine ausstehenden Vorschläge. Führe zuerst 'analyze' aus."
      );
      await prisma.$disconnect();
      return;
    }

    console.log(`\n📋 ${suggestions.length} ausstehende Vorschläge:`);
    console.log("─".repeat(80));
    for (const s of suggestions) {
      const confidence = s.confidenceScore
        ? `${(s.confidenceScore * 100).toFixed(0)}%`
        : "?";
      console.log(
        `  [${s.id.substring(0, 8)}] [${s.type.padEnd(11)}] "${s.suggestedValue.substring(0, 50)}" (${confidence})`
      );
      console.log(`    → ${s.reasoning.substring(0, 100)}`);
    }

    // ── Determine which suggestions to apply ────────────────────
    let toApply = suggestions;

    if (options.apply) {
      toApply = suggestions.filter((s) =>
        options.apply.some((id: string) => s.id.startsWith(id))
      );
    } else if (options.auto) {
      toApply = suggestions.filter(
        (s) => s.confidenceScore && s.confidenceScore >= 0.8
      );
    }

    if (toApply.length === 0) {
      console.log(
        "\n⚠️  Keine passenden Vorschläge. Nutze --apply <id> oder --auto."
      );
      await prisma.$disconnect();
      return;
    }

    // ── Pick the best suggestion per type ───────────────────────
    // Only apply the highest-confidence suggestion per type
    const bestByType = new Map<string, (typeof toApply)[0]>();
    for (const s of toApply) {
      const existing = bestByType.get(s.type);
      if (
        !existing ||
        (s.confidenceScore ?? 0) > (existing.confidenceScore ?? 0)
      ) {
        bestByType.set(s.type, s);
      }
    }

    // Build the change set
    const changes: {
      title?: string;
      subtitle?: string;
      description?: string;
      keywords?: string;
    } = {};

    const appliedSuggestions: (typeof toApply)[0][] = [];

    for (const [type, suggestion] of bestByType) {
      switch (type) {
        case "TITLE":
          changes.title = suggestion.suggestedValue;
          appliedSuggestions.push(suggestion);
          break;
        case "SUBTITLE":
          changes.subtitle = suggestion.suggestedValue;
          appliedSuggestions.push(suggestion);
          break;
        case "KEYWORDS":
          changes.keywords = suggestion.suggestedValue;
          appliedSuggestions.push(suggestion);
          break;
        case "DESCRIPTION":
          changes.description = suggestion.suggestedValue;
          appliedSuggestions.push(suggestion);
          break;
      }
    }

    console.log(`\n🔄 Änderungen die angewendet werden:`);
    console.log("─".repeat(80));
    if (changes.title) console.log(`  📱 Titel:       "${changes.title}"`);
    if (changes.subtitle)
      console.log(`  📝 Untertitel:  "${changes.subtitle}"`);
    if (changes.keywords)
      console.log(`  🔑 Keywords:    "${changes.keywords}"`);
    if (changes.description)
      console.log(
        `  📄 Beschreibung: "${changes.description.substring(0, 80)}..."`
      );

    if (options.dryRun) {
      console.log("\n(Dry run – keine Änderungen angewendet)");
      await prisma.$disconnect();
      return;
    }

    // ── Apply via App Store Connect API ─────────────────────────
    console.log("\n⏳ Verbinde mit App Store Connect API...");

    try {
      const ascClient = new AppStoreConnectClient();

      const result = await ascClient.applyASOChanges(
        changes,
        options.locale
      );

      // Report results
      if (result.applied.length > 0) {
        console.log(
          `\n✅ Erfolgreich angewendet auf Version ${result.versionString}:`
        );
        for (const a of result.applied) {
          console.log(`    ✓ ${a}`);
        }
      }

      if (result.errors.length > 0) {
        console.log("\n⚠️  Fehler:");
        for (const e of result.errors) {
          console.log(`    ✗ ${e}`);
        }
      }

      // Mark suggestions as applied/failed in DB
      for (const suggestion of appliedSuggestions) {
        const wasApplied = result.applied.some((a) =>
          a.toLowerCase().includes(suggestion.type.toLowerCase())
        );
        await prisma.aSOSuggestion.update({
          where: { id: suggestion.id },
          data: {
            status: wasApplied ? "APPLIED" : "REJECTED",
            appliedAt: wasApplied ? new Date() : undefined,
            resultNotes: wasApplied
              ? `Applied to version ${result.versionString}`
              : `Failed: ${result.errors.join("; ")}`,
          },
        });
      }

      // Sync back to local DB
      if (result.applied.length > 0) {
        const ownApp = await prisma.app.findUnique({
          where: { bundleId: env.ASC_BUNDLE_ID },
        });
        if (ownApp) {
          await prisma.app.update({
            where: { id: ownApp.id },
            data: {
              ...(changes.title && { currentTitle: changes.title }),
              ...(changes.subtitle && {
                currentSubtitle: changes.subtitle,
              }),
              ...(changes.keywords && {
                currentKeywords: changes.keywords,
              }),
              ...(changes.description && {
                currentDescription: changes.description,
              }),
            },
          });
        }
        console.log("\n💾 Lokale Datenbank aktualisiert.");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ App Store Connect Fehler: ${msg}`);

      if (msg.includes("credentials missing")) {
        console.log(
          "\nStelle sicher dass ASC_ISSUER_ID, ASC_KEY_ID und AuthKey.p8 konfiguriert sind."
        );
      }
    }

    await prisma.$disconnect();
  });

// ─── Sync Command (read current state from ASC) ────────────────────────

program
  .command("sync")
  .description("Sync current ASO metadata from App Store Connect")
  .option("--locale <locale>", "Locale to sync", "en-US")
  .action(async (options) => {
    console.log("\n⏳ Verbinde mit App Store Connect API...");

    try {
      const ascClient = new AppStoreConnectClient();
      const state = await ascClient.getCurrentASOState(options.locale);

      if (!state) {
        console.log("❌ App nicht in App Store Connect gefunden.");
        await prisma.$disconnect();
        return;
      }

      console.log("\n📱 App Store Connect – Aktueller Stand:");
      console.log("═".repeat(70));
      console.log(`  App ID:          ${state.appId}`);
      console.log(`  Version:         ${state.versionString ?? "–"}`);
      console.log(`  Status:          ${state.appStoreState ?? "–"}`);
      console.log(`  Titel:           ${state.title ?? "–"}`);
      console.log(`  Untertitel:      ${state.subtitle ?? "–"}`);
      console.log(
        `  Keywords:        ${state.keywords ?? "–"}`
      );
      console.log(
        `  Beschreibung:    ${state.description?.substring(0, 120) ?? "–"}${state.description && state.description.length > 120 ? "..." : ""}`
      );
      console.log(
        `  What's New:      ${state.whatsNew?.substring(0, 100) ?? "–"}`
      );
      console.log(
        `  Promo Text:      ${state.promotionalText?.substring(0, 100) ?? "–"}`
      );
      console.log("\n  IDs:");
      console.log(
        `    AppInfo Loc:   ${state.appInfoLocalizationId ?? "–"}`
      );
      console.log(
        `    Version Loc:   ${state.versionLocalizationId ?? "–"}`
      );

      // Save to local DB
      const ownApp = await prisma.app.findUnique({
        where: { bundleId: env.ASC_BUNDLE_ID },
      });

      if (ownApp) {
        await prisma.app.update({
          where: { id: ownApp.id },
          data: {
            currentTitle: state.title ?? ownApp.currentTitle,
            currentSubtitle: state.subtitle ?? ownApp.currentSubtitle,
            currentKeywords: state.keywords ?? ownApp.currentKeywords,
            currentDescription:
              state.description ?? ownApp.currentDescription,
          },
        });
        console.log("\n💾 Lokale Datenbank mit ASC-Daten synchronisiert.");
      } else {
        console.log(
          "\n⚠️  App noch nicht lokal vorhanden. Führe zuerst 'scrape' aus."
        );
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ App Store Connect Fehler: ${msg}`);
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
