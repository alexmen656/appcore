import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export function workerAuth(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.FASTLANE_WORKER_SECRET;
  if (!secret) {
    console.error("FASTLANE_WORKER_SECRET not set — rejecting all requests");
    res.status(500).json({ error: "Worker not configured" });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  const tokenBuf = Buffer.from(token);
  const secretBuf = Buffer.from(secret);
  const valid =
    tokenBuf.length === secretBuf.length &&
    crypto.timingSafeEqual(tokenBuf, secretBuf);
  if (!valid) {
    res.status(403).json({ error: "Invalid worker secret" });
    return;
  }

  next();
}
