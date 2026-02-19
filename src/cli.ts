import { Command } from "commander";
import { logger, prisma, env } from "./config";
import {
  AppStoreScraper,
  AppStoreConnectClient,
  KeywordTracker,
  AIAnalyzer,
  KeywordDiscoveryAgent,
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
      const targetBundleId = options.bundleId || env.ASC_BUNDLE_ID;
      logger.info(
        `Discovering competitors for ${targetBundleId}: ${options.discover.join(", ")}`,
      );
      await scraper.scrapeAndSaveApp(targetBundleId, true);
      const ids = await scraper.discoverCompetitors(
        options.discover,
        targetBundleId,
        env.MAX_COMPETITORS,
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
        console.log(`  ${keyword}: ${rank ? `#${rank}` : "not ranked"}`);
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
          `  ${item.keyword.padEnd(30)} Rang: ${ourRank.padEnd(8)} Popularität: ${String(item.popularity ?? "?").padEnd(8)} Top-Konkurrenz: ${comp}`,
        );
      }
    }

    if (options.history) {
      const history = await tracker.getRankingHistory(options.history);
      console.log(`\n📈 Ranking-Verlauf für "${options.history}":`);
      for (const entry of history) {
        console.log(
          `  ${entry.date.toISOString().split("T")[0]} | ${entry.appName.padEnd(25)} | Rang: ${entry.rank ?? "—"}`,
        );
      }
    }

    await prisma.$disconnect();
  });

// ─── AI Analysis Commands ───────────────────────────────────────────────

program
  .command("analyze")
  .description("Run AI-powered ASO analysis")
  .option(
    "-b, --bundle-id <bundleId>",
    "App to analyze (overrides env ASC_BUNDLE_ID)",
  )
  .option("--keywords", "Extract keywords from competitors")
  .option("--suggest", "Generate ASO optimization suggestions")
  .option(
    "--locales <locales...>",
    "Override ASO_LOCALES (e.g. en-US de-DE fr-FR)",
  )
  .action(async (options) => {
    const bundleId = options.bundleId || env.ASC_BUNDLE_ID;
    const analyzer = new AIAnalyzer({ ascBundleId: bundleId } as any);

    if (options.keywords) {
      logger.info("Extracting keywords from competitor data...");
      const keywords = await analyzer.extractKeywordsFromCompetitors();
      console.log("\n🔑 Extracted Keywords:");
      for (const kw of keywords) {
        console.log(
          `  ${kw.keyword.padEnd(30)} Häufigkeit: ${kw.frequency}  Relevanz: ${kw.relevance}`,
        );
      }

      const tracker = new KeywordTracker();
      await tracker.addKeywords(keywords.map((k) => k.keyword));
    }

    if (options.suggest || (!options.keywords && !options.suggest)) {
      const locales = options.locales as string[] | undefined;
      logger.info(
        `Running AI ASO analysis for locales: ${locales?.join(", ") ?? env.ASO_LOCALES}...`,
      );
      const results = await analyzer.analyzeAndSuggest(locales);

      for (const [locale, analysis] of results) {
        const lc = locale;
        console.log(`\n🎯 ASO Suggestions for ${lc}:`);
        console.log("═".repeat(70));

        if (analysis.titleSuggestions.length > 0) {
          console.log("\n📱 TITLE:");
          for (const s of analysis.titleSuggestions) {
            console.log(
              `  ✦ "${s.value}" (${(s.confidence * 100).toFixed(0)}%)`,
            );
            console.log(`    → ${s.reasoning}`);
          }
        }

        if (analysis.subtitleSuggestions.length > 0) {
          console.log("\n📝 SUBTITLE:");
          for (const s of analysis.subtitleSuggestions) {
            console.log(
              `  ✦ "${s.value}" (${(s.confidence * 100).toFixed(0)}%)`,
            );
            console.log(`    → ${s.reasoning}`);
          }
        }

        if (analysis.keywordSuggestions.length > 0) {
          console.log("\n🔑 KEYWORDS:");
          for (const s of analysis.keywordSuggestions) {
            console.log(
              `  ✦ "${s.value}" (${(s.confidence * 100).toFixed(0)}%)`,
            );
            console.log(`    → ${s.reasoning}`);
          }
        }

        if (analysis.descriptionSuggestions.length > 0) {
          console.log("\n📄 DESCRIPTION:");
          for (const s of analysis.descriptionSuggestions) {
            console.log(`  ✦ (${(s.confidence * 100).toFixed(0)}%)`);
            console.log(`    → ${s.reasoning}`);
            console.log(`    Preview: "${s.value.substring(0, 150)}..."`);
          }
        }

        console.log("\n💡 COMPETITOR INSIGHTS:");
        console.log(`  ${analysis.competitorInsights}`);

        console.log("\n🗺️ STRATEGY:");
        console.log(`  ${analysis.overallStrategy}`);
      }
    }

    await prisma.$disconnect();
  });

