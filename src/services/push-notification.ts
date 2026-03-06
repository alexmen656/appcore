import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import http2 from "http2";
import fs from "fs";
import path from "path";
import { prisma } from "../config/database.js";
import { logger } from "../config/logger.js";

interface APNsConfig {
  keyId: string;
  teamId: string;
  bundleId: string;
  keyPath: string;
  production: boolean;
}

interface PushPayload {
  title: string;
  body: string;
  category?: string;
  badge?: number;
  sound?: string;
  data?: Record<string, string>;
}

class PushNotificationService {
  private static instance: PushNotificationService;
  private config: APNsConfig | null = null;
  private jwtToken: string | null = null;
  private jwtIssuedAt: number = 0;

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  configure(config: APNsConfig) {
    this.config = config;
    this.jwtToken = null;
    logger.info(
      `[PUSH] Configured APNs for ${config.bundleId} (${config.production ? "production" : "sandbox"})`,
    );
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  private getAuthToken(): string {
    if (!this.config) throw new Error("APNs not configured");

    const now = Math.floor(Date.now() / 1000);
    if (this.jwtToken && now - this.jwtIssuedAt < 3000) {
      return this.jwtToken;
    }

    const keyPath = this.config.keyPath;
    let privateKey: string;

    if (keyPath.startsWith("-----BEGIN")) {
      privateKey = keyPath;
    } else {
      privateKey = fs.readFileSync(keyPath, "utf8");
    }

    this.jwtToken = jwt.sign({}, privateKey, {
      algorithm: "ES256",
      keyid: this.config.keyId,
      issuer: this.config.teamId,
      expiresIn: "1h",
      header: {
        alg: "ES256",
        kid: this.config.keyId,
      },
    } as any);

    this.jwtIssuedAt = now;
    return this.jwtToken!;
  }

  async sendToDevice(
    deviceToken: string,
    payload: PushPayload,
  ): Promise<boolean> {
    if (!this.config) {
      logger.warn("[PUSH] APNs not configured, skipping push");
      return false;
    }

    const db = prisma;
    const apnsHost = this.config.production
      ? "api.push.apple.com"
      : "api.sandbox.push.apple.com";

    const apnsPayload = {
      aps: {
        alert: {
          title: payload.title,
          body: payload.body,
        },
        badge: payload.badge ?? 1,
        sound: payload.sound ?? "default",
        category: payload.category,
        "mutable-content": 1,
      },
      ...payload.data,
    };

    return new Promise((resolve) => {
      const client = http2.connect(`https://${apnsHost}`);

      client.on("error", (err) => {
        logger.error(`[PUSH] HTTP/2 connection error: ${err.message}`);
        resolve(false);
      });

      const headers = {
        ":method": "POST",
        ":path": `/3/device/${deviceToken}`,
        authorization: `bearer ${this.getAuthToken()}`,
        "apns-topic": this.config!.bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-expiration": "0",
      };

      const req = client.request(headers);
      let responseData = "";
      let statusCode = 0;

      req.on("response", (headers) => {
        statusCode = headers[":status"] as number;
      });

      req.on("data", (chunk) => {
        responseData += chunk;
      });

      req.on("end", async () => {
        client.close();

        const success = statusCode === 200;

        try {
          await db.pushNotificationLog.create({
            data: {
              deviceToken,
              title: payload.title,
              body: payload.body,
              category: payload.category,
              data: payload.data as any,
              status: success ? "sent" : "failed",
              error: success ? null : responseData,
            },
          });
        } catch (e) {
          logger.error(`[PUSH] Failed to log notification: ${e}`);
        }

        if (!success) {
          logger.error(`[PUSH] APNs error ${statusCode}: ${responseData}`);

          if (statusCode === 410 || statusCode === 400) {
            try {
              await db.deviceToken.updateMany({
                where: { token: deviceToken },
                data: { isActive: false },
              });
            } catch (e) {
              logger.error(`[PUSH] Failed to deactivate token: ${e}`);
            }
          }
        } else {
          logger.info(`[PUSH] Sent to ${deviceToken.substring(0, 8)}...`);
        }

        resolve(success);
      });

      req.write(JSON.stringify(apnsPayload));
      req.end();
    });
  }

  async sendToAll(
    payload: PushPayload,
  ): Promise<{ sent: number; failed: number }> {
    const db = prisma;
    const tokens = await db.deviceToken.findMany({
      where: { isActive: true, platform: "ios" },
    });

    let sent = 0;
    let failed = 0;

    for (const token of tokens) {
      const success = await this.sendToDevice(token.token, payload);
      if (success) sent++;
      else failed++;
    }

    logger.info(
      `[PUSH] Broadcast: ${sent} sent, ${failed} failed (of ${tokens.length} devices)`,
    );
    return { sent, failed };
  }

  async sendToUser(
    userId: string,
    payload: PushPayload,
  ): Promise<{ sent: number; failed: number }> {
    const db = prisma;
    const tokens = await db.deviceToken.findMany({
      where: { userId, isActive: true, platform: "ios" },
    });

    let sent = 0;
    let failed = 0;

    for (const token of tokens) {
      const success = await this.sendToDevice(token.token, payload);
      if (success) sent++;
      else failed++;
    }

    return { sent, failed };
  }

  async notifyKeywordRankChange(
    keywordTerm: string,
    oldRank: number | null,
    newRank: number | null,
    country: string,
  ) {
    const rankText = newRank ? `now #${newRank}` : "no longer ranked";

    const changeText =
      oldRank && newRank
        ? newRank < oldRank
          ? `↑ ${oldRank - newRank}`
          : `↓ ${newRank - oldRank}`
        : "";

    await this.sendToAll({
      title: `🔑 Keyword Rank Update`,
      body: `"${keywordTerm}" (${country.toUpperCase()}): ${rankText} ${changeText}`.trim(),
      category: "KEYWORD_RANK_UPDATE",
      data: {
        keywordTerm,
        country,
        oldRank: String(oldRank ?? ""),
        newRank: String(newRank ?? ""),
      },
    });
  }

  async notifySubmissionUpdate(
    appName: string,
    versionString: string,
    status: string,
  ) {
    const statusEmoji =
      status === "READY_FOR_DISTRIBUTION"
        ? "✅"
        : status === "IN_REVIEW"
          ? "👀"
          : status === "REJECTED"
            ? "❌"
            : "📦";

    await this.sendToAll({
      title: `${statusEmoji} App Store Update`,
      body: `${appName} v${versionString}: ${status.replace(/_/g, " ").toLowerCase()}`,
      category: "SUBMISSION_UPDATE",
      data: {
        appName,
        versionString,
        status,
      },
    });
  }

  async notifyJobComplete(
    jobType: string,
    status: string,
    itemsCount?: number,
  ) {
    const statusEmoji = status === "COMPLETED" ? "✅" : "❌";
    const itemsText = itemsCount ? ` (${itemsCount} items)` : "";

    await this.sendToAll({
      title: `${statusEmoji} Job ${status.toLowerCase()}`,
      body: `${jobType.replace(/-/g, " ")}${itemsText}`,
      category: "JOB_COMPLETE",
      data: {
        jobType,
        status,
        itemsCount: String(itemsCount ?? 0),
      },
    });
  }
}

export const pushService = PushNotificationService.getInstance();
export type { APNsConfig, PushPayload };
