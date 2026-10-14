import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../auth";
import { streamTeamReportPdf } from "../pdfTeam";

const person = { select: { id: true, name: true } } as const;
const r2 = (n: number) => Math.round(n * 100) / 100;
const hoursOf = (s: Date, e: Date) => (e.getTime() - s.getTime()) / 3600000;
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

function dayInfo(date?: string) {
  const key = date ?? new Date().toLocaleDateString("sv-SE");
  const start = new Date(`${key}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { key, start, end, reportDate: new Date(`${key}T00:00:00.000Z`) };
}

const teamInclude = {
  foreman: person,
  members: { select: { id: true, name: true }, orderBy: { name: "asc" as const } },
};

// ---------- Ekipe ----------

export const teamsRouter = Router();
teamsRouter.use(requireAuth);

teamsRouter.get("/mine", requireRole("DELAVEC"), async (req, res) => {
  const me = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { team: { include: teamInclude } },
  });
  const team = me?.team ?? null;
  res.json({ team, isForeman: !!team && team.foremanId === req.user!.id });
});

teamsRouter.get("/", requireRole("VODJA"), async (_req, res) => {
  const teams = await prisma.team.findMany({ include: teamInclude, orderBy: { name: "asc" } });
  res.json(teams);
});

const teamSchema = z.object({
  name: z.string().trim().min(1).max(60),
  foremanId: z.string().uuid(),
  memberIds: z.array(z.string().uuid()).min(1),
});

async function checkPeople(foremanId: string, memberIds: string[], teamId?: string) {
  const ids = [...new Set([...memberIds, foremanId])];
  const count = await prisma.user.count({ where: { id: { in: ids }, role: "DELAVEC" } });
  if (count !== ids.length) return { error: "Izberi veljavne delavce" } as const;
  const otherForeman = await prisma.team.findFirst({
    where: { foremanId: { in: ids }, ...(teamId ? { id: { not: teamId } } : {}) },
  });
  if (otherForeman) {
    return { error: "Delavec je delovodja druge ekipe. Najprej spremeni tisto ekipo." } as const;
  }
  return { ids } as const;
}

teamsRouter.post("/", requireRole("VODJA"), async (req, res) => {
  const parsed = teamSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Vnesi ime, delovodjo in člane" });
  const check = await checkPeople(parsed.data.foremanId, parsed.data.memberIds);
  if ("error" in check) return res.status(400).json({ error: check.error });
  try {
    const team = await prisma.team.create({
      data: {
        name: parsed.data.name,
        foremanId: parsed.data.foremanId,
        members: { connect: check.ids.map((id) => ({ id })) },
      },
      include: teamInclude,
    });
    res.status(201).json(team);
  } catch {
    res.status(409).json({ error: "Ekipa s tem imenom že obstaja" });
  }
});

teamsRouter.put("/:id", requireRole("VODJA"), async (req, res) => {
  const id = req.params.id as string;
  const parsed = teamSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Vnesi ime, delovodjo in člane" });
  const existing = await prisma.team.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Ekipe ni" });
  const check = await checkPeople(parsed.data.foremanId, parsed.data.memberIds, id);
  if ("error" in check) return res.status(400).json({ error: check.error });
  try {
    const team = await prisma.team.update({
      where: { id },
      data: {
        name: parsed.data.name,
        foremanId: parsed.data.foremanId,
        members: { set: check.ids.map((uid) => ({ id: uid })) },
      },
      include: teamInclude,
    });
    res.json(team);
  } catch {
    res.status(409).json({ error: "Ekipa s tem imenom že obstaja" });
  }
});

teamsRouter.delete("/:id", requireRole("VODJA"), async (req, res) => {
  const id = req.params.id as string;
  const existing = await prisma.team.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Ekipe ni" });
  await prisma.$transaction([
    prisma.user.updateMany({ where: { teamId: id }, data: { teamId: null } }),
    prisma.teamReport.deleteMany({ where: { teamId: id } }),
    prisma.team.delete({ where: { id } }),
  ]);
  res.json({ ok: true });
});

// ---------- Poročilo ekipe ----------

async function buildTeamReport(teamId: string, date?: string) {
  const { key, start, end, reportDate } = dayInfo(date);
  const day = { gte: start, lt: end };

  const team = await prisma.team.findUnique({ where: { id: teamId }, include: teamInclude });
  if (!team) return null;
  const ids = team.members.map((m) => m.id);

  const orders = await prisma.workOrder.findMany({
    where: {
      OR: [
        { timeEntries: { some: { userId: { in: ids }, startedAt: day } } },
        { workLogs: { some: { userId: { in: ids }, createdAt: day } } },
        { photos: { some: { userId: { in: ids }, takenAt: day } } },
      ],
    },
    include: {
      project: true,
      materials: { orderBy: { name: "asc" } },
      timeEntries: {
        where: { userId: { in: ids }, startedAt: day },
        orderBy: { startedAt: "asc" },
      },
      workLogs: {
        where: { userId: { in: ids }, createdAt: day },
        orderBy: { createdAt: "asc" },
        include: { user: person },
      },
      photos: { where: { userId: { in: ids }, takenAt: day }, orderBy: { takenAt: "asc" } },
    },
    orderBy: { number: "asc" },
  });

  const saved = await prisma.teamReport.findUnique({
    where: { teamId_date: { teamId, date: reportDate } },
    include: { submittedBy: person },
  });

  let totalHours = 0;
  const items = orders.map((o) => {
    const workers: {
      userId: string;
      name: string;
      arrival: Date | null;
      departure: Date | null;
      hours: number;
      running: boolean;
    }[] = [];
    for (const m of team.members) {
      const entries = o.timeEntries.filter((e) => e.userId === m.id);
      if (entries.length === 0) continue;
      const running = entries.some((e) => !e.endedAt);
      const hours = entries
        .filter((e) => e.endedAt)
        .reduce((s, e) => s + hoursOf(e.startedAt, e.endedAt!), 0);
      workers.push({
        userId: m.id,
        name: m.name,
        arrival: entries[0].startedAt,
        departure: running ? null : entries[entries.length - 1].endedAt,
        hours: r2(hours),
        running,
      });
    }
    const orderHours = workers.reduce((s, w) => s + w.hours, 0);
    totalHours += orderHours;
    return {
      workOrderId: o.id,
      number: o.number,
      status: o.status,
      project: { name: o.project.name, location: o.project.location },
      hours: r2(orderHours),
      workers,
      logs: o.workLogs.map((l) => ({
        author: l.user.name,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        note: l.note,
      })),
      materials: o.materials.map((m) => ({ name: m.name, usedQty: m.usedQty })),
      problems: o.workLogs
        .filter((l) => l.note)
        .map((l) => ({ author: l.user.name, text: l.note as string })),
      photos: o.photos.map((p) => ({ id: p.id, kind: p.kind, path: p.path, takenAt: p.takenAt })),
    };
  });

  return {
    date: key,
    team: { id: team.id, name: team.name, foreman: team.foreman, members: team.members },
    status: saved?.status ?? "OSNUTEK",
    summary: saved?.summary ?? null,
    submittedAt: saved?.submittedAt ?? null,
    submittedBy: saved?.submittedBy?.name ?? null,
    totalHours: r2(totalHours),
    orders: items,
  };
}

export const teamReportsRouter = Router();
teamReportsRouter.use(requireAuth);

const reportQuery = z.object({
  date: z.string().regex(dateRe).optional(),
  teamId: z.string().uuid().optional(),
});

teamReportsRouter.get("/", async (req, res) => {
  const q = reportQuery.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Napačen filter" });

  let teamId = q.data.teamId;
  if (req.user!.role === "DELAVEC") {
    const me = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { teamId: true },
    });
    if (!me?.teamId) return res.status(404).json({ error: "Nisi v ekipi" });
    teamId = me.teamId;
  }
  if (!teamId) return res.status(400).json({ error: "Manjka ekipa" });

  const report = await buildTeamReport(teamId, q.data.date);
  if (!report) return res.status(404).json({ error: "Ekipe ni" });
  res.json(report);
});

teamReportsRouter.get("/pdf", async (req, res) => {
  const q = reportQuery.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Napačen filter" });

  let teamId = q.data.teamId;
  if (req.user!.role === "DELAVEC") {
    const me = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { teamId: true },
    });
    if (!me?.teamId) return res.status(404).json({ error: "Nisi v ekipi" });
    teamId = me.teamId;
  }
  if (!teamId) return res.status(400).json({ error: "Manjka ekipa" });

  const report = await buildTeamReport(teamId, q.data.date);
  if (!report) return res.status(404).json({ error: "Ekipe ni" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="porocilo-ekipe-${report.date}.pdf"`);
  const ids = report.orders.flatMap((o) => o.photos.map((p) => p.id));
  const files = await prisma.photoFile.findMany({ where: { photoId: { in: ids } } });
  const photoData = new Map(files.map((f) => [f.photoId, Buffer.from(f.data)]));
  streamTeamReportPdf(report, res, photoData);
});

