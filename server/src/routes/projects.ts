import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import {
  assignedProjectIds,
  canEditProjects,
  canManageProject,
  requireAdmin,
  requireManager,
} from "../permissions";

// Gradbišča (model Project).
export const projectsRouter = Router();
projectsRouter.use(requireAuth, requireManager);

projectsRouter.get("/", async (req, res) => {
  const ids = await assignedProjectIds(req.user!);
  const projects = await prisma.project.findMany({
    where: ids === null ? {} : { id: { in: ids } },
    include: { _count: { select: { workOrders: true } } },
    orderBy: { name: "asc" },
  });
  res.json(projects);
});

projectsRouter.get("/:id", async (req, res) => {
  const id = req.params.id as string;
  if (!(await canManageProject(req.user!, id))) return res.status(404).json({ error: "Gradbišča ni" });
  const p = await prisma.project.findUnique({ where: { id } });
  if (!p) return res.status(404).json({ error: "Gradbišča ni" });
  res.json(p);
});

const projectSchema = z.object({
  name: z.string().trim().min(1),
  location: z.string().trim().min(1),
});

projectsRouter.post("/", async (req, res) => {
  if (!canEditProjects(req.user!)) return res.status(403).json({ error: "Ni dovoljenja" });
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Vnesi ime in lokacijo" });
  const project = await prisma.project.create({ data: parsed.data });
  res.status(201).json(project);
});

projectsRouter.patch("/:id", async (req, res) => {
  const id = req.params.id as string;
  if (!canEditProjects(req.user!) || !(await canManageProject(req.user!, id))) {
    return res.status(403).json({ error: "Ni dovoljenja" });
  }
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Vnesi ime in lokacijo" });
  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Gradbišča ni" });
  const project = await prisma.project.update({ where: { id }, data: parsed.data });
  res.json(project);
});

projectsRouter.delete("/:id", requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const existing = await prisma.project.findUnique({
    where: { id },
    include: { _count: { select: { workOrders: true } } },
  });
  if (!existing) return res.status(404).json({ error: "Gradbišča ni" });
  if (existing._count.workOrders > 0) {
    return res.status(409).json({ error: "Gradbišča z nalogi ni mogoče izbrisati" });
  }
  await prisma.project.delete({ where: { id } });
  res.json({ ok: true });
});

// Worker list for assigning nalogi: id and name only.
export const workersRouter = Router();
workersRouter.use(requireAuth, requireManager);

workersRouter.get("/", async (_req, res) => {
  const workers = await prisma.user.findMany({
    where: { role: "DELAVEC" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  res.json(workers);
});