// ─── Keyword Discovery Command ──────────────────────────────────────────

program
  .command("discover")
  .description(
    "Discover new keywords via AI (competitor texts + autocomplete + semantic expansion)",
  )
  .option(
    "-b, --bundle-id <bundleId>",
    "App to discover keywords for (overrides env ASC_BUNDLE_ID)",
  )
  .option("--all-own-apps", "Run discovery for all own apps in the database")
  .action(async (options) => {
    const bundleIds: string[] = [];

    if (options.allOwnApps) {
      const ownApps = await prisma.app.findMany({ where: { isOwnApp: true } });
      bundleIds.push(...ownApps.map((a) => a.bundleId));
      if (bundleIds.length === 0) {
        console.log("No own apps found. Run 'scrape' first.");
        await prisma.$disconnect();
        return;
      }
    } else {
      bundleIds.push(options.bundleId || env.ASC_BUNDLE_ID);
    }

    for (const bundleId of bundleIds) {
      const agent = new KeywordDiscoveryAgent({ ascBundleId: bundleId } as any);

      console.log(`\nKeyword Discovery for: ${bundleId}`);
      console.log(
        "  Strategies: competitor text mining + autocomplete expansion + AI semantic gaps",
      );
      console.log(
        `  Country: ${env.SCRAPE_COUNTRY} | Min. popularity: 15/100 | Max. scored per run: 25`,
      );
      console.log("  This may take a few minutes due to rate limiting.\n");

      const result = await agent.run();

      console.log("\nResults:");
      console.log("─".repeat(40));
      console.log(`  Candidates found:   ${result.discovered}`);
      console.log(`  Passed quality:     ${result.scored}`);
      console.log(`  Added to tracking:  ${result.added}`);
    }

    await prisma.$disconnect();
  });

// ─── Optimize Command (apply suggestions via ASC API) ───────────────────

