import { Router } from "express";
import { prisma, getEffectiveSettings } from "../../config";
import { requireAuth } from "../auth";

export const searchRouter = Router();
searchRouter.use(requireAuth);

searchRouter.get("/", async (req, res) => {
  try {
    const q = ((req.query.q as string) ?? "").trim();
    if (!q || q.length < 1) {
      res.json([]);
      return;
    }

    const settings = await getEffectiveSettings(req.user!.userId);
    const activeBundleId = settings.ascBundleId;
    const ownApp = activeBundleId
      ? await prisma.app.findUnique({ where: { bundleId: activeBundleId } })
      : null;

    const results: {
      id: string;
      label: string;
      sublabel?: string;
      category: string;
      to: string;
      icon: string;
    }[] = [];

    const keywords = await prisma.keyword.findMany({
      where: {
        term: { contains: q, mode: "insensitive" },
        ...(ownApp ? { rankings: { some: { appId: ownApp.id } } } : {}),
      },
      take: 5,
      orderBy: { popularity: "desc" },
    });
    for (const kw of keywords) {
      results.push({
        id: `keyword-${kw.id}`,
        label: kw.term,
        sublabel:
          kw.popularity != null ? `Popularity ${kw.popularity}` : undefined,
        category: "Keywords",
        to: "/keywords",
        icon: "keyword",
      });
    }

    const apps = await prisma.app.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { bundleId: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
    });
    for (const app of apps) {
      const isOwn = app.bundleId === activeBundleId;
      results.push({
        id: `app-${app.id}`,
        label: app.name ?? app.bundleId,
        sublabel: app.bundleId,
        category: isOwn ? "Your App" : "Competitors",
        to: "/competitors",
        icon: "competitor",
      });
    }

    const suggestions = await prisma.aSOSuggestion.findMany({
      where: {
        OR: [
          { suggestedValue: { contains: q, mode: "insensitive" } },
          { currentValue: { contains: q, mode: "insensitive" } },
        ],
        ...(activeBundleId ? { appBundleId: activeBundleId } : {}),
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    });
    
    for (const s of suggestions) {
      results.push({
        id: `suggestion-${s.id}`,
        label: `${s.type.charAt(0) + s.type.slice(1).toLowerCase()} suggestion`,
        sublabel: s.suggestedValue?.slice(0, 60),
        category: "Suggestions",
        to: "/suggestions",
        icon: "suggestion",
      });
    }

    res.json(results);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});
