import { Resend } from "resend";
import { env } from "../config";
import { logger } from "../config";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendTeamInviteEmail({
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
}) {
  const inviteUrl = `${env.APP_URL}/app/#/invite/${token}`;
  const roleLabel: Record<string, string> = {
    OWNER: "Owner",
    ADMIN: "Admin",
    MEMBER: "Member",
    VIEWER: "Viewer",
  };

  if (!resend) {
    logger.warn(`[email] RESEND_API_KEY not set — invite link: ${inviteUrl}`);
    return;
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8f9fb; margin: 0; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; border: 1px solid #e5e7eb;">
    <div style="font-size: 24px; font-weight: 800; color: #ea0e2b; margin-bottom: 24px; letter-spacing: -0.3px;">marteso</div>
    <h1 style="font-size: 20px; font-weight: 700; color: #1a1a2e; margin: 0 0 8px;">Du wurdest eingeladen</h1>
    <p style="color: #6b7280; font-size: 15px; line-height: 1.5; margin: 0 0 24px;">
      <strong style="color: #1a1a2e;">${inviterName}</strong> hat dich eingeladen, dem Team <strong style="color: #1a1a2e;">${teamName}</strong> als <strong style="color: #ea0e2b;">${roleLabel[role] ?? role}</strong> beizutreten.
    </p>
    <a href="${inviteUrl}" style="display: inline-block; background: #ea0e2b; color: white; text-decoration: none; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 12px;">
      Einladung annehmen
    </a>
    <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; line-height: 1.5;">
      Dieser Link läuft in 7 Tagen ab. Falls du diese Einladung nicht erwartet hast, kannst du diese E-Mail ignorieren.
    </p>
  </div>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject: `Du wurdest zu ${teamName} auf marteso eingeladen`,
      html,
    });
  } catch (err) {
    logger.error("[email] Failed to send invite email", err);
    throw err;
  }
}