teamReportsRouter.get("/day", requireRole("VODJA"), async (req, res) => {
  const q = z.object({ date: z.string().regex(dateRe).optional() }).safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Napačen datum" });

  const teams = await prisma.team.findMany({ select: { id: true }, orderBy: { name: "asc" } });
  const rows = [];
  for (const t of teams) {
    const r = await buildTeamReport(t.id, q.data.date);
    if (!r) continue;
    rows.push({
      teamId: t.id,
      name: r.team.name,
      foreman: r.team.foreman.name,
      members: r.team.members.length,
      status: r.status,
      submittedAt: r.submittedAt,
      totalHours: r.totalHours,
      orders: r.orders.length,
      photos: r.orders.reduce((s, o) => s + o.photos.length, 0),
      problem: r.orders.some((o) => o.status === "PROBLEM" || o.problems.length > 0),
    });
  }
  res.json(rows);
});

const saveSchema = z.object({
  date: z.string().regex(dateRe).optional(),
  summary: z.string().max(2000).optional(),
  submit: z.boolean(),
});

teamReportsRouter.post("/save", requireRole("DELAVEC"), async (req, res) => {
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Napačni podatki" });
  const { date, summary, submit } = parsed.data;

  const me = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, team: { include: { members: { select: { id: true } } } } },
  });
  if (!me?.team) return res.status(404).json({ error: "Nisi v ekipi" });
  if (me.team.foremanId !== me.id) {
    return res.status(403).json({ error: "Poročilo ekipe oddaja delovodja" });
  }

  if (submit) {
    const running = await prisma.timeEntry.findFirst({
      where: { userId: { in: me.team.members.map((m) => m.id) }, endedAt: null },
      include: { user: person },
    });
    if (running) {
      return res
        .status(400)
        .json({ error: `${running.user.name} še dela. Najprej naj konča delo.` });
    }
  }

  const { reportDate } = dayInfo(date);
  const cleanSummary = (summary ?? "").trim() || null;
  const saved = await prisma.teamReport.upsert({
    where: { teamId_date: { teamId: me.team.id, date: reportDate } },
    update: {
      summary: cleanSummary,
      ...(submit ? { status: "ODDANO", submittedAt: new Date(), submittedById: me.id } : {}),
    },
    create: {
      teamId: me.team.id,
      date: reportDate,
      summary: cleanSummary,
      ...(submit
        ? { status: "ODDANO" as const, submittedAt: new Date(), submittedById: me.id }
        : {}),
    },
  });
  res.json(saved);
});

