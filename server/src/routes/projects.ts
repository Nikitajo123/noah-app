import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../auth";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.get("/", async (_req, res) => {
  const projects = await prisma.project.findMany({
    include: { _count: { select: { workOrders: true } } },
    orderBy: { name: "asc" },
  });
  res.json(projects);
});

const projectSchema = z.object({
  name: z.string().trim().min(1),
  location: z.string().trim().min(1),
});

projectsRouter.post("/", requireRole("VODJA"), async (req, res) => {
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Vnesi ime in lokacijo" });
  const project = await prisma.project.create({ data: parsed.data });
  res.status(201).json(project);
});

export const workersRouter = Router();

workersRouter.get("/", requireAuth, requireRole("VODJA"), async (_req, res) => {
  const workers = await prisma.user.findMany({
    where: { role: "DELAVEC" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  res.json(workers);
});