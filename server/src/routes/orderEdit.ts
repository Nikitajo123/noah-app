import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { canEditProjects, canManageProject, requireManager, scopedOrder } from "../permissions";
import { listInclude, person, shape } from "./workOrders";

// Manager edits of a work order: Uredi nalog, change workers, close and reopen. Every change
// is stored in WorkOrderEdit. Allowed in any status, including ZAKLJUCEN.
export const orderEditRouter = Router();

type Change = { field: string; old: string | null; new: string | null };

const dateText = (d: Date) => d.toLocaleDateString("sv-SE");
const numText = (n: number | null | undefined) => (n == null ? null : String(n));

async function logEdit(tx: Prisma.TransactionClient, workOrderId: string, editedById: string, changes: Change[]) {
  if (changes.length === 0) return;
  await tx.workOrderEdit.create({ data: { workOrderId, editedById, changes } });
}

// Validates a new worker list. Returns the ids to add and remove, or an error message.
async function planWorkers(workOrderId: string, current: string[], workerIds: string[]) {
  const wanted = [...new Set(workerIds)];
  const valid = await prisma.user.count({ where: { id: { in: wanted }, role: "DELAVEC" } });
  if (valid !== wanted.length) return { error: "Neveljaven delavec" } as const;
  const removed = current.filter((u) => !wanted.includes(u));
  const added = wanted.filter((u) => !current.includes(u));
  if (removed.length > 0) {
    const used = await prisma.timeEntry.findFirst({
      where: { workOrderId, userId: { in: removed } },
      include: { user: person },
    });
    if (used) {
      return {
        error: `${used.user.name} ima na tem nalogu evidentirane ure, zato ga ni mogoče odstraniti.`,
      } as const;
    }
  }
  return { added, removed } as const;
}

async function workerNames(ids: string[]) {
  if (ids.length === 0) return "";
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { name: true }, orderBy: { name: "asc" } });
  return users.map((u) => u.name).join(", ");
}

const editSchema = z.object({
  description: z.string().trim().min(1).max(5000).optional(),
  projectId: z.string().uuid().optional(),
  plannedQty: z.number().min(0).nullable().optional(),
  plannedUnit: z.string().trim().max(20).nullable().optional(),
  plannedHours: z.number().min(0).nullable().optional(),
  workDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  materials: z
    .array(z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(200) }))
    .optional(),
  workerIds: z.array(z.string().uuid()).min(1).optional(),
  // Only Admin and Vodja gradbišč may set the status directly.
  status: z.enum(["NOV", "V_DELU", "ZAKLJUCEN", "PROBLEM"]).optional(),
});

orderEditRouter.patch("/:id", requireAuth, requireManager, async (req, res) => {
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Napačni podatki" });
  const data = parsed.data;
  const id = req.params.id as string;

  const order = await prisma.workOrder.findUnique({
    where: { id },
    include: { project: true, materials: true, workers: true },
  });
  if (!order || !(await canManageProject(req.user!, order.projectId))) {
    return res.status(404).json({ error: "Naloga ni" });
  }

  const changes: Change[] = [];
  const update: Prisma.WorkOrderUncheckedUpdateInput = {};

  if (data.description !== undefined && data.description !== order.description) {
    changes.push({ field: "description", old: order.description, new: data.description });
    update.description = data.description;
  }
  if (data.projectId !== undefined && data.projectId !== order.projectId) {
    if (!(await canManageProject(req.user!, data.projectId))) {
      return res.status(403).json({ error: "Ni dovoljenja za to gradbišče" });
    }
    const target = await prisma.project.findUnique({ where: { id: data.projectId } });
    if (!target) return res.status(400).json({ error: "Gradbišča ni" });
    changes.push({ field: "project", old: order.project.name, new: target.name });
    update.projectId = data.projectId;
  }
  for (const key of ["plannedQty", "plannedHours"] as const) {
    if (data[key] !== undefined && data[key] !== order[key]) {
      changes.push({ field: key, old: numText(order[key]), new: numText(data[key]) });
      update[key] = data[key];
    }
  }
  if (data.plannedUnit !== undefined && (data.plannedUnit || null) !== order.plannedUnit) {
    changes.push({ field: "plannedUnit", old: order.plannedUnit, new: data.plannedUnit || null });
    update.plannedUnit = data.plannedUnit || null;
  }
  for (const key of ["workDate", "dueDate"] as const) {
    const v = data[key];
    if (v !== undefined && dateText(v) !== dateText(order[key])) {
      changes.push({ field: key, old: dateText(order[key]), new: dateText(v) });
      update[key] = v;
    }
  }

  if (data.status !== undefined && data.status !== order.status) {
    if (!canEditProjects(req.user!)) {
      return res.status(403).json({ error: "Ni dovoljenja za spremembo statusa" });
    }
    if (data.status === "ZAKLJUCEN") {
      const running = await prisma.timeEntry.findFirst({
        where: { workOrderId: id, endedAt: null },
        include: { user: person },
      });
      if (running) {
        return res.status(400).json({ error: `${running.user.name} še dela na tem nalogu. Najprej naj konča delo.` });
      }
    }
    changes.push({ field: "status", old: order.status, new: data.status });
    update.status = data.status;
  }

  // Materials: entries with id are kept (and maybe renamed), without id are new, missing ones are removed.
  const materialOps: ((tx: Prisma.TransactionClient) => Promise<unknown>)[] = [];
  if (data.materials) {
    const byId = new Map(order.materials.map((m) => [m.id, m]));
    const keep = new Set<string>();
    for (const m of data.materials) {
      if (m.id) {
        const old = byId.get(m.id);
        if (!old) return res.status(400).json({ error: "Neznan material" });
        keep.add(m.id);
        if (old.name !== m.name) {
          changes.push({ field: "material", old: old.name, new: m.name });
          materialOps.push((tx) => tx.material.update({ where: { id: m.id }, data: { name: m.name } }));
        }
      } else {
        changes.push({ field: "material", old: null, new: m.name });
        materialOps.push((tx) => tx.material.create({ data: { workOrderId: id, name: m.name } }));
      }
    }
    for (const old of order.materials) {
      if (keep.has(old.id)) continue;
      if (old.usedQty != null) {
        return res.status(400).json({
          error: `Material "${old.name}" ima vneseno porabo, zato ga ni mogoče odstraniti.`,
        });
      }
      changes.push({ field: "material", old: old.name, new: null });
      materialOps.push((tx) => tx.material.delete({ where: { id: old.id } }));
    }
  }

  let workerPlan: { added: string[]; removed: string[] } | null = null;
  if (data.workerIds) {
    const current = order.workers.map((w) => w.userId);
    const plan = await planWorkers(id, current, data.workerIds);
    if ("error" in plan) return res.status(400).json({ error: plan.error });
    if (plan.added.length || plan.removed.length) {
      workerPlan = plan;
      const next = [...current.filter((u) => !plan.removed.includes(u)), ...plan.added];
      changes.push({ field: "workers", old: await workerNames(current), new: await workerNames(next) });
    }
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(update).length > 0) await tx.workOrder.update({ where: { id }, data: update });
    for (const op of materialOps) await op(tx);
    if (workerPlan) {
      await tx.workOrderWorker.deleteMany({ where: { workOrderId: id, userId: { in: workerPlan.removed } } });
      await tx.workOrderWorker.createMany({
        data: workerPlan.added.map((userId) => ({ workOrderId: id, userId })),
      });
    }
    await logEdit(tx, id, req.user!.id, changes);
  });

  const updated = await prisma.workOrder.findUnique({ where: { id }, include: listInclude });
  res.json({ ...shape(updated!), changes });
});