// ---------- Ure po projektih ----------

export const projectHoursRouter = Router();
projectHoursRouter.use(requireAuth, requireRole("VODJA"));

projectHoursRouter.get("/", async (req, res) => {
  const q = z
    .object({
      from: z.string().regex(dateRe).optional(),
      to: z.string().regex(dateRe).optional(),
    })
    .safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Napačen datum" });

  const today = new Date().toLocaleDateString("sv-SE");
  const from = q.data.from ?? today;
  const to = q.data.to ?? today;
  if (from > to) return res.status(400).json({ error: "Začetek mora biti pred koncem" });

  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  end.setDate(end.getDate() + 1);
  if (end.getTime() - start.getTime() > 366 * 86400000) {
    return res.status(400).json({ error: "Obdobje je lahko dolgo največ eno leto" });
  }

  const entries = await prisma.timeEntry.findMany({
    where: { startedAt: { gte: start, lt: end }, endedAt: { not: null } },
    include: { user: person, workOrder: { select: { id: true, project: true } } },
  });

  const map = new Map<
    string,
    {
      projectId: string;
      name: string;
      location: string;
      hours: number;
      orders: Set<string>;
      workers: Map<string, { name: string; hours: number }>;
    }
  >();
  for (const e of entries) {
    const h = hoursOf(e.startedAt, e.endedAt!);
    const p = e.workOrder.project;
    const row = map.get(p.id) ?? {
      projectId: p.id,
      name: p.name,
      location: p.location,
      hours: 0,
      orders: new Set<string>(),
      workers: new Map<string, { name: string; hours: number }>(),
    };
    row.hours += h;
    row.orders.add(e.workOrder.id);
    const w = row.workers.get(e.user.id) ?? { name: e.user.name, hours: 0 };
    w.hours += h;
    row.workers.set(e.user.id, w);
    map.set(p.id, row);
  }

  const projects = [...map.values()]
    .map((r) => ({
      projectId: r.projectId,
      name: r.name,
      location: r.location,
      hours: r2(r.hours),
      orders: r.orders.size,
      workers: [...r.workers.values()]
        .map((w) => ({ name: w.name, hours: r2(w.hours) }))
        .sort((a, b) => b.hours - a.hours),
    }))
    .sort((a, b) => b.hours - a.hours);

  res.json({ from, to, totalHours: r2(projects.reduce((s, p) => s + p.hours, 0)), projects });
});