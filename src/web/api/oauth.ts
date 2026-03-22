import { Router, Request, Response } from "express";
import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import express from "express";
import rateLimit from "express-rate-limit";
import { prisma, logger } from "../../config";

export const oauthRouter = Router();

const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

oauthRouter.use("/register", oauthLimiter);
oauthRouter.use("/token", oauthLimiter);
oauthRouter.use("/authorize", oauthLimiter);

oauthRouter.post("/register", async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");

  const {
    client_name,
    redirect_uris,
    grant_types,
    response_types,
    token_endpoint_auth_method,
  } = req.body as {
    client_name?: string;
    redirect_uris?: string[];
    grant_types?: string[];
    response_types?: string[];
    token_endpoint_auth_method?: string;
  };

  if (!Array.isArray(redirect_uris) || redirect_uris.length === 0) {
    res.status(400).json({
      error: "invalid_client_metadata",
      error_description: "redirect_uris is required",
    });
    return;
  }

  for (const uri of redirect_uris) {
    try {
      const u = new URL(uri);
      if (
        u.protocol !== "https:" &&
        u.hostname !== "localhost" &&
        u.hostname !== "127.0.0.1"
      ) {
        res.status(400).json({
          error: "invalid_redirect_uri",
          error_description: `Redirect URI must use https or localhost: ${uri}`,
        });
        return;
      }
    } catch {
      res.status(400).json({
        error: "invalid_redirect_uri",
        error_description: `Invalid URI: ${uri}`,
      });
      return;
    }
  }

  try {
    const { randomBytes } = await import("crypto");
    const clientId = `appcore_${randomBytes(12).toString("hex")}`;
    const clientSecret = randomBytes(24).toString("hex");

    await prisma.oAuthClient.create({
      data: {
        clientId,
        clientSecret,
        name: client_name?.trim() || "Unnamed client",
        userId: null,
        redirectUris: redirect_uris,
      },
    });

    res.status(201).json({
      client_id: clientId,
      client_secret: clientSecret,
      client_name: client_name || "Unnamed client",
      redirect_uris,
      grant_types: grant_types ?? ["authorization_code"],
      response_types: response_types ?? ["code"],
      token_endpoint_auth_method:
        token_endpoint_auth_method ?? "client_secret_post",
    });
  } catch (err) {
    logger.error("DCR error", err);
    res.status(500).json({ error: "server_error" });
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

oauthRouter.get("/authorize", async (req: Request, res: Response) => {
  const {
    client_id,
    redirect_uri,
    response_type,
    state,
    code_challenge,
    code_challenge_method,
    error: qError,
  } = req.query as Record<string, string>;

  if (response_type !== "code") {
    res.status(400).send("Unsupported response_type");
    return;
  }
  if (!client_id) {
    res.status(400).send("Missing client_id");
    return;
  }

  const client = await prisma.oAuthClient.findUnique({
    where: { clientId: client_id },
  });
  if (!client) {
    res.status(400).send("Unknown client_id");
    return;
  }
  if (
    client.redirectUris.length > 0 &&
    redirect_uri &&
    !client.redirectUris.includes(redirect_uri)
  ) {
    res.status(400).send("Invalid redirect_uri");
    return;
  }

  const hiddenFields = [
    ["client_id", client_id],
    ["redirect_uri", redirect_uri || ""],
    ["state", state || ""],
    ["code_challenge", code_challenge || ""],
    ["code_challenge_method", code_challenge_method || ""],
  ]
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`,
    )
    .join("\n      ");

  const errorHtml = qError ? `<p class="error">${escapeHtml(qError)}</p>` : "";

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize – AppCore</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f0f2f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 12px; padding: 36px 32px; width: 100%; max-width: 380px; box-shadow: 0 4px 24px rgba(0,0,0,.1); }
    .logo { text-align: center; margin-bottom: 20px; font-size: 22px; font-weight: 700; color: #111; }
    .logo span { color: #4f46e5; }
    h1 { font-size: 17px; font-weight: 600; color: #111; margin-bottom: 6px; }
    .sub { font-size: 13px; color: #666; margin-bottom: 24px; }
    .client-name { color: #4f46e5; font-weight: 600; }
    label { display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 4px; }
    input[type=email], input[type=password] { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; margin-bottom: 14px; outline: none; transition: border-color .15s; }
    input[type=email]:focus, input[type=password]:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.15); }
    button { width: 100%; padding: 11px; background: #4f46e5; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background .15s; }
    button:hover { background: #4338ca; }
    .error { color: #dc2626; font-size: 13px; margin-bottom: 14px; padding: 10px 12px; background: #fef2f2; border-radius: 6px; border: 1px solid #fecaca; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">App<span>Core</span></div>
    <h1>Authorize <span class="client-name">${escapeHtml(client.name)}</span></h1>
    <p class="sub">Sign in to grant access to your ASO data.</p>
    ${errorHtml}
    <form method="POST" action="/authorize">
      ${hiddenFields}
      <label for="email">Email</label>
      <input type="email" id="email" name="email" required autofocus autocomplete="email">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required autocomplete="current-password">
      <button type="submit">Authorize access</button>
    </form>
  </div>
</body>
</html>`);
});

oauthRouter.post(
  "/authorize",
  express.urlencoded({ extended: false }),
  async (req: Request, res: Response) => {
    const {
      client_id,
      redirect_uri,
      state,
      code_challenge,
      code_challenge_method,
      email,
      password,
    } = req.body as Record<string, string>;

    const formParams = new URLSearchParams({
      client_id: client_id || "",
      redirect_uri: redirect_uri || "",
      state: state || "",
      code_challenge: code_challenge || "",
      code_challenge_method: code_challenge_method || "",
      response_type: "code",
    });

    const redirectToForm = (error: string) => {
      formParams.set("error", error);
      res.redirect(`/oauth/authorize?${formParams}`);
    };

    try {
      const client = await prisma.oAuthClient.findUnique({
        where: { clientId: client_id },
      });
      if (!client) {
        redirectToForm("Invalid client");
        return;
      }

      const user = await prisma.user.findUnique({
        where: { email },
        include: { settings: true },
      });
      if (!user || !user.passwordHash) {
        redirectToForm("Invalid email or password");
        return;
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        redirectToForm("Invalid email or password");
        return;
      }

      if (!user.settings?.mcpEnabled) {
        redirectToForm(
          "MCP access is not enabled. Enable it in AppCore settings first.",
        );
        return;
      }

      const code = randomBytes(32).toString("hex");
      await prisma.oAuthCode.create({
        data: {
          code,
          clientId: client_id,
          userId: user.id,
          redirectUri: redirect_uri || "",
          codeChallenge: code_challenge || null,
          codeChallengeMethod: code_challenge_method || null,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      const target = redirect_uri || client.redirectUris[0];
      const params = new URLSearchParams({ code });
      if (state) params.set("state", state);
      res.redirect(`${target}?${params}`);
    } catch (err) {
      logger.error("OAuth authorize error", err);
      redirectToForm("Internal error, please try again");
    }
  },
);

oauthRouter.post("/token", express.urlencoded({ extended: false }), async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");

  const {
    grant_type,
    code,
    redirect_uri,
    client_id,
    client_secret,
    code_verifier,
  } = req.body as Record<string, string>;

  if (grant_type !== "authorization_code") {
    res.status(400).json({ error: "unsupported_grant_type" });
    return;
  }

  const client = await prisma.oAuthClient.findUnique({
    where: { clientId: client_id },
  });
  if (!client || client.clientSecret !== client_secret) {
    res.status(401).json({ error: "invalid_client" });
    return;
  }

  const authCode = await prisma.oAuthCode.findUnique({ where: { code } });
  if (
    !authCode ||
    authCode.used ||
    authCode.expiresAt < new Date() ||
    authCode.clientId !== client_id
  ) {
    res.status(400).json({ error: "invalid_grant" });
    return;
  }

  if (
    authCode.redirectUri &&
    redirect_uri &&
    authCode.redirectUri !== redirect_uri
  ) {
    res.status(400).json({ error: "invalid_grant" });
    return;
  }

  if (authCode.codeChallenge) {
    if (!code_verifier) {
      res.status(400).json({
        error: "invalid_grant",
        error_description: "code_verifier required",
      });
      return;
    }
    const expected = createHash("sha256")
      .update(code_verifier)
      .digest("base64url");
    if (expected !== authCode.codeChallenge) {
      res.status(400).json({
        error: "invalid_grant",
        error_description: "PKCE verification failed",
      });
      return;
    }
  }

  await prisma.oAuthCode.update({ where: { code }, data: { used: true } });

  const accessToken = randomBytes(32).toString("hex");
  await prisma.oAuthToken.create({
    data: { accessToken, clientId: client_id, userId: authCode.userId },
  });

  res.json({ access_token: accessToken, token_type: "Bearer" });
});
