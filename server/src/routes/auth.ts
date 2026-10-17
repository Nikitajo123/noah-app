import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../auth";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const failed = new Map<string, { count: number; until: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, f] of failed) if (f.until <= now) failed.delete(key);
}, LOCK_MS).unref();

function lockedMessage(until: number) {
  const mins = Math.ceil((until - Date.now()) / 60000);
  return `Preveč napačnih poskusov. Poskusi znova čez ${mins} min.`;
}

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Napačni podatki" });
  }
  const key = `${req.ip}|${parsed.data.email.toLowerCase()}`;
  const prev = failed.get(key);
  if (prev && prev.until > Date.now() && prev.count >= MAX_ATTEMPTS) {
    return res.status(429).json({ error: lockedMessage(prev.until) });
  }
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    const count = prev && prev.until > Date.now() ? prev.count + 1 : 1;
    const until = Date.now() + LOCK_MS;
    failed.set(key, { count, until });
    if (count >= MAX_ATTEMPTS) {
      return res.status(429).json({ error: lockedMessage(until) });
    }
    return res.status(401).json({ error: "Napačen email ali geslo" });
  }
  failed.delete(key);
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, {
    expiresIn: "7d",
  });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

authRouter.post("/change-password", requireAuth, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Novo geslo mora imeti vsaj 8 znakov" });
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user || !(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    return res.status(400).json({ error: "Trenutno geslo ni pravilno" });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 10) },
  });
  res.json({ ok: true });
});

authRouter.get("/me",requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) return res.status(404).json({ error: "Ni uporabnika" });
  res.json(user);
});