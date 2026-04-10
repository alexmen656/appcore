import jwt from "jsonwebtoken";
import http2 from "http2";
import fs from "fs";
import { Resend } from "resend";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

export interface APNsConfig {
  keyId: string;
  teamId: string;
  bundleId: string;
  keyPath: string;
  production: boolean;
}

export interface PushPayload {
  title: string;
  body: string;
  category?: string;
  badge?: number;
  sound?: string;
  data?: Record<string, string>;
}

export interface EmailContent {
  title: string;
  body: string;
  cta?: { label: string; url: string };
  footer?: string;
}

export interface NotifyOptions {
  push?: PushPayload;
  email?: { to: string; subject: string } & EmailContent;
}

export interface NotifyResult {
  push?: { sent: number; failed: number } | boolean;
  email?: "sent" | "skipped" | "failed";
}

class NotificationService {
  private static instance: NotificationService;
  private apnsConfig: APNsConfig | null = null;
  private jwtToken: string | null = null;
  private jwtIssuedAt = 0;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  configure(config: APNsConfig): void {
    this.apnsConfig = config;
    this.jwtToken = null;
    logger.info(
      `[PUSH] Configured APNs for ${config.bundleId} (${config.production ? "production" : "sandbox"})`,
    );
  }

  isConfigured(): boolean {
    return this.apnsConfig !== null;
  }

  private getAuthToken(): string {
    if (!this.apnsConfig) throw new Error("APNs not configured");
    const now = Math.floor(Date.now() / 1000);
    if (this.jwtToken && now - this.jwtIssuedAt < 3000) return this.jwtToken;

    const { keyPath, keyId, teamId } = this.apnsConfig;
    const privateKey = keyPath.startsWith("-----BEGIN")
      ? keyPath
      : fs.readFileSync(keyPath, "utf8");

    this.jwtToken = jwt.sign({}, privateKey, {
      algorithm: "ES256",
      keyid: keyId,
      issuer: teamId,
      expiresIn: "1h",
      header: { alg: "ES256", kid: keyId },
    } as any);
    this.jwtIssuedAt = now;
    return this.jwtToken!;
  }

  async sendToDevice(
    deviceToken: string,
    payload: PushPayload,
  ): Promise<boolean> {
    if (!this.apnsConfig) {
      logger.warn("[PUSH] APNs not configured, skipping push");
      return false;
    }

    const apnsHost = this.apnsConfig.production
      ? "api.push.apple.com"
      : "api.sandbox.push.apple.com";

    const apnsPayload = {
      aps: {
        alert: { title: payload.title, body: payload.body },
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

      const req = client.request({
        ":method": "POST",
        ":path": `/3/device/${deviceToken}`,
        authorization: `bearer ${this.getAuthToken()}`,
        "apns-topic": this.apnsConfig!.bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-expiration": "0",
      });

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
          await prisma.pushNotificationLog.create({
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
              await prisma.deviceToken.updateMany({
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
    const tokens = await prisma.deviceToken.findMany({
      where: { isActive: true, platform: "ios" },
    });
    const results = await Promise.all(
      tokens.map((t) => this.sendToDevice(t.token, payload)),
    );
    const sent = results.filter(Boolean).length;
    const failed = results.length - sent;
    logger.info(
      `[PUSH] Broadcast: ${sent} sent, ${failed} failed (of ${tokens.length} devices)`,
    );
    return { sent, failed };
  }

  async sendToUser(
    userId: string,
    payload: PushPayload,
  ): Promise<{ sent: number; failed: number }> {
    const tokens = await prisma.deviceToken.findMany({
      where: { userId, isActive: true, platform: "ios" },
    });
    const results = await Promise.all(
      tokens.map((t) => this.sendToDevice(t.token, payload)),
    );
    const sent = results.filter(Boolean).length;
    return { sent, failed: results.length - sent };
  }

  async sendEmail(
    emailOpts: NonNullable<NotifyOptions["email"]>,
  ): Promise<NotifyResult["email"]> {
    if (!env.RESEND_API_KEY) {
      logger.warn(
        `[email] RESEND_API_KEY not set — skipping "${emailOpts.subject}" to ${emailOpts.to}`,
      );
      return "skipped";
    }
    try {
      const { to, subject, ...content } = emailOpts;
      const ctaBlock = content.cta
        ? `<a href="${content.cta.url}" style="display:inline-block;background:#ea0e2b;color:white;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:12px;margin-top:8px;">${content.cta.label}</a>`
        : "";
      const footer =
        content.footer ??
        "Falls du diese E-Mail nicht erwartet hast, kannst du sie ignorieren.";

      const html = `<!DOCTYPE html>
    <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fb;margin:0;padding:40px 20px;">
    <div style="max-width:480px;margin:0 auto;background:white;border-radius:16px;padding:40px;border:1px solid #e5e7eb;">
    <div style="font-size:24px;font-weight:800;color:#ea0e2b;margin-bottom:24px;letter-spacing:-0.3px;">marteso</div>
    <h1 style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 12px;">${content.title}</h1>
    <div style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 24px;">${content.body}</div>
    ${ctaBlock}
    <p style="color:#9ca3af;font-size:12px;margin-top:24px;line-height:1.5;">${footer}</p>
    </div></body></html>`;

      await new Resend(env.RESEND_API_KEY).emails.send({
        from: env.EMAIL_FROM,
        to,
        subject,
        html,
      });

      return "sent";
    } catch {
      return "failed";
    }
  }

  async notifyUser(
    userId: string,
    options: NotifyOptions,
  ): Promise<NotifyResult> {
    const result: NotifyResult = {};
    await Promise.all([
      options.push
        ? this.sendToUser(userId, options.push)
            .then((r) => (result.push = r))
            .catch((err) => {
              logger.error("[notify] Push to user failed", err);
              result.push = { sent: 0, failed: 1 };
            })
        : Promise.resolve(),
      options.email
        ? this.sendEmail(options.email).then((r) => (result.email = r))
        : Promise.resolve(),
    ]);
    return result;
  }

  async notifyAll(options: NotifyOptions): Promise<NotifyResult> {
    const result: NotifyResult = {};
    await Promise.all([
      options.push
        ? this.sendToAll(options.push)
            .then((r) => (result.push = r))
            .catch((err) => {
              logger.error("[notify] Broadcast push failed", err);
              result.push = { sent: 0, failed: 1 };
            })
        : Promise.resolve(),
      options.email
        ? this.sendEmail(options.email).then((r) => (result.email = r))
        : Promise.resolve(),
    ]);
    return result;
  }

  async notifyDevice(
    deviceToken: string,
    options: NotifyOptions,
  ): Promise<NotifyResult> {
    const result: NotifyResult = {};
    await Promise.all([
      options.push
        ? this.sendToDevice(deviceToken, options.push)
            .then((r) => (result.push = r))
            .catch((err) => {
              logger.error("[notify] Push to device failed", err);
              result.push = false;
            })
        : Promise.resolve(),
      options.email
        ? this.sendEmail(options.email).then((r) => (result.email = r))
        : Promise.resolve(),
    ]);
    return result;
  }
}

export const notificationService = NotificationService.getInstance();
