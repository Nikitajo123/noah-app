import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { assignedProjectIds, inProjects, requireManager } from "../permissions";

// Dnevni pregled: per gradbišče, each naloga's worker states for one day, plus open
// nalogi carried over from earlier days. Scoped to the viewer's gradbišča.
export const dailyOverviewRouter = Router();
dailyOverviewRouter.use(requireAuth, requireManager);

const person = { select: { id: true, name: true } } as const;
const r2 = (n: number) => Math.round(n * 100) / 100;

function dayInfo(key: string) {
  const start = new Date(`${key}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end, reportDate: new Date(`${key}T00:00:00.000Z`) };
}

type Group = {
  id: string;
  name: string;
  location: string;
  orders: unknown[];
  open: unknown[];
};

dailyOverviewRouter.get("/", async (req, res) => {
  const q = z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      projectId: z.string().uuid().optional(),
    })
    .safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Napačen filter" });

  const date = q.data.date ?? new Date().toLocaleDateString("sv-SE");
  const { start, end, reportDate } = dayInfo(date);
  const day = { gte: start, lt: end };
  const scope = await assignedProjectIds(req.user!);
  const where = {
    ...inProjects(scope),
    ...(q.data.projectId ? { AND: [{ projectId: q.data.projectId }] } : {}),
  };

  const [dayOrders, openOrders] = await Promise.all([
    prisma.workOrder.findMany({
      where: {
        ...where,
        OR: [
          { workDate: day },
          { dayStatuses: { some: { date: reportDate } } },
          { timeEntries: { some: { startedAt: day } } },
          { photos: { some: { takenAt: day } } },
        ],
      },
      include: {
        project: true,
        workers: { include: { user: person } },
        dayStatuses: { where: { date: reportDate } },
        timeEntries: { where: { startedAt: day } },
        photos: { where: { takenAt: day }, select: { userId: true } },
        _count: { select: { timeEntries: true } },
      },
      orderBy: { number: "asc" },
    }),
    prisma.workOrder.findMany({
      where: { ...where, status: { not: "ZAKLJUCEN" }, workDate: { lt: start } },
      include: {
        project: true,
        workers: { include: { user: person } },
        dayStatuses: {
          where: { note: { not: null } },
          orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
          take: 1,
          include: { user: person },
        },
      },
      orderBy: { workDate: "asc" },
    }),
  ]);

  const groups = new Map<string, Group>();
  const groupOf = (p: { id: string; name: string; location: string }) => {
    let g = groups.get(p.id);
    if (!g) {
      g = { id: p.id, name: p.name, location: p.location, orders: [], open: [] };
      groups.set(p.id, g);
    }
    return g;
  };

  for (const o of dayOrders) {
    groupOf(o.project).orders.push({
      id: o.id,
      number: o.number,
      description: o.description,
      status: o.status,
      noHours: o._count.timeEntries === 0,
      photos: o.photos.length,
      workers: o.workers.map(({ user }) => {
        const s = o.dayStatuses.find((d) => d.userId === user.id);
        const entries = o.timeEntries.filter((e) => e.userId === user.id);
        const hours = entries
          .filter((e) => e.endedAt)
          .reduce((sum, e) => sum + (e.endedAt!.getTime() - e.startedAt.getTime()) / 3600000, 0);
        return {
          id: user.id,
          name: user.name,
          state: s ? (s.done ? "DONE" : "NOT_DONE") : "NONE",
          note: s?.note ?? null,
          photos: o.photos.filter((p) => p.userId === user.id).length,
          hours: entries.length ? r2(hours) : null,
          running: entries.some((e) => !e.endedAt),
        };
      }),
    });
  }

  for (const o of openOrders) {
    const last = o.dayStatuses[0];
    const workDay = new Date(o.workDate.toLocaleDateString("sv-SE") + "T00:00:00");
    groupOf(o.project).open.push({
      id: o.id,
      number: o.number,
      description: o.description,
      status: o.status,
      workDate: o.workDate,
      daysOpen: Math.max(1, Math.round((start.getTime() - workDay.getTime()) / 86400000)),
      workers: o.workers.map((w) => w.user.name),
      lastNote: last
        ? { text: last.note, date: last.date, by: last.user.name, done: last.done }
        : null,
    });
  }

  res.json({
    date,
    projects: [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "sl")),
  });
});
