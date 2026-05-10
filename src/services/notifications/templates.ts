import { notificationService } from "./notification.js";
import { env } from "../../config/env.js";

export async function teamInvite({
  to,
  inviterName,
  teamName,
  role,
  token,
}: {
  to: string;
  inviterName: string;
  teamName: string;
  role: string;
  token: string;
}): Promise<void> {
  const inviteUrl = `${env.APP_URL}/invite/${token}`;
  const roleLabel: Record<string, string> = {
    OWNER: "Owner",
    ADMIN: "Admin",
    MEMBER: "Member",
    VIEWER: "Viewer",
  };

  await notificationService.sendEmail({
    to,
    subject: `Du wurdest zu ${teamName} auf marteso eingeladen`,
    title: "Du wurdest eingeladen",
    body: `<strong style="color:#1a1a2e;">${inviterName}</strong> hat dich eingeladen, dem Team <strong style="color:#1a1a2e;">${teamName}</strong> als <strong style="color:#D94412;">${roleLabel[role] ?? role}</strong> beizutreten.`,
    cta: { label: "Einladung annehmen", url: inviteUrl },
    footer:
      "Dieser Link läuft in 7 Tagen ab. Falls du diese Einladung nicht erwartet hast, kannst du diese E-Mail ignorieren.",
  });
}

export function keywordRankChange(
  keywordTerm: string,
  oldRank: number | null,
  newRank: number | null,
  country: string,
) {
  const rankText = newRank ? `now #${newRank}` : "no longer ranked";
  const changeText =
    oldRank && newRank ? (newRank < oldRank ? `↑ ${oldRank - newRank}` : `↓ ${newRank - oldRank}`) : "";

  return notificationService.broadcast({
    push: {
      title: "🔑 Keyword Rank Update",
      body: `"${keywordTerm}" (${country.toUpperCase()}): ${rankText} ${changeText}`.trim(),
      category: "KEYWORD_RANK_UPDATE",
      data: {
        keywordTerm,
        country,
        oldRank: String(oldRank ?? ""),
        newRank: String(newRank ?? ""),
      },
    },
  });
}

export function submissionUpdate(appName: string, versionString: string, status: string) {
  const emoji =
    status === "READY_FOR_DISTRIBUTION" ? "✅" : status === "IN_REVIEW" ? "👀" : status === "REJECTED" ? "❌" : "📦";

  return notificationService.broadcast({
    push: {
      title: `${emoji} App Store Update`,
      body: `${appName} v${versionString}: ${status.replace(/_/g, " ").toLowerCase()}`,
      category: "SUBMISSION_UPDATE",
      data: { appName, versionString, status },
    },
  });
}

export function jobComplete(jobType: string, status: string, itemsCount?: number) {
  const emoji = status === "COMPLETED" ? "✅" : "❌";
  const itemsText = itemsCount ? ` (${itemsCount} items)` : "";

  return notificationService.broadcast({
    push: {
      title: `${emoji} Job ${status.toLowerCase()}`,
      body: `${jobType.replace(/-/g, " ")}${itemsText}`,
      category: "JOB_COMPLETE",
      data: { jobType, status, itemsCount: String(itemsCount ?? 0) },
    },
  });
}