program
  .command("optimize")
  .description("Apply ASO suggestions via App Store Connect API")
  .option("--dry-run", "Show what would be changed without applying")
  .option("--auto", "Automatically apply high-confidence suggestions (>=80%)")
  .option("--apply <ids...>", "Apply specific suggestion IDs")
  .option(
    "--locale <locale>",
    "Apply only for a specific locale (default: all configured)",
  )
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
      console.log(`\n❌ ${options.reject.length} suggestions rejected.`);
      await prisma.$disconnect();
      return;
    }

    // ── Fetch pending suggestions ───────────────────────────────
    const whereClause: any = { status: "PENDING" };
    if (options.locale) {
      whereClause.locale = options.locale;
    }

    const suggestions = await prisma.aSOSuggestion.findMany({
      where: whereClause,
      orderBy: [{ locale: "asc" }, { confidenceScore: "desc" }],
    });

    if (suggestions.length === 0) {
      console.log("No pending suggestions. Run 'analyze' first.");
      await prisma.$disconnect();
      return;
    }

    // Group suggestions by locale
    const byLocale = new Map<string, typeof suggestions>();
    for (const s of suggestions) {
      const group = byLocale.get(s.locale) ?? [];
      group.push(s);
      byLocale.set(s.locale, group);
    }

    console.log(
      `\n📋 ${suggestions.length} pending suggestions across ${byLocale.size} locale(s):`,
    );
    console.log("─".repeat(85));

    for (const [locale, localeSuggestions] of byLocale) {
      console.log(`\n  🌐 ${locale}:`);
      for (const s of localeSuggestions) {
        const confidence = s.confidenceScore
          ? `${(s.confidenceScore * 100).toFixed(0)}%`
          : "?";
        console.log(
          `    [${s.id.substring(0, 8)}] [${s.type.padEnd(11)}] "${s.suggestedValue.substring(0, 45)}" (${confidence})`,
        );
      }
    }

    // ── Determine which suggestions to apply ────────────────────
    let toApply = suggestions;

    if (options.apply) {
      toApply = suggestions.filter((s) =>
        options.apply.some((id: string) => s.id.startsWith(id)),
      );
    } else if (options.auto) {
      toApply = suggestions.filter(
        (s) => s.confidenceScore && s.confidenceScore >= 0.8,
      );
    }

    if (toApply.length === 0) {
      console.log("\n⚠️  No matching suggestions. Use --apply <id> or --auto.");
      await prisma.$disconnect();
      return;
    }

    // Group toApply by locale, then pick best per type per locale
    const applyByLocale = new Map<string, typeof toApply>();
    for (const s of toApply) {
      const group = applyByLocale.get(s.locale) ?? [];
      group.push(s);
      applyByLocale.set(s.locale, group);
    }

    // Build changes per locale
    const changesPerLocale = new Map<
      string,
      {
        changes: {
          title?: string;
          subtitle?: string;
          description?: string;
          keywords?: string;
        };
        appliedSuggestions: typeof toApply;
      }
    >();

    for (const [locale, localeSuggestions] of applyByLocale) {
      const bestByType = new Map<string, (typeof localeSuggestions)[0]>();
      for (const s of localeSuggestions) {
        const existing = bestByType.get(s.type);
        if (
          !existing ||
          (s.confidenceScore ?? 0) > (existing.confidenceScore ?? 0)
        ) {
          bestByType.set(s.type, s);
        }
      }

      const changes: {
        title?: string;
        subtitle?: string;
        description?: string;
        keywords?: string;
      } = {};
      const appliedSuggestions: typeof toApply = [];

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

      changesPerLocale.set(locale, { changes, appliedSuggestions });
    }

    // ── Display summary ─────────────────────────────────────────
    console.log(`\n🔄 Changes to apply:`);
    console.log("─".repeat(85));
    for (const [locale, { changes }] of changesPerLocale) {
      console.log(`\n  🌐 ${locale}:`);
      if (changes.title) console.log(`    📱 Title:       "${changes.title}"`);
      if (changes.subtitle)
        console.log(`    📝 Subtitle:    "${changes.subtitle}"`);
      if (changes.keywords)
        console.log(`    🔑 Keywords:    "${changes.keywords}"`);
      if (changes.description)
        console.log(
          `    📄 Description: "${changes.description.substring(0, 70)}..."`,
        );
    }

    if (options.dryRun) {
      console.log("\n(Dry run – no changes applied)");
      await prisma.$disconnect();
      return;
    }

    // ── Apply via App Store Connect API per locale ──────────────
    console.log("\n⏳ Connecting to App Store Connect API...");

    try {
      const ascClient = new AppStoreConnectClient();
      let totalApplied = 0;
      let totalErrors = 0;

      for (const [
        locale,
        { changes, appliedSuggestions },
      ] of changesPerLocale) {
        console.log(`\n🌐 Applying changes for ${locale}...`);

        const result = await ascClient.applyASOChanges(changes, locale);

        if (result.applied.length > 0) {
          totalApplied += result.applied.length;
          console.log(`  ✅ Applied to version ${result.versionString}:`);
          for (const a of result.applied) {
            console.log(`      ✓ ${a}`);
          }
        }

        if (result.errors.length > 0) {
          totalErrors += result.errors.length;
          console.log("  ⚠️  Errors:");
          for (const e of result.errors) {
            console.log(`      ✗ ${e}`);
          }
        }

        // Mark suggestions in DB
        for (const suggestion of appliedSuggestions) {
          const wasApplied = result.applied.some((a) =>
            a.toLowerCase().includes(suggestion.type.toLowerCase()),
          );
          await prisma.aSOSuggestion.update({
            where: { id: suggestion.id },
            data: {
              status: wasApplied ? "APPLIED" : "REJECTED",
              appliedAt: wasApplied ? new Date() : undefined,
              resultNotes: wasApplied
                ? `Applied to ${locale} version ${result.versionString}`
                : `Failed: ${result.errors.join("; ")}`,
            },
          });
        }
      }

      console.log(
        `\n📊 Summary: ${totalApplied} changes applied, ${totalErrors} errors across ${changesPerLocale.size} locale(s).`,
      );

      // Sync primary locale back to local DB
      const primaryLocale =
        options.locale ?? env.ASO_LOCALES.split(",")[0].trim();
      const primaryChanges = changesPerLocale.get(primaryLocale)?.changes;
      if (primaryChanges) {
        const ownApp = await prisma.app.findUnique({
          where: { bundleId: env.ASC_BUNDLE_ID },
        });
        if (ownApp) {
          await prisma.app.update({
            where: { id: ownApp.id },
            data: {
              ...(primaryChanges.title && {
                currentTitle: primaryChanges.title,
              }),
              ...(primaryChanges.subtitle && {
                currentSubtitle: primaryChanges.subtitle,
              }),
              ...(primaryChanges.keywords && {
                currentKeywords: primaryChanges.keywords,
              }),
              ...(primaryChanges.description && {
                currentDescription: primaryChanges.description,
              }),
            },
          });
        }
      }

      console.log("💾 Local database updated.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ App Store Connect Error: ${msg}`);

      if (msg.includes("credentials missing")) {
        console.log(
          "\nMake sure ASC_ISSUER_ID, ASC_KEY_ID and AuthKey.p8 are configured.",
        );
      }
    }

    await prisma.$disconnect();
  });

