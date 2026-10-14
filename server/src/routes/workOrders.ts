import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../auth";
import { isAssigned } from "../access";

export const workOrdersRouter = Router();
workOrdersRouter.use(requireAuth);

const person = { select: { id: true, name: true } } as const;

const listInclude = {
  project: true,
  workers: { include: { user: person } },
  materials: { orderBy: { name: "asc" } },
} as const;

type WithWorkers = { workers: { user: { id: string; name: string } }[] };

// The API returns `workers` (list) and `worker` (all names joined, for simple lists).
function shape<T extends WithWorkers>(order: T) {
  const { workers, ...rest } = order;
  const list = workers.map((w) => w.user);
  return {
    ...rest,
    workers: list,
    worker: { id: list[0]?.id ?? "", name: list.map((w) => w.name).join(", ") },
  };
}

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
  if (req.user!.role === "DELAVEC") where.workers = { some: { userId: req.user!.id } };
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
  res.json(orders.map(shape));
});

workOrdersRouter.get("/:id", async (req, res) => {
  const id = req.params.id as string;
  const isWorker = req.user!.role === "DELAVEC";
  const order = await prisma.workOrder.findUnique({
    where: { id },
    include: {
      ...listInclude,
      manager: person,
      timeEntries: {
        where: isWorker ? { userId: req.user!.id } : {},
        orderBy: { startedAt: "asc" },
        include: {
          user: person,
          edits: { orderBy: { createdAt: "asc" }, include: { editedBy: person } },
        },
      },
      workLogs: { orderBy: { createdAt: "asc" }, include: { user: person } },
      photos: { orderBy: { takenAt: "asc" } },
      notes: { orderBy: { createdAt: "asc" }, include: { author: person } },
    },
  });
  if (!order) return res.status(404).json({ error: "Naloga ni" });
  if (isWorker && !order.workers.some((w) => w.user.id === req.user!.id)) {
    return res.status(403).json({ error: "Ni dovoljenja" });
  }
  res.json(shape(order));
});

const createSchema = z.object({
  number: z.string().min(1).optional(),
  projectId: z.string().uuid(),
  workerIds: z.array(z.string().uuid()).min(1),
  description: z.string().min(1),
  plannedQty: z.number().optional(),
  plannedUnit: z.string().optional(),
  plannedHours: z.number().optional(),
  dueDate: z.coerce.date(),
  workDate: z.coerce.date().optional(),
  materials: z.array(z.string()).default([]),
});

async function nextNumber() {
  const year = new Date().getFullYear();
  const last = await prisma.workOrder.findFirst({
    where: { number: { startsWith: `${year}-` } },
    orderBy: { number: "desc" },
  });
  const n = last ? parseInt(last.number.split("-")[1], 10) + 1 : 1;
  return `${year}-${String(n).padStart(5, "0")}`;
}

workOrdersRouter.post("/", requireRole("VODJA"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Napačni podatki", details: parsed.error.issues });
  }
  const { materials, number, workerIds, ...data } = parsed.data;

  const ids = [...new Set(workerIds)];
  const found = await prisma.user.count({ where: { id: { in: ids }, role: "DELAVEC" } });
  if (found !== ids.length) return res.status(400).json({ error: "Izberi delavce" });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const order = await prisma.workOrder.create({
        data: {
          ...data,
          number: number ?? (await nextNumber()),
          managerId: req.user!.id,
          workers: { create: ids.map((userId) => ({ userId })) },
          materials: { create: materials.map((name) => ({ name })) },
        },
        include: listInclude,
      });
      return res.status(201).json(shape(order));
    } catch {
      if (number) break;
    }
  }
  res.status(409).json({ error: "Naloga ni bilo mogoče ustvariti. Preveri podatke." });
});

