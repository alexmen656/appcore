import { Router } from "express";
import { prisma } from "../../config";

export const suggestionsRouter = Router();

// List suggestions (with filters)
suggestionsRouter.get("/", async (req, res) => {
  try {
    const { status, locale, type, limit } = req.query;
    const where: any = {};
    if (status) where.status = String(status).toUpperCase();
    if (locale) where.locale = String(locale);
    if (type) where.type = String(type).toUpperCase();

    const suggestions = await prisma.aSOSuggestion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit ? parseInt(String(limit)) : 100,
      include: { keyword: true },
    });

    // Group by locale
    const grouped: Record<string, any[]> = {};
    for (const s of suggestions) {
      const loc = s.locale || "en-US";
      if (!grouped[loc]) grouped[loc] = [];
      grouped[loc].push({
        id: s.id,
        type: s.type,
        locale: s.locale,
        suggestedValue: s.suggestedValue,
        currentValue: s.currentValue,
        reasoning: s.reasoning,
        confidenceScore: s.confidenceScore,
        estimatedImpact: s.estimatedImpact,
        status: s.status,
        aiProvider: s.aiProvider,
        aiModel: s.aiModel,
        keyword: s.keyword?.term ?? null,
        createdAt: s.createdAt,
        appliedAt: s.appliedAt,
      });
    }

    res.json({ suggestions: grouped, total: suggestions.length });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Approve a suggestion
suggestionsRouter.post("/:id/approve", async (req, res) => {
  try {
    const suggestion = await prisma.aSOSuggestion.update({
      where: { id: req.params.id },
      data: { status: "APPROVED" },
    });
    res.json({ ok: true, suggestion });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Reject a suggestion
suggestionsRouter.post("/:id/reject", async (req, res) => {
  try {
    const suggestion = await prisma.aSOSuggestion.update({
      where: { id: req.params.id },
      data: { status: "REJECTED" },
    });
    res.json({ ok: true, suggestion });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Apply a single suggestion via ASC
suggestionsRouter.post("/:id/apply", async (req, res) => {
  try {
    const suggestion = await prisma.aSOSuggestion.findUnique({
      where: { id: req.params.id },
    });
    if (!suggestion) return res.status(404).json({ error: "Not found" });

    // Lazy-load the ASC client to avoid import issues
    const { AppStoreConnectClient } = await import(
      "../../services/appstore-connect"
    );
    const asc = new AppStoreConnectClient();
    const locale = suggestion.locale || "en-US";

    const changes: Record<string, string> = {};
    const typeKey = suggestion.type.toLowerCase();
    if (typeKey === "title") changes.name = suggestion.suggestedValue;
    else if (typeKey === "subtitle") changes.subtitle = suggestion.suggestedValue;
    else if (typeKey === "keywords") changes.keywords = suggestion.suggestedValue;
    else if (typeKey === "description")
      changes.description = suggestion.suggestedValue;

    if (Object.keys(changes).length > 0) {
      await asc.applyASOChanges(changes, locale);
      await prisma.aSOSuggestion.update({
        where: { id: req.params.id },
        data: { status: "APPLIED", appliedAt: new Date() },
      });
      res.json({ ok: true, applied: changes, locale });
    } else {
      res.status(400).json({ error: `Cannot apply type: ${suggestion.type}` });
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Bulk approve all pending for a locale
suggestionsRouter.post("/bulk-approve", async (req, res) => {
  try {
    const { locale } = req.body;
    const where: any = { status: "PENDING" };
    if (locale) where.locale = locale;

    const result = await prisma.aSOSuggestion.updateMany({
      where,
      data: { status: "APPROVED" },
    });
    res.json({ ok: true, count: result.count });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
