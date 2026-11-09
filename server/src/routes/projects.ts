import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import {
  assignedProjectIds,
  canEditProjects,
  canManageProject,
  isAdmin,
  requireAdmin,
  requireManager,
} from "../permissions";

// Gradbišča (model Project).
export const projectsRouter = Router();
projectsRouter.use(requireAuth, requireManager);

const person = { select: { id: true, name: true, role: true } } as const;

projectsRouter.get("/", async (req, res) => {
  const ids = await assignedProjectIds(req.user!);
  const projects = await prisma.project.findMany({
    where: ids === null ? {} : { id: { in: ids } },
    include: {
      _count: { select: { workOrders: true } },
      assignments: { include: { user: person } },
    },
    orderBy: { name: "asc" },
  });
  res.json(
    projects.map(({ assignments, ...p }) => ({
      ...p,
      managers: assignments.map((a) => a.user),
    }))
  );
});

projectsRouter.get("/:id", async (req, res) => {
  const id = req.params.id as string;
  if (!(await canManageProject(req.user!, id))) return res.status(404).json({ error: "Gradbišča ni" });
  const p = await prisma.project.findUnique({
    where: { id },
    include: { assignments: { include: { user: person } } },
  });
  if (!p) return res.status(404).json({ error: "Gradbišča ni" });
  const { assignments, ...rest } = p;
  res.json({ ...rest, managers: assignments.map((a) => a.user) });
});

const projectSchema = z.object({
  name: z.string().trim().min(1),
  location: z.string().trim().min(1),
});

projectsRouter.post("/", async (req, res) => {
  if (!canEditProjects(req.user!)) return res.status(403).json({ error: "Ni dovoljenja" });
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Vnesi ime in lokacijo" });
  const project = await prisma.project.create({
    data: {
      ...parsed.data,
      // A Vodja gradbišč automatically belongs to the gradbišče he creates.
      ...(isAdmin(req.user!) ? {} : { assignments: { create: [{ userId: req.user!.id }] } }),
    },
  });
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

const managersSchema = z.object({
  role: z.enum(["VODJA_GRADBISC", "VODJA_DEL"]),
  userIds: z.array(z.string().uuid()),
});

// Replaces the list of Vodje del (or Vodje gradbišč) on a gradbišče.
projectsRouter.put("/:id/managers", async (req, res) => {
  const id = req.params.id as string;
  const parsed = managersSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Napačni podatki" });
  const { role, userIds } = parsed.data;
  const user = req.user!;

  const allowed =
    isAdmin(user) ||
    (user.role === "VODJA_GRADBISC" && role === "VODJA_DEL" && (await canManageProject(user, id)));
  if (!allowed) return res.status(403).json({ error: "Ni dovoljenja" });

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return res.status(404).json({ error: "Gradbišča ni" });

  const wanted = [...new Set(userIds)];
  const valid = await prisma.user.count({ where: { id: { in: wanted }, role } });
  if (valid !== wanted.length) return res.status(400).json({ error: "Neveljaven uporabnik" });

  await prisma.$transaction([
    prisma.projectAssignment.deleteMany({
      where: { projectId: id, user: { role }, userId: { notIn: wanted } },
    }),
    prisma.projectAssignment.createMany({
      data: wanted.map((userId) => ({ projectId: id, userId })),
      skipDuplicates: true,
    }),
  ]);
  res.json({ ok: true });
});

// Lists for assignments: id and name only.
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

workersRouter.get("/managers", async (_req, res) => {
  const managers = await prisma.user.findMany({
    where: { role: { in: ["VODJA_GRADBISC", "VODJA_DEL"] } },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
  res.json(managers);
});
