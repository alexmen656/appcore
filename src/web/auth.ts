import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { App } from "@prisma/client";
import { env, prisma } from "../config";

const JWT_SECRET = env.JWT_SECRET;

export type TeamRoleName = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  teamId: string | null;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      bundleApp?: App;
      teamRole?: TeamRoleName | null;
    }
  }
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function loadTeamRole(req: Request, _res: Response, next: NextFunction) {
  if (req.user!.role === "ADMIN") {
    req.teamRole = "OWNER";
    return next();
  }

  try {
    const member = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId: req.user!.teamId!, userId: req.user!.userId },
      },
      select: { role: true },
    });
    req.teamRole = (member?.role as TeamRoleName | undefined) ?? null;
  } catch {
    req.teamRole = null;
  }
  next();
}

export function requireWriteRole(req: Request, res: Response, next: NextFunction) {
  if (!MUTATING_METHODS.has(req.method)) return next();
  if (req.user?.role === "ADMIN") return next();
  if (req.teamRole === "VIEWER") {
    res.status(403).json({ error: "Viewer role cannot perform this action" });
    return;
  }
  next();
}

export function requireTeamAdminMw(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === "ADMIN") return next();
  if (req.teamRole === "OWNER" || req.teamRole === "ADMIN") return next();
  res.status(403).json({ error: "Team admin role required" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const user = verifyToken(header.slice(7));

    if (!user.teamId) {
      res.status(403).json({ error: "No team associated with user" });
      return;
    }

    if (!user.role) {
      res.status(403).json({ error: "No role found in JWT" });
      return;
    }

    if (!user.email) {
      res.status(403).json({ error: "No email found in JWT" });
      return;
    }

    if (!user.userId) {
      res.status(403).json({ error: "No userId found in JWT" });
      return;
    }

    //also verify later with dbb

    req.user = user;

    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function bundleAccess(source: "params" | "query" | "body" = "query", paramName = "bundleId") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const bundleId = req[source]?.[paramName] as string | undefined;
    if (!bundleId) {
      res.status(400).json({ error: `${paramName} required` });
      return;
    }
    const app = await verifyAppOwnershipByBundleId(req, res, bundleId);
    if (!app) return;
    req.bundleApp = app;
    next();
  };
}

export function appAccess(source: "params" | "query" | "body" = "query", paramName = "appId") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const appId = req[source]?.[paramName] as string | undefined;
    if (!appId) {
      res.status(400).json({ error: `${paramName} required` });
      return;
    }
    const app = await verifyAppOwnership(req, res, appId);
    if (!app) return;
    req.bundleApp = app;
    next();
  };
}

export function requireBundleAccess(
  source: "params" | "query" | "body" = "query",
  paramName = "bundleId",
): Array<(req: Request, res: Response, next: NextFunction) => void> {
  return [requireAuth, bundleAccess(source, paramName)];
}

export async function verifyAppOwnership(req: Request, res: Response, appId: string) {
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

export async function verifyAppOwnershipByBundleId(req: Request, res: Response, bundleId: string) {
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

export async function requireTeamAdmin(req: Request, res: Response): Promise<boolean> {
  if (req.user!.role === "ADMIN") return true;
  const member = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: { teamId: req.user!.teamId!, userId: req.user!.userId },
    },
    select: { role: true },
  });
  if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
    res.status(403).json({ error: "Team admin role required" });
    return false;
  }
  return true;
}

export async function loadVersionInBundle(res: Response, versionId: string, bundleId: string) {
  const version = await prisma.appStoreVersion.findFirst({
    where: { id: versionId, bundleId },
  });
  if (!version) {
    res.status(404).json({ error: "Version not found" });
    return null;
  }
  return version;
}

export async function loadVersionLocalizationInBundle(
  res: Response,
  opts: { ascLocalizationId: string; kind: "appInfo" | "version"; bundleId: string },
) {
  const { ascLocalizationId, kind, bundleId } = opts;
  const where =
    kind === "appInfo"
      ? { appInfoLocalizationId: ascLocalizationId, version: { bundleId } }
      : { versionLocalizationId: ascLocalizationId, version: { bundleId } };
  const localization = await prisma.appStoreVersionLocalization.findFirst({ where });
  if (!localization) {
    res.status(404).json({ error: "Localization not found" });
    return null;
  }
  return localization;
}

export async function verifyTeamMemberBelongsToTeam(req: Request, res: Response, memberId: string) {
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
