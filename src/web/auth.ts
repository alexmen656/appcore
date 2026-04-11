import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env, prisma } from "../config";

const JWT_SECRET = env.JWT_SECRET;
export const JWT_EXPIRES_IN = "30d";

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  teamId: string | null;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function verifyAppOwnership(
  req: Request,
  res: Response,
  appId: string,
) {
  const app = await prisma.app.findUnique({ where: { id: appId } });
  if (!app) {
    res.status(404).json({ error: "App not found" });
    return null;
  }
  if (req.user!.role === "ADMIN") return app;
  if (!app.teamId || app.teamId !== req.user!.teamId) {
    res.status(403).json({ error: "Not authorized" });
    return null;
  }
  return app;
}

export async function verifyAppOwnershipByBundleId(
  req: Request,
  res: Response,
  bundleId: string,
) {
  const app = await prisma.app.findUnique({ where: { bundleId } });
  if (!app) {
    res.status(404).json({ error: "App not found" });
    return null;
  }
  if (req.user!.role === "ADMIN") return app;
  if (!app.teamId || app.teamId !== req.user!.teamId) {
    res.status(403).json({ error: "Not authorized" });
    return null;
  }
  return app;
}

export async function requireTeamAdmin(
  req: Request,
  res: Response,
): Promise<boolean> {
  if (req.user!.role === "ADMIN") return true;
  if (!req.user!.teamId) {
    res.status(403).json({ error: "No team" });
    return false;
  }
  const member = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: { teamId: req.user!.teamId, userId: req.user!.userId },
    },
    select: { role: true },
  });
  if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
    res.status(403).json({ error: "Team admin role required" });
    return false;
  }
  return true;
}

export async function verifyTeamMemberBelongsToTeam(
  req: Request,
  res: Response,
  memberId: string,
) {
  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
  });
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return null;
  }
  if (req.user!.role !== "ADMIN" && member.teamId !== req.user!.teamId) {
    res.status(403).json({ error: "Not authorized" });
    return null;
  }
  return member;
}
