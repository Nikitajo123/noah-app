import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../auth";
import { isAssigned } from "../access";

export const timeRouter = Router();
timeRouter.use(requireAuth, requireRole("DELAVEC"));

const startSchema = z.object({
  id: z.string().uuid().optional(),
  workOrderId: z.string().uuid(),
  at: z.coerce.date().optional(),
});

function hoursBetween(start: Date, end: Date) {
  return Math.round(((end.getTime() - start.getTime()) / 3600000) * 100) / 100;
}

timeRouter.post("/start", async (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Napačni podatki" });
  const { id, workOrderId, at } = parsed.data;
  const userId = req.user!.id;

  if (id) {
    const existing = await prisma.timeEntry.findUnique({ where: { id } });
    if (existing && existing.userId === userId) return res.json(existing);
  }

  const order = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
  if (!order || !(await isAssigned(workOrderId, userId))) {
    return res.status(404).json({ error: "Naloga ni" });
  }
    if (order.status !== "V_DELU" && order.status !== "PROBLEM") {
    return res.status(400).json({ error: "Najprej začni delovni nalog" });
  }
  const open = await prisma.timeEntry.findFirst({ where: { userId, endedAt: null } });
  if (open) return res.status(409).json({ error: "Delo že poteka" });

  try {
    const entry = await prisma.timeEntry.create({
      data: { ...(id ? { id } : {}), userId, workOrderId, startedAt: at ?? new Date() },
    });
    res.status(201).json(entry);
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return res.status(409).json({ error: "Delo že poteka" });
    }
    throw e;
  }
});

const endSchema = z.object({ at: z.coerce.date().optional() });

timeRouter.post("/end", async (req, res) => {
  const parsed = endSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Napačni podatki" });
  const open = await prisma.timeEntry.findFirst({
    where: { userId: req.user!.id, endedAt: null },
  });
  if (!open) return res.status(400).json({ error: "Ni odprtega dela" });

  const endedAt = parsed.data.at ?? new Date();
  const updated = await prisma.timeEntry.update({
    where: { id: open.id },
    data: { endedAt },
  });
  res.json({ ...updated, hours: hoursBetween(updated.startedAt, endedAt) });
});

timeRouter.get("/active", async (req, res) => {
  const entry = await prisma.timeEntry.findFirst({
    where: { userId: req.user!.id, endedAt: null },
    include: { workOrder: { select: { id: true, number: true, project: true } } },
  });
  res.json(entry);
});