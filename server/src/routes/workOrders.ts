import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../auth";

export const workOrdersRouter = Router();
workOrdersRouter.use(requireAuth);

const listInclude = {
  project: true,
  worker: { select: { id: true, name: true } },
  materials: { orderBy: { name: "asc" as const } },
};

const listQuery = z.object({
  status: z.enum(["open", "NOV", "V_DELU", "ZAKLJUCEN", "PROBLEM"]).optional(),
  projectId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

workOrdersRouter.get("/", async (req, res) => {
  const q = listQuery.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Napačen filter" });
  const { status, projectId, date } = q.data;

  const where: any = {};
  if (req.user!.role === "DELAVEC") where.workerId = req.user!.id;
  if (status === "open") where.status = { not: "ZAKLJUCEN" };
  else if (status) where.status = status;
  if (projectId) where.projectId = projectId;
  if (date) {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    where.dueDate = { gte: start, lt: end };
  }

  const orders = await prisma.workOrder.findMany({
    where,
    include: listInclude,
    orderBy: { dueDate: "asc" },
  });
  res.json(orders);
});

workOrdersRouter.get("/:id", async (req, res) => {
  const order = await prisma.workOrder.findUnique({
    where: { id: req.params.id as string },
    include: {
      ...listInclude,
      manager: { select: { id: true, name: true } },
      timeEntries: true,
      workLogs: true,
      photos: true,
    },
  });
  if (!order) return res.status(404).json({ error: "Naloga ni" });
  if (req.user!.role === "DELAVEC" && order.workerId !== req.user!.id) {
    return res.status(403).json({ error: "Ni dovoljenja" });
  }
  res.json(order);
});

const createSchema = z.object({
  number: z.string().min(1),
  projectId: z.string().uuid(),
  workerId: z.string().uuid(),
  description: z.string().min(1),
  plannedQty: z.number().optional(),
  plannedUnit: z.string().optional(),
  plannedHours: z.number().optional(),
  dueDate: z.coerce.date(),
  materials: z.array(z.string()).default([]),
});

workOrdersRouter.post("/", requireRole("VODJA"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Napačni podatki", details: parsed.error.issues });
  }
  const { materials, ...data } = parsed.data;
  try {
    const order = await prisma.workOrder.create({
      data: {
        ...data,
        managerId: req.user!.id,
        materials: { create: materials.map((name) => ({ name })) },
      },
      include: listInclude,
    });
    res.status(201).json(order);
  } catch {
    res.status(409).json({ error: "Številka naloga že obstaja ali podatki niso veljavni" });
  }
});

const transitions: Record<string, string[]> = {
  NOV: ["V_DELU"],
  V_DELU: ["ZAKLJUCEN", "PROBLEM"],
  PROBLEM: ["V_DELU", "ZAKLJUCEN"],
  ZAKLJUCEN: [],
};

const statusSchema = z.object({
  status: z.enum(["V_DELU", "ZAKLJUCEN", "PROBLEM"]),
});

workOrdersRouter.patch("/:id/status", requireRole("DELAVEC"), async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Napačen status" });

  const id = req.params.id as string;
  const order = await prisma.workOrder.findUnique({ where: { id } });
  if (!order || order.workerId !== req.user!.id) {
    return res.status(404).json({ error: "Naloga ni" });
  }
  if (!transitions[order.status].includes(parsed.data.status)) {
    return res.status(400).json({ error: "Ta prehod ni dovoljen" });
  }

  if (parsed.data.status === "ZAKLJUCEN") {
    const running = await prisma.timeEntry.findFirst({
      where: { workOrderId: id, endedAt: null },
    });
    if (running) {
      return res.status(400).json({ error: "Najprej končaj delo" });
    }
  }
  const updated = await prisma.workOrder.update({
    where: { id },
    data: { status: parsed.data.status },
  });
  res.json(updated);
});