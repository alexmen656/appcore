import { Router } from "express";
import { prisma } from "../../config";
import { requireAuth } from "../auth";

export const teamRouter = Router();
teamRouter.use(requireAuth);

teamRouter.get("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const isAdmin = req.user!.role === "ADMIN";

    if (!isAdmin) {
      const ownerOf = await prisma.appMember.findFirst({
        where: { userId, role: "OWNER" },
      });
      if (!ownerOf) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }

    const memberships = await prisma.appMember.findMany({
      where: { app: { isOwnApp: true } },
      include: {
        user: { select: { id: true, email: true, name: true } },
        app: {
          select: {
            id: true,
            name: true,
            bundleId: true,
            snapshots: {
              orderBy: { scrapedAt: "desc" },
              take: 1,
              select: { iconUrl: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const byUser = new Map<
      string,
      {
        userId: string;
        email: string;
        name: string | null;
        apps: {
          memberId: string;
          appId: string;
          bundleId: string;
          appName: string;
          iconUrl: string | null;
          role: string;
        }[];
      }
    >();

    for (const m of memberships) {
      if (!byUser.has(m.userId)) {
        byUser.set(m.userId, {
          userId: m.userId,
          email: m.user.email,
          name: m.user.name,
          apps: [],
        });
      }
      byUser.get(m.userId)!.apps.push({
        memberId: m.id,
        appId: m.app.id,
        bundleId: m.app.bundleId,
        appName: m.app.name,
        iconUrl: m.app.snapshots[0]?.iconUrl ?? null,
        role: m.role,
      });
    }

    res.json(Array.from(byUser.values()));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

teamRouter.get("/apps", async (req, res) => {
  try {
    const apps = await prisma.app.findMany({
      where: { isOwnApp: true },
      include: {
        snapshots: {
          orderBy: { scrapedAt: "desc" },
          take: 1,
          select: { iconUrl: true },
        },
      },
      orderBy: { name: "asc" },
    });
    res.json(
      apps.map((a) => ({
        id: a.id,
        bundleId: a.bundleId,
        name: a.name,
        iconUrl: a.snapshots[0]?.iconUrl ?? null,
      })),
    );
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

teamRouter.post("/assign", async (req, res) => {
  try {
    const { email, assignments } = req.body as {
      email?: string;
      assignments?: { bundleId: string; role: string }[];
    };

    if (!email || !assignments?.length) {
      res.status(400).json({ error: "email and assignments required" });
      return;
    }

    const userId = req.user!.userId;
    const isAdmin = req.user!.role === "ADMIN";

    if (!isAdmin) {
      const ownerOf = await prisma.appMember.findFirst({
        where: { userId, role: "OWNER" },
      });
      if (!ownerOf) {
        res.status(403).json({ error: "Only owners can assign members" });
        return;
      }
    }

    const targetUser = await prisma.user.findUnique({ where: { email } });
    if (!targetUser) {
      res.status(404).json({ error: "NO_USER" });
      return;
    }

    const inviter = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    const results = [];
    for (const a of assignments) {
      if (!["OWNER", "EDITOR", "VIEWER"].includes(a.role)) continue;
      const app = await prisma.app.findUnique({
        where: { bundleId: a.bundleId },
      });
      if (!app) continue;
      const m = await prisma.appMember.upsert({
        where: { appId_userId: { appId: app.id, userId: targetUser.id } },
        create: {
          appId: app.id,
          userId: targetUser.id,
          role: a.role as any,
          invitedBy: inviter?.email ?? userId,
        },
        update: { role: a.role as any },
      });
      results.push(m);
    }

    res.json({ ok: true, count: results.length });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

teamRouter.put("/members/:memberId", async (req, res) => {
  try {
    const { memberId } = req.params;
    const { role } = req.body as { role?: string };

    if (!role || !["OWNER", "EDITOR", "VIEWER"].includes(role)) {
      res.status(400).json({ error: "role must be OWNER, EDITOR or VIEWER" });
      return;
    }

    const existing = await prisma.appMember.findUnique({
      where: { id: memberId },
    });
    if (!existing) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    const userId = req.user!.userId;
    const isAdmin = req.user!.role === "ADMIN";
    if (!isAdmin) {
      const me = await prisma.appMember.findUnique({
        where: { appId_userId: { appId: existing.appId, userId } },
      });
      if (me?.role !== "OWNER") {
        res.status(403).json({ error: "Only owners can change roles" });
        return;
      }
    }

    await prisma.appMember.update({
      where: { id: memberId },
      data: { role: role as any },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

teamRouter.delete("/members/:memberId", async (req, res) => {
  try {
    const { memberId } = req.params;
    const existing = await prisma.appMember.findUnique({
      where: { id: memberId },
    });
    if (!existing) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    const userId = req.user!.userId;
    const isAdmin = req.user!.role === "ADMIN";
    const isSelf = existing.userId === userId;

    if (!isSelf && !isAdmin) {
      const me = await prisma.appMember.findUnique({
        where: { appId_userId: { appId: existing.appId, userId } },
      });
      if (me?.role !== "OWNER") {
        res.status(403).json({ error: "Only owners can remove members" });
        return;
      }
    }

    await prisma.appMember.delete({ where: { id: memberId } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
