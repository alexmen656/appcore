import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { prisma, env } from "../../config";
import { signToken, requireAuth } from "../auth";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later" },
});

authRouter.use(authLimiter);

const RP_ID = env.WEBAUTHN_RP_ID;
const RP_NAME = env.WEBAUTHN_RP_NAME;
const ORIGIN = env.WEBAUTHN_ORIGIN;

const challengeStore = new Map<
  string,
  { challenge: string; expires: number }
>();
setInterval(
  () => {
    const now = Date.now();
    for (const [key, val] of challengeStore) {
      if (val.expires < now) challengeStore.delete(key);
    }
  },
  5 * 60 * 1000,
);

authRouter.post("/register", async (req, res) => {
  try {
    const { email, password, name, inviteToken } = req.body as {
      email?: string;
      password?: string;
      name?: string;
      inviteToken?: string;
    };

    if (!email || !password) {
      res.status(400).json({ error: "email and password required" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const displayName = name ?? email.split("@")[0];

    let invite = inviteToken
      ? await prisma.teamInvite.findUnique({ where: { token: inviteToken } })
      : null;

    if (invite && (invite.acceptedAt || invite.expiresAt < new Date())) {
      invite = null;
    }

    if (invite && invite.email.toLowerCase() !== email.toLowerCase()) {
      res
        .status(403)
        .json({ error: "This invite is for a different email address" });
      return;
    }

    const user = await prisma.user.create({
      data: { email, name: displayName, passwordHash, role: "USER" },
    });

    let teamId: string | null = null;

    if (invite) {
      await prisma.teamMember.create({
        data: { teamId: invite.teamId, userId: user.id, role: invite.role },
      });
      await prisma.teamInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
      teamId = invite.teamId;
    } else {
      const team = await prisma.team.create({
        data: {
          name: `${displayName}'s Team`,
          members: { create: { userId: user.id, role: "OWNER" } },
        },
      });
      teamId = team.id;
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      teamId,
    });
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        teamId,
      },
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      res.status(400).json({ error: "email and password required" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const membership = await prisma.teamMember.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      teamId: membership?.teamId ?? null,
    });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        teamId: membership?.teamId ?? null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

authRouter.post("/accept-invite", requireAuth, async (req, res) => {
  try {
    const { token: inviteToken } = req.body as { token?: string };
    if (!inviteToken) {
      res.status(400).json({ error: "token required" });
      return;
    }

    const invite = await prisma.teamInvite.findUnique({
      where: { token: inviteToken },
    });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      res.status(400).json({ error: "Invalid or expired invite" });
      return;
    }
    if (invite.email !== req.user!.email) {
      res
        .status(403)
        .json({ error: "This invite is for a different email address" });
      return;
    }

    await prisma.teamMember.upsert({
      where: {
        teamId_userId: { teamId: invite.teamId, userId: req.user!.userId },
      },
      create: {
        teamId: invite.teamId,
        userId: req.user!.userId,
        role: invite.role,
      },
      update: { role: invite.role },
    });
    await prisma.teamInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });

    const newToken = signToken({
      userId: req.user!.userId,
      email: req.user!.email,
      role: req.user!.role,
      teamId: invite.teamId,
    });

    res.json({ ok: true, teamId: invite.teamId, token: newToken });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        passkeys: {
          select: { id: true, name: true, createdAt: true, lastUsedAt: true },
        },
        teamMembers: {
          select: { teamId: true, role: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ ...user, teamId: user.teamMembers[0]?.teamId ?? null });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

authRouter.patch("/profile", requireAuth, async (req, res) => {
  try {
    const { name, email } = req.body as { name?: string; email?: string };
    const updates: { name?: string; email?: string } = {};
    if (typeof name === "string") updates.name = name.trim();
    if (typeof email === "string") {
      const trimmed = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        res.status(400).json({ error: "Invalid email address" });
        return;
      }
      const existing = await prisma.user.findFirst({
        where: { email: trimmed, NOT: { id: req.user!.userId } },
      });
      if (existing) {
        res.status(409).json({ error: "Email already in use" });
        return;
      }
      updates.email = trimmed;
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: updates,
      select: { id: true, email: true, name: true, role: true },
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

authRouter.get("/users", requireAuth, async (req, res) => {
  try {
    if (req.user!.role !== "ADMIN") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

authRouter.delete("/users/:id", requireAuth, async (req, res) => {
  try {
    if (req.user!.role !== "ADMIN") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const userId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    if (userId === req.user!.userId) {
      res.status(400).json({ error: "Cannot delete yourself" });
      return;
    }
    await prisma.user.delete({ where: { id: userId } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

authRouter.post("/passkey/register-options", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { passkeys: true },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: Buffer.from(user.id),
      userName: user.email,
      userDisplayName: user.name ?? user.email,
      attestationType: "none",
      excludeCredentials: user.passkeys.map((p) => ({
        id: p.credentialId,
        transports: p.transports as AuthenticatorTransportFuture[],
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    challengeStore.set(`reg:${user.id}`, {
      challenge: options.challenge,
      expires: Date.now() + 5 * 60 * 1000,
    });

    res.json({ options });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

authRouter.post("/passkey/register-verify", requireAuth, async (req, res) => {
  try {
    const { registrationResponse, passkeyName } = req.body as {
      registrationResponse: RegistrationResponseJSON;
      passkeyName?: string;
    };

    const stored = challengeStore.get(`reg:${req.user!.userId}`);
    if (!stored || stored.expires < Date.now()) {
      res
        .status(400)
        .json({ error: "Challenge expired, start registration again" });
      return;
    }

    const verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge: stored.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: "Passkey verification failed" });
      return;
    }

    challengeStore.delete(`reg:${req.user!.userId}`);

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    await prisma.passkeyCredential.create({
      data: {
        userId: req.user!.userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: credential.transports ?? [],
        name: passkeyName ?? null,
      },
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

authRouter.post("/passkey/login-options", async (req, res) => {
  try {
    const { email } = req.body as { email?: string };

    let allowCredentials: { id: string; transports: string[] }[] = [];

    if (email) {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { passkeys: true },
      });
      if (user && user.passkeys.length > 0) {
        allowCredentials = user.passkeys.map((p) => ({
          id: p.credentialId,
          transports: p.transports,
        }));
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: "preferred",
      allowCredentials: allowCredentials.map((c) => ({
        id: c.id,
        transports: c.transports as AuthenticatorTransportFuture[],
      })),
    });

    const sessionId = crypto.randomUUID();
    challengeStore.set(`auth:${sessionId}`, {
      challenge: options.challenge,
      expires: Date.now() + 5 * 60 * 1000,
    });

    res.json({ options, sessionId });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

authRouter.post("/passkey/login-verify", async (req, res) => {
  try {
    const { sessionId, assertionResponse } = req.body as {
      sessionId: string;
      assertionResponse: AuthenticationResponseJSON;
    };

    const stored = challengeStore.get(`auth:${sessionId}`);
    if (!stored || stored.expires < Date.now()) {
      res.status(400).json({ error: "Challenge expired, try again" });
      return;
    }

    const cred = await prisma.passkeyCredential.findUnique({
      where: { credentialId: assertionResponse.id },
      include: { user: true },
    });
    if (!cred) {
      res.status(401).json({ error: "Unknown passkey" });
      return;
    }

    const verification = await verifyAuthenticationResponse({
      response: assertionResponse,
      expectedChallenge: stored.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: cred.credentialId,
        publicKey: new Uint8Array(cred.publicKey),
        counter: Number(cred.counter),
        transports: cred.transports as AuthenticatorTransportFuture[],
      },
    });

    if (!verification.verified) {
      res.status(401).json({ error: "Passkey authentication failed" });
      return;
    }

    challengeStore.delete(`auth:${sessionId}`);

    await prisma.passkeyCredential.update({
      where: { id: cred.id },
      data: {
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      },
    });

    const { user } = cred;
    const membership = await prisma.teamMember.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      teamId: membership?.teamId ?? null,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        teamId: membership?.teamId ?? null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

authRouter.delete("/passkey/:id", requireAuth, async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const cred = await prisma.passkeyCredential.findUnique({
      where: { id: id ?? "" },
    });

    if (!cred || cred.userId !== req.user!.userId) {
      res.status(404).json({ error: "Passkey not found" });
      return;
    }

    await prisma.passkeyCredential.delete({ where: { id: cred.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
