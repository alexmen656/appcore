import { logger, prisma } from "../../config";
import { workerClient } from "../../services/worker-client";
import { postCommitStatus } from "../../services/github";

export async function runBuildJob(
  appId: string,
  params: {
    repoUrl: string;
    accessToken: string;
    branch?: string;
    appName: string;
    bundleId: string;
    iosDir?: string;
    gymScheme?: string;
    exportMethod?: string;
    commitSha?: string;
  },
): Promise<void> {
  logger.info(
    `[build:${appId}] Starting binary build for ${params.bundleId}@${params.branch ?? "default"}`,
  );

  const buildJob = await prisma.buildJob.create({
    data: {
      appId,
      branch: params.branch ?? null,
      commitSha: params.commitSha ?? null,
      status: "PENDING",
    },
  });

  const app = await prisma.app.findUnique({
    where: { id: appId },
    select: {
      signingCertP12: true,
      signingCertPassword: true,
      signingProvisioningProfile: true,
      signingTeamId: true,
      githubIosDir: true,
      githubRepoFullName: true,
    },
  });

  const hasSigning = !!(
    app?.signingCertP12 &&
    app?.signingCertPassword &&
    app?.signingProvisioningProfile
  );
  if (!hasSigning) {
    logger.warn(
      `[build:${appId}] No signing credentials configured — binary build will likely fail at code-signing step`,
    );
  } else {
    logger.info(
      `[build:${appId}] Signing credentials found (teamId: ${app?.signingTeamId ?? "not set"})`,
    );
  }

  await prisma.buildJob.update({
    where: { id: buildJob.id },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  const repoFullName = app?.githubRepoFullName ?? null;
  if (params.commitSha && repoFullName) {
    await postCommitStatus(params.accessToken, repoFullName, params.commitSha, "pending", "appcore/build", "Binary build in progress…");
  }

  try {
    const result = await workerClient.build({
      ...params,
      iosDir: params.iosDir ?? app?.githubIosDir ?? undefined,
      ...(hasSigning && {
        signingCertP12: app!.signingCertP12!,
        signingCertPassword: app!.signingCertPassword!,
        signingProvisioningProfile: app!.signingProvisioningProfile!,
        signingTeamId: app?.signingTeamId ?? undefined,
      }),
    });

    for (const line of result.logs ?? []) {
      logger.info(`[build:${appId}] ${line}`);
    }
    for (const err of result.errors ?? []) {
      logger.error(`[build:${appId}] ERROR: ${err}`);
    }

    if (result.ok && result.ipaBuilt) {
      logger.info(
        `[build:${appId}] Binary build succeeded — IPA: ${result.ipaPath}`,
      );
    } else {
      logger.warn(
        `[build:${appId}] Binary build did not produce an IPA (ok=${result.ok}, ipaBuilt=${result.ipaBuilt})`,
      );
    }

    const succeeded = result.ok && result.ipaBuilt;
    await prisma.buildJob.update({
      where: { id: buildJob.id },
      data: {
        status: succeeded ? "COMPLETED" : "FAILED",
        logs: JSON.stringify(result.logs ?? []),
        errors: JSON.stringify(result.errors ?? []),
        ipaPath: result.ipaPath ?? null,
        completedAt: new Date(),
      },
    });

    if (params.commitSha && repoFullName) {
      await postCommitStatus(
        params.accessToken,
        repoFullName,
        params.commitSha,
        succeeded ? "success" : "failure",
        "appcore/build",
        succeeded ? "Binary build succeeded" : (result.errors?.[0] ?? "Binary build failed").slice(0, 140),
      );
    }
  } catch (err: any) {
    logger.error(`[build:${appId}] Binary build error: ${err.message}`);
    await prisma.buildJob.update({
      where: { id: buildJob.id },
      data: {
        status: "FAILED",
        errors: JSON.stringify([err.message]),
        completedAt: new Date(),
      },
    });

    if (params.commitSha && repoFullName) {
      await postCommitStatus(params.accessToken, repoFullName, params.commitSha, "failure", "appcore/build", err.message.slice(0, 140));
    }
  }
}
