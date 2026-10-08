import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../auth";

export const logsRouter = Router();
logsRouter.use(requireAuth, requireRole("DELAVEC"));

const logSchema = z.object({
  id: z.string().uuid().optional(),
  workOrderId: z.string().uuid(),
  description: z.string().min(1),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  note: z.string().optional(),
});

logsRouter.post("/", async (req, res) => {
  const parsed = logSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Napačni podatki" });
  const { id, workOrderId, ...data } = parsed.data;
  const userId = req.user!.id;

  if (id) {
    const existing = await prisma.workLog.findUnique({ where: { id } });
    if (existing && existing.userId === userId) return res.json(existing);
  }

  const order = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
  if (!order || order.workerId !== userId) {
    return res.status(404).json({ error: "Naloga ni" });
  }
  if (order.status !== "V_DELU" && order.status !== "PROBLEM") {
    return res.status(400).json({ error: "Naloga ni v delu" });
  }

  const log = await prisma.workLog.create({
    data: { ...(id ? { id } : {}), ...data, workOrderId, userId },
  });
  res.status(201).json(log);
});

export const materialsRouter = Router();
materialsRouter.use(requireAuth, requireRole("DELAVEC"));

materialsRouter.patch("/:id", async (req, res) => {
  const parsed = z.object({ usedQty: z.number().min(0) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Napačni podatki" });
  const id = req.params.id as string;
  const material = await prisma.material.findUnique({
    where: { id },
    include: { workOrder: true },
  });
  if (!material || material.workOrder.workerId !== req.user!.id) {
    return res.status(404).json({ error: "Materiala ni" });
  }
  const updated = await prisma.material.update({
    where: { id },
    data: { usedQty: parsed.data.usedQty },
  });
  res.json(updated);
});