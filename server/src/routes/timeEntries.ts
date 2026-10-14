import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../auth";

export const timeEntriesRouter = Router();
timeEntriesRouter.use(requireAuth, requireRole("VODJA"));

const editSchema = z.object({
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date(),
  reason: z.string().trim().min(3).max(300),
});

timeEntriesRouter.patch("/:id", async (req, res) => {
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Vnesi začetek, konec in razlog (vsaj 3 znake)" });
  }
  const { startedAt, endedAt, reason } = parsed.data;
  const id = req.params.id as string;

  const entry = await prisma.timeEntry.findUnique({ where: { id } });
  if (!entry) return res.status(404).json({ error: "Evidence ni" });

  if (endedAt.getTime() <= startedAt.getTime()) {
    return res.status(400).json({ error: "Konec mora biti po začetku" });
  }
  if (endedAt.getTime() > Date.now() + 60_000) {
    return res.status(400).json({ error: "Konec ne sme biti v prihodnosti" });
  }
  if (endedAt.getTime() - startedAt.getTime() > 24 * 3600_000) {
    return res.status(400).json({ error: "Evidenca ne sme biti daljša od 24 ur" });
  }
  if (
    startedAt.getTime() === entry.startedAt.getTime() &&
    endedAt.getTime() === entry.endedAt?.getTime()
  ) {
    return res.status(400).json({ error: "Časa se nista spremenila" });
  }

  const clash = await prisma.timeEntry.findFirst({
    where: {
      userId: entry.userId,
      id: { not: id },
      startedAt: { lt: endedAt },
      OR: [{ endedAt: null }, { endedAt: { gt: startedAt } }],
    },
  });
  if (clash) {
    return res.status(400).json({ error: "Čas se prekriva z drugo evidenco istega delavca" });
  }

  const [, updated] = await prisma.$transaction([
    prisma.timeEntryEdit.create({
      data: {
        timeEntryId: id,
        editedById: req.user!.id,
        reason,
        oldStartedAt: entry.startedAt,
        oldEndedAt: entry.endedAt,
        newStartedAt: startedAt,
        newEndedAt: endedAt,
      },
    }),
    prisma.timeEntry.update({ where: { id }, data: { startedAt, endedAt } }),
  ]);
  res.json(updated);
});