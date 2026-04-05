import { Router, Request, Response } from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import { logger, prisma } from "../../config";
import { requireAuth } from "../auth";
import { encrypt, decryptNullable } from "../../config/encryption";
import {
  getGitHubOAuthUrl,
  exchangeGitHubCode,
  getGitHubUser,
  listUserRepos,
  listRepoDirs,
  linkRepoToApp,
  unlinkRepoFromApp,
  verifyWebhookSignature,
  type GitHubWebhookPayload,
} from "../../services/github";
import { runScreenshotGeneration } from "../../jobs/defs/generate-screenshots";
import { runBuildJob } from "../../jobs/defs/build-binary";
import { frameWithFastlane } from "../../services/frame-screenshots";

export const githubRouter = Router();

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

    const membership = await prisma.teamMember.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    if (!membership) {
      res.redirect("/settings?github=error");
      return;
    }

    const teamId = membership.teamId;
    const accessToken = await exchangeGitHubCode(code);
    const ghUser = await getGitHubUser(accessToken);
    const encryptedToken = encrypt(accessToken);

    await prisma.teamSettings.upsert({
      where: { teamId },
      create: {
        teamId,
        githubAccessToken: encryptedToken,
        githubUsername: ghUser.login,
        githubAvatarUrl: ghUser.avatar_url,
        githubConnectedAt: new Date(),
      },
      update: {
        githubAccessToken: encryptedToken,
        githubUsername: ghUser.login,
        githubAvatarUrl: ghUser.avatar_url,
        githubConnectedAt: new Date(),
      },
    });

    logger.info(`GitHub connected for user ${userId}: @${ghUser.login}`);
    res.redirect("/settings?github=connected");
  } catch (err: any) {
    logger.error(`GitHub OAuth callback error: ${err.message}`);
    res.redirect("/settings?github=error");
  }
});