// The existing "Spremeni delavce" action, now logged and allowed in any status.
orderEditRouter.put("/:id/workers", requireAuth, requireManager, async (req, res) => {
  const parsed = z.object({ workerIds: z.array(z.string().uuid()).min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Izberi vsaj enega delavca" });
  const id = req.params.id as string;
  const order = await prisma.workOrder.findUnique({ where: { id }, include: { workers: true } });
  if (!order || !(await canManageProject(req.user!, order.projectId))) {
    return res.status(404).json({ error: "Naloga ni" });
  }
  const current = order.workers.map((w) => w.userId);
  const plan = await planWorkers(id, current, parsed.data.workerIds);
  if ("error" in plan) return res.status(400).json({ error: plan.error });
  if (plan.added.length || plan.removed.length) {
    const next = [...current.filter((u) => !plan.removed.includes(u)), ...plan.added];
    const change: Change = { field: "workers", old: await workerNames(current), new: await workerNames(next) };
    await prisma.$transaction(async (tx) => {
      await tx.workOrderWorker.deleteMany({ where: { workOrderId: id, userId: { in: plan.removed } } });
      await tx.workOrderWorker.createMany({ data: plan.added.map((userId) => ({ workOrderId: id, userId })) });
      await logEdit(tx, id, req.user!.id, [change]);
    });
  }
  const updated = await prisma.workOrder.findUnique({ where: { id }, include: listInclude });
  res.json(shape(updated!));
});

// Manager closes an order, e.g. when an absent worker would keep it open.
orderEditRouter.post("/:id/close", requireAuth, requireManager, async (req, res) => {
  const id = req.params.id as string;
  const order = await scopedOrder(req.user!, id);
  if (!order) return res.status(404).json({ error: "Naloga ni" });
  if (order.status === "ZAKLJUCEN") return res.status(400).json({ error: "Nalog je že zaključen" });
  const running = await prisma.timeEntry.findFirst({
    where: { workOrderId: id, endedAt: null },
    include: { user: person },
  });
  if (running) {
    return res.status(400).json({ error: `${running.user.name} še dela na tem nalogu. Najprej naj konča delo.` });
  }
  await prisma.$transaction(async (tx) => {
    await tx.workOrder.update({ where: { id }, data: { status: "ZAKLJUCEN" } });
    await logEdit(tx, id, req.user!.id, [{ field: "status", old: order.status, new: "ZAKLJUCEN" }]);
  });
  res.json({ ok: true });
});

orderEditRouter.post("/:id/reopen", requireAuth, requireManager, async (req, res) => {
  const id = req.params.id as string;
  const order = await scopedOrder(req.user!, id);
  if (!order) return res.status(404).json({ error: "Naloga ni" });
  if (order.status !== "ZAKLJUCEN") return res.status(400).json({ error: "Nalog ni zaključen" });
  await prisma.$transaction(async (tx) => {
    await tx.workOrder.update({ where: { id }, data: { status: "V_DELU" } });
    await logEdit(tx, id, req.user!.id, [{ field: "status", old: "ZAKLJUCEN", new: "V_DELU" }]);
  });
  res.json({ ok: true });
});