// ─── Sync Command (read current state from ASC) ────────────────────────

program
  .command("sync")
  .description("Sync current ASO metadata from App Store Connect")
  .option(
    "--locale <locale>",
    "Sync a specific locale (default: all from ASO_LOCALES)",
  )
  .action(async (options) => {
    console.log("\n⏳ Connecting to App Store Connect API...");

    const locales = options.locale
      ? [options.locale]
      : env.ASO_LOCALES.split(",").map((l: string) => l.trim());

    try {
      const ascClient = new AppStoreConnectClient();

      for (const locale of locales) {
        const state = await ascClient.getCurrentASOState(locale);

        if (!state) {
          console.log(`\n❌ App not found in App Store Connect for ${locale}.`);
          continue;
        }

        console.log(`\n🌐 ${locale} – App Store Connect:`);
        console.log("─".repeat(70));
        console.log(`  App ID:      ${state.appId}`);
        console.log(
          `  Version:     ${state.versionString ?? "–"} (${state.appStoreState ?? "–"})`,
        );
        console.log(`  Title:       ${state.title ?? "–"}`);
        console.log(`  Subtitle:    ${state.subtitle ?? "–"}`);
        console.log(`  Keywords:    ${state.keywords ?? "–"}`);
        console.log(
          `  Description: ${state.description?.substring(0, 100) ?? "–"}${state.description && state.description.length > 100 ? "..." : ""}`,
        );
        console.log(
          `  What's New:  ${state.whatsNew?.substring(0, 80) ?? "–"}`,
        );
        console.log(
          `  Promo Text:  ${state.promotionalText?.substring(0, 80) ?? "–"}`,
        );
      }

      // Sync primary locale to local DB
      const primaryLocale = locales[0];
      const primaryState = await ascClient.getCurrentASOState(primaryLocale);

      if (primaryState) {
        const ownApp = await prisma.app.findUnique({
          where: { bundleId: env.ASC_BUNDLE_ID },
        });

        if (ownApp) {
          await prisma.app.update({
            where: { id: ownApp.id },
            data: {
              currentTitle: primaryState.title ?? ownApp.currentTitle,
              currentSubtitle: primaryState.subtitle ?? ownApp.currentSubtitle,
              currentKeywords: primaryState.keywords ?? ownApp.currentKeywords,
              currentDescription:
                primaryState.description ?? ownApp.currentDescription,
            },
          });
          console.log(`\n💾 Local DB synced with ${primaryLocale} data.`);
        } else {
          console.log("\n⚠️  App not found locally. Run 'scrape' first.");
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ App Store Connect Error: ${msg}`);
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
    const [
      appCount,
      snapshotCount,
      keywordCount,
      rankingCount,
      suggestionCount,
      jobCount,
    ] = await Promise.all([
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
        `  Letzter Job:      ${lastJob.type} (${lastJob.status}) @ ${lastJob.createdAt.toISOString()}`,
      );
    }
    if (ownApp?.snapshots[0]) {
      const snap = ownApp.snapshots[0];
      console.log(
        `  Rating:           ${snap.rating ?? "?"} ⭐ (${snap.ratingsCount ?? "?"} Bewertungen)`,
      );
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
