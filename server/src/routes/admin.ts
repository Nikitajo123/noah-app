import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { requireAdmin } from "../permissions";

export const usersRouter = Router();
usersRouter.use(requireAuth, requireAdmin);

const roleEnum = z.enum(["DELAVEC", "VODJA", "VODJA_GRADBISC", "VODJA_DEL"]);

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
  role: roleEnum,
});

const passwordSchema = z.object({ password: z.string().min(8).max(100) });

usersRouter.patch("/:id/password", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id as string } });
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

usersRouter.patch("/:id/role", async (req, res) => {
  const id = req.params.id as string;
  const parsed = z.object({ role: roleEnum }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Napačna vloga" });
  if (id === req.user!.id) {
    return res.status(400).json({ error: "Svoje vloge ne moreš spremeniti" });
  }
  const user = await prisma.user.findUnique({
    where: { id },
    include: { foremanOf: { select: { id: true } } },
  });
  if (!user) return res.status(404).json({ error: "Uporabnika ni" });
  const role = parsed.data.role;
  if (role === user.role) return res.json({ id, role });

  if (user.role === "DELAVEC") {
    const [orders, running] = await Promise.all([
      prisma.workOrderWorker.count({ where: { userId: id, workOrder: { status: { not: "ZAKLJUCEN" } } } }),
      prisma.timeEntry.count({ where: { userId: id, endedAt: null } }),
    ]);
    if (orders > 0 || running > 0 || user.foremanOf.length > 0) {
      return res.status(400).json({
        error: "Delavec ima odprte naloge ali vodi ekipo. Najprej ga odstrani z nalogov in ekip.",
      });
    }
  }

  await prisma.$transaction([
    // Assignments to gradbišča only make sense for the two vodja roles.
    ...(role === "VODJA_GRADBISC" || role === "VODJA_DEL"
      ? []
      : [prisma.projectAssignment.deleteMany({ where: { userId: id } })]),
    ...(role === "DELAVEC" ? [] : [prisma.user.update({ where: { id }, data: { teamId: null } })]),
    prisma.user.update({ where: { id }, data: { role } }),
  ]);
  res.json({ id, role });
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
