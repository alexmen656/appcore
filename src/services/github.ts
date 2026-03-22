import crypto from "crypto";
import axios from "axios";
import { logger, prisma } from "../config";
import { env } from "../config/env";
import { decryptNullable } from "../config/encryption";

export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  default_branch: string;
  html_url: string;
}

export interface GitHubWebhookPayload {
  ref: string;
  after: string;
  head_commit: {
    id: string;
    message: string;
    author: { username: string };
  } | null;
  pusher: { name: string };
  repository: {
    full_name: string;
  };
}

const GITHUB_API = "https://api.github.com";

export function getGitHubOAuthUrl(state: string): string {
  const clientId = env.GITHUB_CLIENT_ID;
  if (!clientId) throw new Error("GITHUB_CLIENT_ID not configured");
  const params = new URLSearchParams({
    client_id: clientId,
    scope: "repo",
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export async function exchangeGitHubCode(code: string): Promise<string> {
  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error("GitHub OAuth credentials not configured");

  const { data } = await axios.post(
    "https://github.com/login/oauth/access_token",
    { client_id: clientId, client_secret: clientSecret, code },
    { headers: { Accept: "application/json" } },
  );

  if (data.error)
    throw new Error(
      `GitHub OAuth error: ${data.error_description ?? data.error}`,
    );
  return data.access_token as string;
}

export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const { data } = await axios.get<GitHubUser>(`${GITHUB_API}/user`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function listUserRepos(
  accessToken: string,
): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  while (true) {
    const { data } = await axios.get<GitHubRepo[]>(`${GITHUB_API}/user/repos`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { per_page: 100, page, sort: "updated", direction: "desc" },
    });
    repos.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return repos;
}

export async function createWebhook(
  accessToken: string,
  repoFullName: string,
  secret: string,
): Promise<number> {
  const baseUrl = env.GITHUB_WEBHOOK_BASE_URL;
  if (!baseUrl) throw new Error("GITHUB_WEBHOOK_BASE_URL not configured");

  const { data } = await axios.post(
    `${GITHUB_API}/repos/${repoFullName}/hooks`,
    {
      name: "web",
      active: true,
      events: ["push"],
      config: {
        url: `${baseUrl}/api/github/webhook`,
        content_type: "json",
        secret,
        insecure_ssl: "0",
      },
    },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  logger.info(`Created GitHub webhook ${data.id} on ${repoFullName}`);
  return data.id as number;
}

export async function deleteWebhook(
  accessToken: string,
  repoFullName: string,
  webhookId: bigint,
): Promise<void> {
  try {
    await axios.delete(
      `${GITHUB_API}/repos/${repoFullName}/hooks/${webhookId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    logger.info(`Deleted GitHub webhook ${webhookId} from ${repoFullName}`);
  } catch (err: any) {
    if (err.response?.status === 404) {
      logger.warn(`Webhook ${webhookId} already gone from ${repoFullName}`);
    } else {
      throw err;
    }
  }
}

export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
): boolean {
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function linkRepoToApp(
  userId: string,
  appId: string,
  repoFullName: string,
): Promise<void> {
  const membership = await prisma.teamMember.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
  const settings = membership
    ? await prisma.teamSettings.findUnique({ where: { teamId: membership.teamId } })
    : null;
  if (!settings?.githubAccessToken)
    throw new Error("GitHub not connected. Connect in Settings first.");

  const token = decryptNullable(settings.githubAccessToken)!;
  const app = await prisma.app.findUnique({ where: { id: appId } });
  if (!app) throw new Error("App not found");

  if (app.githubRepoFullName && app.githubWebhookId) {
    await deleteWebhook(
      token,
      app.githubRepoFullName,
      app.githubWebhookId,
    ).catch((err) => logger.warn(`Error removing old webhook: ${err.message}`));
  }

  const [owner, name] = repoFullName.split("/");
  const secret = crypto.randomBytes(32).toString("hex");
  const webhookId = await createWebhook(
    token,
    repoFullName,
    secret,
  );

  await prisma.app.update({
    where: { id: appId },
    data: {
      githubRepoOwner: owner,
      githubRepoName: name,
      githubRepoFullName: repoFullName,
      githubWebhookId: BigInt(webhookId),
      githubWebhookSecret: secret,
    },
  });

  logger.info(`Linked repo ${repoFullName} → app ${app.bundleId}`);
}

export async function unlinkRepoFromApp(
  userId: string,
  appId: string,
): Promise<void> {
  const membership = await prisma.teamMember.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
  const settings = membership
    ? await prisma.teamSettings.findUnique({ where: { teamId: membership.teamId } })
    : null;
  const app = await prisma.app.findUnique({ where: { id: appId } });
  if (!app) throw new Error("App not found");

  if (
    app.githubRepoFullName &&
    app.githubWebhookId &&
    settings?.githubAccessToken
  ) {
    await deleteWebhook(
      decryptNullable(settings.githubAccessToken)!,
      app.githubRepoFullName,
      app.githubWebhookId,
    ).catch((err) => logger.warn(`Error removing webhook: ${err.message}`));
  }

  await prisma.app.update({
    where: { id: appId },
    data: {
      githubRepoOwner: null,
      githubRepoName: null,
      githubRepoFullName: null,
      githubWebhookId: null,
      githubWebhookSecret: null,
    },
  });

  logger.info(`Unlinked repo from app ${app.bundleId}`);
}

export async function cloneRepo(
  accessToken: string,
  repoFullName: string,
  targetDir: string,
  branch?: string,
): Promise<void> {
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  const cloneUrl = `https://x-access-token:${accessToken}@github.com/${repoFullName}.git`;
  const branchArg = branch ? `--branch ${branch}` : "";
  await execAsync(`git clone --depth 1 ${branchArg} ${cloneUrl} ${targetDir}`, {
    timeout: 120_000,
  });
}
