import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../../config";
import { signToken, requireAuth } from "../auth";
export const authRouter = Router();

// ─── POST /api/auth/register ─────────────────────────────────────────────────
authRouter.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body as {
      email?: string;
      password?: string;
      name?: string;
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
    const role = "USER";

    const user = await prisma.user.create({
      data: { email, name: name ?? email.split("@")[0], passwordHash, role },
    });

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
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
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
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
      },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── GET /api/auth/users ─────────────────────────────────────────────────────
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

// ─── DELETE /api/auth/users/:id ──────────────────────────────────────────────
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