workOrdersRouter.put("/:id/workers", requireRole("VODJA"), async (req, res) => {
  const parsed = z
    .object({ workerIds: z.array(z.string().uuid()).min(1) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Izberi vsaj enega delavca" });

  const id = req.params.id as string;
  const order = await prisma.workOrder.findUnique({ where: { id }, include: { workers: true } });
  if (!order) return res.status(404).json({ error: "Naloga ni" });
  if (order.status === "ZAKLJUCEN") {
    return res.status(400).json({ error: "Zaključenega naloga ni mogoče spreminjati" });
  }

  const wanted = [...new Set(parsed.data.workerIds)];
  const valid = await prisma.user.count({ where: { id: { in: wanted }, role: "DELAVEC" } });
  if (valid !== wanted.length) return res.status(400).json({ error: "Neveljaven delavec" });

  const current = order.workers.map((w) => w.userId);
  const removed = current.filter((u) => !wanted.includes(u));
  const added = wanted.filter((u) => !current.includes(u));

  if (removed.length > 0) {
    const used = await prisma.timeEntry.count({
      where: { workOrderId: id, userId: { in: removed } },
    });
    if (used > 0) {
      return res
        .status(400)
        .json({ error: "Delavca z evidentiranimi urami ni mogoče odstraniti z naloga" });
    }
  }

  await prisma.$transaction([
    prisma.workOrderWorker.deleteMany({ where: { workOrderId: id, userId: { in: removed } } }),
    prisma.workOrderWorker.createMany({
      data: added.map((userId) => ({ workOrderId: id, userId })),
    }),
  ]);

  const updated = await prisma.workOrder.findUnique({ where: { id }, include: listInclude });
  res.json(shape(updated!));
});

const noteSchema = z.object({ text: z.string().trim().min(1).max(1000) });

workOrdersRouter.post("/:id/notes", requireRole("VODJA"), async (req, res) => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Vnesi besedilo" });
  const id = req.params.id as string;
  const order = await prisma.workOrder.findUnique({ where: { id } });
  if (!order) return res.status(404).json({ error: "Naloga ni" });
  const note = await prisma.orderNote.create({
    data: { workOrderId: id, authorId: req.user!.id, text: parsed.data.text },
  });
  res.status(201).json(note);
});

workOrdersRouter.post("/:id/resolve", requireRole("VODJA"), async (req, res) => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Vnesi, kako je bila težava rešena" });
  const id = req.params.id as string;
  const order = await prisma.workOrder.findUnique({ where: { id } });
  if (!order) return res.status(404).json({ error: "Naloga ni" });
  if (order.status !== "PROBLEM") {
    return res.status(400).json({ error: "Naloga nima prijavljene težave" });
  }
  await prisma.$transaction([
    prisma.orderNote.create({
      data: { workOrderId: id, authorId: req.user!.id, text: parsed.data.text, resolved: true },
    }),
    prisma.workOrder.update({ where: { id }, data: { status: "V_DELU" } }),
  ]);
  res.json({ ok: true });
});

workOrdersRouter.delete("/:id", requireRole("VODJA"), async (req, res) => {
  const id = req.params.id as string;
  const order = await prisma.workOrder.findUnique({ where: { id } });
  if (!order) return res.status(404).json({ error: "Naloga ni" });
  await prisma.$transaction([
    prisma.material.deleteMany({ where: { workOrderId: id } }),
    prisma.timeEntry.deleteMany({ where: { workOrderId: id } }),
    prisma.workLog.deleteMany({ where: { workOrderId: id } }),
    prisma.photo.deleteMany({ where: { workOrderId: id } }),
    prisma.workOrder.delete({ where: { id } }),
  ]);
  res.json({ ok: true });
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
  const userId = req.user!.id;
  const order = await prisma.workOrder.findUnique({ where: { id } });
  if (!order || !(await isAssigned(id, userId))) {
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
      return res.status(400).json({
        error:
          running.userId === userId
            ? "Najprej končaj delo"
            : "Delo še poteka pri drugem delavcu na tem nalogu",
      });
    }
    const worked = await prisma.timeEntry.count({
      where: { workOrderId: id, endedAt: { not: null } },
    });
    if (worked === 0) {
      return res
        .status(400)
        .json({ error: "Najprej evidentiraj delo (Začni delo in Končaj delo)" });
    }
  }

  const updated = await prisma.workOrder.update({
    where: { id },
    data: { status: parsed.data.status },
  });
  res.json(updated);
});