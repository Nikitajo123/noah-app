import { Router } from "express";
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

export const workersRouter = Router();

workersRouter.get("/", requireAuth, requireRole("VODJA"), async (_req, res) => {
  const workers = await prisma.user.findMany({
    where: { role: "DELAVEC" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  res.json(workers);
});