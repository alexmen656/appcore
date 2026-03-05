import { Router, Request, Response } from "express";
import crypto from "crypto";
import { logger, prisma } from "../../config";
import { requireAuth } from "../auth";
import {
  getGitHubOAuthUrl,
  exchangeGitHubCode,
  getGitHubUser,
  listUserRepos,
  linkRepoToApp,
  unlinkRepoFromApp,
  verifyWebhookSignature,
  type GitHubWebhookPayload,
} from "../../services/github";
import { runScreenshotGeneration } from "../../jobs/defs/generate-screenshots";

export const githubRouter = Router();

// ─── OAuth: start ────────────────────────────────────────────────────────────
// GET /api/github/oauth/start → returns the redirect URL
githubRouter.get(
  "/oauth/start",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const state = Buffer.from(
        JSON.stringify({ userId: req.user!.userId, ts: Date.now() }),
      ).toString("base64url");
      const url = getGitHubOAuthUrl(state);
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// ─── OAuth: callback ─────────────────────────────────────────────────────────
// GET /api/github/oauth/callback?code=xxx&state=xxx
githubRouter.get("/oauth/callback", async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const stateRaw = req.query.state as string;
    if (!code || !stateRaw) {
      res.status(400).json({ error: "Missing code or state" });
      return;
    }

    const { userId } = JSON.parse(
      Buffer.from(stateRaw, "base64url").toString(),
    );
    if (!userId) {
      res.status(400).json({ error: "Invalid state" });
      return;
    }

    const accessToken = await exchangeGitHubCode(code);
    const ghUser = await getGitHubUser(accessToken);

    await prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        githubAccessToken: accessToken,
        githubUsername: ghUser.login,
        githubAvatarUrl: ghUser.avatar_url,
        githubConnectedAt: new Date(),
      },
      update: {
        githubAccessToken: accessToken,
        githubUsername: ghUser.login,
        githubAvatarUrl: ghUser.avatar_url,
        githubConnectedAt: new Date(),
      },
    });

    logger.info(`GitHub connected for user ${userId}: @${ghUser.login}`);

    // Redirect back to the web UI settings page
    res.redirect("/settings?github=connected");
  } catch (err: any) {
    logger.error(`GitHub OAuth callback error: ${err.message}`);
    res.redirect("/settings?github=error");
  }
});

// ─── GitHub connection status ────────────────────────────────────────────────
githubRouter.get(
  "/status",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const settings = await prisma.userSettings.findUnique({
        where: { userId: req.user!.userId },
      });
      res.json({
        connected: !!settings?.githubAccessToken,
        username: settings?.githubUsername ?? null,
        avatarUrl: settings?.githubAvatarUrl ?? null,
        connectedAt: settings?.githubConnectedAt ?? null,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// ─── Disconnect GitHub ───────────────────────────────────────────────────────
githubRouter.post(
  "/disconnect",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      await prisma.userSettings.update({
        where: { userId: req.user!.userId },
        data: {
          githubAccessToken: null,
          githubUsername: null,
          githubAvatarUrl: null,
          githubConnectedAt: null,
        },
      });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// ─── List user repos ─────────────────────────────────────────────────────────
githubRouter.get("/repos", requireAuth, async (req: Request, res: Response) => {
  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId: req.user!.userId },
    });
    if (!settings?.githubAccessToken) {
      res.status(400).json({ error: "GitHub not connected" });
      return;
    }
    const repos = await listUserRepos(settings.githubAccessToken);
    res.json(
      repos.map((r) => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        owner: r.owner.login,
        private: r.private,
        defaultBranch: r.default_branch,
        htmlUrl: r.html_url,
      })),
    );
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Link repo to app ────────────────────────────────────────────────────────
githubRouter.post("/link", requireAuth, async (req: Request, res: Response) => {
  try {
    const { appId, repoFullName } = req.body;
    if (!appId || !repoFullName) {
      res.status(400).json({ error: "appId and repoFullName required" });
      return;
    }
    await linkRepoToApp(req.user!.userId, appId, repoFullName);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Unlink repo from app ────────────────────────────────────────────────────
githubRouter.post(
  "/unlink",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { appId } = req.body;
      if (!appId) {
        res.status(400).json({ error: "appId required" });
        return;
      }
      await unlinkRepoFromApp(req.user!.userId, appId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// ─── Get linked repo for an app ──────────────────────────────────────────────
githubRouter.get(
  "/app-repo/:appId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const app = await prisma.app.findUnique({
        where: { id: req.params.appId },
        select: {
          githubRepoOwner: true,
          githubRepoName: true,
          githubRepoFullName: true,
        },
      });
      res.json({
        linked: !!app?.githubRepoFullName,
        repoFullName: app?.githubRepoFullName ?? null,
        repoOwner: app?.githubRepoOwner ?? null,
        repoName: app?.githubRepoName ?? null,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// ─── Screenshot jobs for an app ──────────────────────────────────────────────
githubRouter.get(
  "/screenshots/:appId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const jobs = await prisma.screenshotJob.findMany({
        where: { appId: req.params.appId },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      res.json(
        jobs.map((j) => ({
          ...j,
          logs: j.logs ? JSON.parse(j.logs) : [],
        })),
      );
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// ─── Webhook endpoint (no auth — verified via HMAC) ─────────────────────────
githubRouter.post("/webhook", async (req: Request, res: Response) => {
  try {
    const event = req.headers["x-github-event"] as string;
    const signature = req.headers["x-hub-signature-256"] as string;
    const body = JSON.stringify(req.body);

    if (event !== "push") {
      res.json({ ok: true, skipped: true, reason: `event=${event}` });
      return;
    }

    const payload = req.body as GitHubWebhookPayload;
    const repoFullName = payload.repository.full_name;

    // Find the app linked to this repo
    const app = await prisma.app.findFirst({
      where: { githubRepoFullName: repoFullName },
    });

    if (!app) {
      logger.warn(`Webhook received for unlinked repo: ${repoFullName}`);
      res.status(200).json({ ok: false, reason: "no linked app" });
      return;
    }

    // Verify signature
    if (!app.githubWebhookSecret || !signature) {
      res.status(401).json({ error: "Missing signature or secret" });
      return;
    }

    if (!verifyWebhookSignature(body, signature, app.githubWebhookSecret)) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    const commitSha = payload.after;
    const commitMessage = payload.head_commit?.message ?? null;
    const branch = payload.ref.replace("refs/heads/", "");
    const pusher = payload.pusher.name;

    logger.info(
      `GitHub push: ${repoFullName}@${branch} (${commitSha.slice(0, 7)}) by ${pusher}`,
    );

    // Create screenshot job and kick off async
    const job = await prisma.screenshotJob.create({
      data: {
        appId: app.id,
        commitSha,
        commitMessage,
        branch,
        pusher,
        status: "PENDING",
      },
    });

    // Fire and forget — run screenshot generation in background
    runScreenshotGeneration(job.id).catch((err) =>
      logger.error(
        `Screenshot generation failed for job ${job.id}: ${err.message}`,
      ),
    );

    res.json({ ok: true, jobId: job.id });
  } catch (err: any) {
    logger.error(`Webhook handler error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});
