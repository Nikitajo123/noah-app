import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../auth";

export const usersRouter = Router();
usersRouter.use(requireAuth, requireRole("VODJA"));

usersRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  res.json(users);
});

const userSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100),
  role: z.enum(["DELAVEC", "VODJA"]),
});

const passwordSchema = z.object({ password: z.string().min(8).max(100) });

usersRouter.patch("/:id/password", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: "Uporabnika ni" });
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Geslo mora imeti vsaj 8 znakov" });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.password, 10) },
  });
  res.json({ ok: true });
});

usersRouter.post("/", async (req, res) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Vnesi ime, veljaven email in geslo (vsaj 8 znakov)" });
  }
  const { password, ...data } = parsed.data;
  try {
    const user = await prisma.user.create({
      data: { ...data, passwordHash: await bcrypt.hash(password, 10) },
      select: { id: true, name: true, email: true, role: true },
    });
    res.status(201).json(user);
  } catch {
    res.status(409).json({ error: "Ta email že obstaja" });
  }
});