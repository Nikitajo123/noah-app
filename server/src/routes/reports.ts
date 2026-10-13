import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../auth";
import { streamReportPdf } from "../pdf";

const r2 = (n: number) => Math.round(n * 100) / 100;
const hoursOf = (start: Date, end: Date) => (end.getTime() - start.getTime()) / 3600000;

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

function dayInfo(date?: string) {
  const key = date ?? new Date().toLocaleDateString("sv-SE");
  const start = new Date(`${key}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { key, start, end, reportDate: new Date(`${key}T00:00:00.000Z`) };
}

// ---------- Pregled za vodjo ----------

export const overviewRouter = Router();
overviewRouter.use(requireAuth, requireRole("VODJA"));

const overviewQuery = z.object({
  date: z.string().regex(dateRe).optional(),
  projectId: z.string().optional(),
});

overviewRouter.get("/", async (req, res) => {
  const q = overviewQuery.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Napačen filter" });
  const { start, end } = dayInfo(q.data.date);
  const day = { gte: start, lt: end };

  const orders = await prisma.workOrder.findMany({
    where: {
      ...(q.data.projectId ? { projectId: q.data.projectId } : {}),
      OR: [
        { timeEntries: { some: { startedAt: day } } },
        { dueDate: day },
        { status: "PROBLEM" },
      ],
    },
    include: {
      project: true,
      worker: { select: { id: true, name: true } },
      timeEntries: { where: { startedAt: day }, orderBy: { startedAt: "asc" } },
    },
    orderBy: { number: "asc" },
  });

  const rows = orders.map((o) => {
    const entries = o.timeEntries;
    const running = entries.some((e) => !e.endedAt);
    const finished = entries.filter((e) => e.endedAt);
    const hours = finished.reduce((s, e) => s + hoursOf(e.startedAt, e.endedAt!), 0);
    return {
      workOrderId: o.id,
      number: o.number,
      worker: o.worker,
      project: { id: o.project.id, name: o.project.name, location: o.project.location },
      arrival: entries[0]?.startedAt ?? null,
      departure: running ? null : entries[entries.length - 1]?.endedAt ?? null,
      hours: entries.length ? r2(hours) : null,
      status: o.status,
    };
  });
  res.json(rows);
});

// ---------- Dnevno poročilo ----------

export async function buildReport(userId: string, date?: string) {
  const { key, start, end, reportDate } = dayInfo(date);
  const day = { gte: start, lt: end };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });
  if (!user) return null;

  const orders = await prisma.workOrder.findMany({
    where: {
      workerId: userId,
      OR: [
        { timeEntries: { some: { userId, startedAt: day } } },
        { workLogs: { some: { userId, createdAt: day } } },
        { photos: { some: { userId, takenAt: day } } },
      ],
    },
    include: {
      project: true,
      materials: { orderBy: { name: "asc" } },
      timeEntries: { where: { userId, startedAt: day }, orderBy: { startedAt: "asc" } },
      workLogs: { where: { userId, createdAt: day }, orderBy: { createdAt: "asc" } },
      photos: { where: { userId, takenAt: day }, orderBy: { takenAt: "asc" } },
    },
    orderBy: { number: "asc" },
  });

  const saved = await prisma.dailyReport.findUnique({
    where: { userId_date: { userId, date: reportDate } },
  });

  let totalHours = 0;
  const items = orders.map((o) => {
    const entries = o.timeEntries;
    const running = entries.some((e) => !e.endedAt);
    const hours = entries
      .filter((e) => e.endedAt)
      .reduce((s, e) => s + hoursOf(e.startedAt, e.endedAt!), 0);
    totalHours += hours;
    return {
      workOrderId: o.id,
      number: o.number,
      status: o.status,
      project: { name: o.project.name, location: o.project.location },
      arrival: entries[0]?.startedAt ?? null,
      departure: running ? null : entries[entries.length - 1]?.endedAt ?? null,
      hours: r2(hours),
      logs: o.workLogs.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        note: l.note,
      })),
      materials: o.materials.map((m) => ({ name: m.name, usedQty: m.usedQty })),
      problems: o.workLogs.filter((l) => l.note).map((l) => l.note),
      photos: o.photos.map((p) => ({ id: p.id, kind: p.kind, path: p.path, takenAt: p.takenAt })),
    };
  });

  return {
    date: key,
    worker: user,
    status: saved?.status ?? "OSNUTEK",
    submittedAt: saved?.submittedAt ?? null,
    totalHours: r2(totalHours),
    orders: items,
  };
}

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

const reportQuery = z.object({
  date: z.string().regex(dateRe).optional(),
  userId: z.string().uuid().optional(),
});

reportsRouter.get("/", async (req, res) => {
  const q = reportQuery.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Napačen filter" });

  let userId = req.user!.id;
  if (req.user!.role === "VODJA") {
    if (!q.data.userId) return res.status(400).json({ error: "Manjka delavec" });
    userId = q.data.userId;
  }
  const report = await buildReport(userId, q.data.date);
  if (!report) return res.status(404).json({ error: "Delavca ni" });
  res.json(report);
});

reportsRouter.get("/pdf", async (req, res) => {
  const q = reportQuery.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Napačen filter" });

  let userId = req.user!.id;
  if (req.user!.role === "VODJA") {
    if (!q.data.userId) return res.status(400).json({ error: "Manjka delavec" });
    userId = q.data.userId;
  }
  const report = await buildReport(userId, q.data.date);
  if (!report) return res.status(404).json({ error: "Delavca ni" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="porocilo-${report.date}.pdf"`);
  const ids = report.orders.flatMap((o) => o.photos.map((p) => p.id));
  const files = await prisma.photoFile.findMany({ where: { photoId: { in: ids } } });
  const photoData = new Map(files.map((f) => [f.photoId, Buffer.from(f.data)]));
  streamReportPdf(report, res, photoData);
});

reportsRouter.post("/submit", requireRole("DELAVEC"), async (req, res) => {
  const parsed = z.object({ date: z.string().regex(dateRe).optional() }).safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Napačni podatki" });
  const userId = req.user!.id;

  const running = await prisma.timeEntry.findFirst({ where: { userId, endedAt: null } });
  if (running) return res.status(400).json({ error: "Najprej končaj delo" });

  const { reportDate } = dayInfo(parsed.data.date);
  const saved = await prisma.dailyReport.upsert({
    where: { userId_date: { userId, date: reportDate } },
    update: { status: "ODDANO", submittedAt: new Date() },
    create: { userId, date: reportDate, status: "ODDANO", submittedAt: new Date() },
  });
  res.json(saved);
});