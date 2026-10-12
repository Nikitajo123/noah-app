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
  password: z.string().min(6),
  role: z.enum(["DELAVEC", "VODJA"]),
});

usersRouter.post("/", async (req, res) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Vnesi ime, veljaven email in geslo (vsaj 6 znakov)" });
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