githubRouter.get(
  "/status",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const teamId = req.user!.teamId;
      const settings = teamId
        ? await prisma.teamSettings.findUnique({ where: { teamId } })
        : null;
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

githubRouter.post(
  "/disconnect",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const teamId = req.user!.teamId;
      if (teamId) {
        await prisma.teamSettings.updateMany({
          where: { teamId },
          data: {
            githubAccessToken: null,
            githubUsername: null,
            githubAvatarUrl: null,
            githubConnectedAt: null,
          },
        });
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

githubRouter.get("/repos", requireAuth, async (req: Request, res: Response) => {
  try {
    const teamId = req.user!.teamId;
    const settings = teamId
      ? await prisma.teamSettings.findUnique({ where: { teamId } })
      : null;
    if (!settings?.githubAccessToken) {
      res.status(400).json({ error: "GitHub not connected" });
      return;
    }
    const repos = await listUserRepos(
      decryptNullable(settings.githubAccessToken)!,
    );
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

githubRouter.get(
  "/repo-dirs/:owner/:repo",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const teamId = req.user!.teamId;
      const settings = teamId
        ? await prisma.teamSettings.findUnique({ where: { teamId } })
        : null;
      if (!settings?.githubAccessToken) {
        res.status(400).json({ error: "GitHub not connected" });
        return;
      }
      const repoFullName = `${req.params.owner}/${req.params.repo}`;
      const dirs = await listRepoDirs(
        decryptNullable(settings.githubAccessToken)!,
        repoFullName,
      );
      res.json(dirs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

githubRouter.post("/link", requireAuth, async (req: Request, res: Response) => {
  try {
    const { appId, repoFullName, iosDir } = req.body;
    if (!appId || !repoFullName) {
      res.status(400).json({ error: "appId and repoFullName required" });
      return;
    }
    await linkRepoToApp(req.user!.userId, appId, repoFullName, iosDir ?? null);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

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

githubRouter.get(
  "/app-repo/:appId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const app = await prisma.app.findUnique({
        where: { id: req.params.appId as string },
        select: {
          githubRepoOwner: true,
          githubRepoName: true,
          githubRepoFullName: true,
          githubIosDir: true,
        },
      });
      res.json({
        linked: !!app?.githubRepoFullName,
        repoFullName: app?.githubRepoFullName ?? null,
        repoOwner: app?.githubRepoOwner ?? null,
        repoName: app?.githubRepoName ?? null,
        iosDir: app?.githubIosDir ?? null,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

githubRouter.get(
  "/snapshot-env/:appId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const app = await prisma.app.findUnique({
        where: { id: req.params.appId as string },
        select: { snapshotEnvVars: true },
      });
      if (!app) {
        res.status(404).json({ error: "App not found" });
        return;
      }
      const envVars: Array<{ key: string; value: string }> = app.snapshotEnvVars
        ? JSON.parse(decryptNullable(app.snapshotEnvVars)!)
        : [];
      res.json({ envVars });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

githubRouter.put(
  "/snapshot-env/:appId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { envVars } = req.body as {
        envVars: Array<{ key: string; value: string }>;
      };
      if (!Array.isArray(envVars)) {
        res.status(400).json({ error: "envVars must be an array" });
        return;
      }
      const encrypted = encrypt(JSON.stringify(envVars));
      await prisma.app.update({
        where: { id: req.params.appId as string },
        data: { snapshotEnvVars: encrypted },
      });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

githubRouter.get(
  "/builds/:appId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const jobs = await prisma.buildJob.findMany({
        where: { appId: req.params.appId as string },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      res.json(
        jobs.map((j) => ({
          ...j,
          logs: j.logs ? JSON.parse(j.logs) : [],
          errors: j.errors ? JSON.parse(j.errors) : [],
        })),
      );
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

githubRouter.get(
  "/screenshots/:appId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const jobs = await prisma.screenshotJob.findMany({
        where: { appId: req.params.appId as string },
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

async function getAppAndToken(appId: string, res: Response) {
  const app = await prisma.app.findUnique({ where: { id: appId } });
  if (!app) {
    res.status(404).json({ error: "App not found" });
    return null;
  }
  if (!app.githubRepoFullName) {
    res.status(400).json({ error: "No GitHub repo linked" });
    return null;
  }
  const settings = await prisma.teamSettings.findFirst({
    where: { githubAccessToken: { not: null } },
  });
  if (!settings?.githubAccessToken) {
    res.status(400).json({ error: "No GitHub access token configured" });
    return null;
  }
  const token = decryptNullable(settings.githubAccessToken)!;
  return { app, token };
}

async function fetchLatestCommit(repoFullName: string, token: string) {
  const { data } = await axios.get(
    `https://api.github.com/repos/${repoFullName}/git/refs/heads`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    },
  );
  const ref = Array.isArray(data) ? data[0] : null;
  return {
    commitSha: (ref?.object?.sha ?? "unknown") as string,
    branch: (ref?.ref?.replace("refs/heads/", "") ?? "main") as string,
  };
}

githubRouter.post(
  "/screenshots/trigger/:appId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const ctx = await getAppAndToken(req.params.appId as string, res);
      if (!ctx) return;
      const { commitSha, branch } = await fetchLatestCommit(
        ctx.app.githubRepoFullName!,
        ctx.token,
      );
      const job = await prisma.screenshotJob.create({
        data: {
          appId: ctx.app.id,
          commitSha,
          commitMessage: "[manual trigger]",
          branch,
          pusher: req.user!.userId,
          status: "PENDING",
        },
      });
      runScreenshotGeneration(job.id).catch((err) =>
        logger.error(`Screenshot job ${job.id} failed: ${err.message}`),
      );
      res.json({ ok: true, jobId: job.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

githubRouter.post(
  "/builds/trigger/:appId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const ctx = await getAppAndToken(req.params.appId as string, res);
      if (!ctx) return;
      const { commitSha, branch } = await fetchLatestCommit(
        ctx.app.githubRepoFullName!,
        ctx.token,
      );
      runBuildJob(ctx.app.id, {
        repoUrl: `https://github.com/${ctx.app.githubRepoFullName}.git`,
        accessToken: ctx.token,
        branch,
        appName: ctx.app.name,
        bundleId: ctx.app.bundleId,
        commitSha,
      }).catch((err) =>
        logger.error(`Build job for app ${ctx.app.id} failed: ${err.message}`),
      );
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

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

    const app = await prisma.app.findFirst({
      where: { githubRepoFullName: repoFullName },
    });

    if (!app) {
      logger.warn(`Webhook received for unlinked repo: ${repoFullName}`);
      res.status(200).json({ ok: false, reason: "no linked app" });
      return;
    }

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

    const settings = await prisma.teamSettings.findFirst({
      where: { githubAccessToken: { not: null } },
    });

    runScreenshotGeneration(job.id).catch((err) =>
      logger.error(
        `Screenshot generation failed for job ${job.id}: ${err.message}`,
      ),
    );

    if (settings?.githubAccessToken) {
      runBuildJob(app.id, {
        repoUrl: `https://github.com/${repoFullName}.git`,
        accessToken: settings.githubAccessToken,
        branch,
        appName: app.name,
        bundleId: app.bundleId,
        commitSha,
      }).catch((err) =>
        logger.error(`Binary build failed for app ${app.id}: ${err.message}`),
      );
    }

    res.json({ ok: true, jobId: job.id });
  } catch (err: any) {
    logger.error(`Webhook handler error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

githubRouter.post(
  "/screenshots/frame/:jobId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const jobId = req.params.jobId as string;
      const {
        subtitle = "Your App",
        bgColor1 = "#667eea",
        bgColor2 = "#764ba2",
        textColor = "#ffffff",
      } = req.body;

      const job = await prisma.screenshotJob.findUnique({
        where: { id: jobId },
      });
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      if (job.status !== "COMPLETED") {
        res.status(400).json({ error: "Job is not completed yet" });
        return;
      }

      const screenshotsBase = path.join(process.cwd(), "screenshots");
      const rawDir = path.join(screenshotsBase, jobId);
      const framedDir = path.join(screenshotsBase, jobId, "framed");

      if (!fs.existsSync(rawDir)) {
        res
          .status(404)
          .json({ error: "Screenshot directory not found on disk" });
        return;
      }

      const subDirs = fs
        .readdirSync(rawDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name !== "framed")
        .map((e) => path.join(rawDir, e.name));

      const sourceDirs = subDirs.length > 0 ? subDirs : [rawDir];
      const framedUrls: string[] = [];
      const framedByLocale: Record<string, string[]> = {};

      for (const srcDir of sourceDirs) {
        const rel = path.relative(rawDir, srcDir);
        const locale = path.basename(srcDir);
        const outDir = path.join(framedDir, rel === "." ? "" : rel);
        const outputPaths = await frameWithFastlane(srcDir, outDir, {
          subtitle,
          bgColor1,
          bgColor2,
          textColor,
        });
        const urls = outputPaths.map(
          (p) =>
            "/screenshots/" +
            path.relative(screenshotsBase, p).replace(/\\/g, "/"),
        );
        framedUrls.push(...urls);
        const key = rel === "." ? "default" : locale;
        framedByLocale[key] = (framedByLocale[key] ?? []).concat(urls);
      }

      await prisma.screenshotJob.update({
        where: { id: jobId },
        data: { framedByLocale: framedByLocale as any },
      });

      res.json({
        ok: true,
        count: framedUrls.length,
        framedUrls,
        framedByLocale,
      });
    } catch (err: any) {
      logger.error(`Frame screenshots error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  },
);

githubRouter.post(
  "/screenshots/test-local",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const {
        dirPath,
        subtitle = "Your App",
        bgColor1 = "#667eea",
        bgColor2 = "#764ba2",
        textColor = "#ffffff",
      } = req.body;

      if (!dirPath || typeof dirPath !== "string") {
        res.status(400).json({ error: "dirPath is required" });
        return;
      }
      if (!fs.existsSync(dirPath)) {
        res.status(400).json({ error: `Directory not found: ${dirPath}` });
        return;
      }

      const screenshotsBase = path.join(process.cwd(), "screenshots");
      const outputDir = path.join(
        screenshotsBase,
        "local-test",
        String(Date.now()),
      );

      const framedPaths = await frameWithFastlane(dirPath, outputDir, {
        subtitle,
        bgColor1,
        bgColor2,
        textColor,
      });

      const framedUrls = framedPaths.map(
        (p) =>
          "/screenshots/" +
          path.relative(screenshotsBase, p).replace(/\\/g, "/"),
      );

      res.json({ ok: true, count: framedUrls.length, framedUrls, outputDir });
    } catch (err: any) {
      logger.error(`Test-local frame error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  },
);

githubRouter.get(
  "/screenshots/latest-framed/:appId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const ascAppId = req.params.appId as string;

      const internalApp = await prisma.app.findFirst({
        where: { trackId: BigInt(ascAppId) },
        select: { id: true },
      });
      if (!internalApp) {
        res.json({ job: null });
        return;
      }

      const jobs = await prisma.screenshotJob.findMany({
        where: { appId: internalApp.id, status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      const job = jobs.find((j) => j.framedByLocale != null) ?? null;

      if (!job || !job.framedByLocale) {
        res.json({ job: null });
        return;
      }

      res.json({
        job: {
          id: job.id,
          commitSha: job.commitSha,
          commitMessage: job.commitMessage,
          branch: job.branch,
          createdAt: job.createdAt,
          framedByLocale: job.framedByLocale,
        },
      });
    } catch (err: any) {
      logger.error(`latest-framed error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  },
);
