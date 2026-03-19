import { Router } from "express";
import { prisma } from "../../config";
import { requireAuth } from "../auth";
import { sendTeamInviteEmail } from "../../services/email";
import crypto from "crypto";

export const teamRouter = Router();

// Public route — must be before requireAuth
teamRouter.get("/invite/:token", async (req, res) => {
  try {
    const invite = await prisma.teamInvite.findUnique({
      where: { token: req.params.token },
      include: { team: { select: { name: true } } },
    });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      res.status(404).json({ error: "Invalid or expired invite" });
      return;
    }
    res.json({
      email: invite.email,
      role: invite.role,
      teamName: invite.team.name,
      expiresAt: invite.expiresAt,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

teamRouter.use(requireAuth);

async function getMyMembership(userId: string, teamId: string | null) {
  if (!teamId) return null;
  return prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
}

function canManageTeam(role: string | undefined) {
  return role === "OWNER" || role === "ADMIN";
}

teamRouter.get("/", async (req, res) => {
  try {
    const teamId = req.user!.teamId;
    const isAdmin = req.user!.role === "ADMIN";

    if (!teamId && !isAdmin) {
      res.status(403).json({ error: "No team" });
      return;
    }

    const resolvedTeamId = teamId ?? (await prisma.team.findFirst())?.id;
    if (!resolvedTeamId) {
      res.json({ team: null, members: [] });
      return;
    }

    const team = await prisma.team.findUnique({
      where: { id: resolvedTeamId },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
        invites: {
          where: { acceptedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!team) {
      res.status(404).json({ error: "Team not found" });
      return;
    }

    res.json({
      team: { id: team.id, name: team.name, createdAt: team.createdAt },
      members: team.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        email: m.user.email,
        name: m.user.name,
        role: m.role,
        createdAt: m.createdAt,
      })),
      pendingInvites: team.invites.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        invitedBy: i.invitedBy,
        expiresAt: i.expiresAt,
        createdAt: i.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

teamRouter.post("/invite", async (req, res) => {
  try {
    const { email, role } = req.body as { email?: string; role?: string };

    if (!email || !role) {
      res.status(400).json({ error: "email and role required" });
      return;
    }
    if (!["OWNER", "ADMIN", "MEMBER", "VIEWER"].includes(role)) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }

    const teamId = req.user!.teamId;
    if (!teamId) {
      res.status(403).json({ error: "No team" });
      return;
    }

    const me = await getMyMembership(req.user!.userId, teamId);
    if (!canManageTeam(me?.role) && req.user!.role !== "ADMIN") {
      res.status(403).json({ error: "Only owners and admins can invite" });
      return;
    }

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      res.status(404).json({ error: "Team not found" });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const alreadyMember = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: existingUser.id } },
      });
      if (alreadyMember) {
        res.status(409).json({ error: "Dieser Nutzer ist bereits Mitglied" });
        return;
      }
    }

    await prisma.teamInvite.updateMany({
      where: { teamId, email, acceptedAt: null },
      data: { expiresAt: new Date() },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const inviter = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { name: true, email: true },
    });

    const invite = await prisma.teamInvite.create({
      data: {
        teamId,
        email,
        role: role as any,
        token,
        invitedBy: inviter?.name ?? inviter?.email ?? req.user!.userId,
        expiresAt,
      },
    });

    await sendTeamInviteEmail({
      to: email,
      inviterName: inviter?.name ?? inviter?.email ?? "Someone",
      teamName: team.name,
      role,
      token,
    });

    res.json({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

teamRouter.delete("/invites/:id", async (req, res) => {
  try {
    const teamId = req.user!.teamId;
    if (!teamId) {
      res.status(403).json({ error: "No team" });
      return;
    }

    const me = await getMyMembership(req.user!.userId, teamId);
    if (!canManageTeam(me?.role) && req.user!.role !== "ADMIN") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await prisma.teamInvite.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

teamRouter.put("/members/:id", async (req, res) => {
  try {
    const { role } = req.body as { role?: string };
    if (!role || !["OWNER", "ADMIN", "MEMBER", "VIEWER"].includes(role)) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }

    const teamId = req.user!.teamId;
    if (!teamId) {
      res.status(403).json({ error: "No team" });
      return;
    }

    const me = await getMyMembership(req.user!.userId, teamId);
    if (!canManageTeam(me?.role) && req.user!.role !== "ADMIN") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await prisma.teamMember.update({
      where: { id: req.params.id },
      data: { role: role as any },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

teamRouter.delete("/members/:id", async (req, res) => {
  try {
    const existing = await prisma.teamMember.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    const teamId = req.user!.teamId;
    const isSelf = existing.userId === req.user!.userId;
    const me = await getMyMembership(req.user!.userId, teamId ?? "");
    const isAdmin = req.user!.role === "ADMIN";

    if (!isSelf && !isAdmin && !canManageTeam(me?.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await prisma.teamMember.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

teamRouter.put("/", async (req, res) => {
  try {
    const { name } = req.body as { name?: string };
    if (!name?.trim()) {
      res.status(400).json({ error: "name required" });
      return;
    }

    const teamId = req.user!.teamId;
    if (!teamId) {
      res.status(403).json({ error: "No team" });
      return;
    }

    const me = await getMyMembership(req.user!.userId, teamId);
    if (!canManageTeam(me?.role) && req.user!.role !== "ADMIN") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const team = await prisma.team.update({
      where: { id: teamId },
      data: { name: name.trim() },
    });
    res.json({ id: team.id, name: team.name });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
