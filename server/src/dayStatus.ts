import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

type Db = Prisma.TransactionClient | typeof prisma;

// Calendar day in the server timezone (TZ=Europe/Ljubljana), stored as a UTC-midnight DATE.
export function todayDate() {
  return new Date(`${new Date().toLocaleDateString("sv-SE")}T00:00:00.000Z`);
}

// Each assigned worker's latest status (most recent day, then most recent edit).
export async function latestDone(db: Db, workOrderId: string, userIds: string[]) {
  const rows = await db.orderDayStatus.findMany({
    where: { workOrderId, userId: { in: userIds } },
    orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
  });
  const latest = new Map<string, boolean>();
  for (const r of rows) if (!latest.has(r.userId)) latest.set(r.userId, r.done);
  return latest;
}

// Closes the order when every assigned worker's latest status is DA and nobody is still working.
export async function closeIfAllDone(db: Db, workOrderId: string) {
  const order = await db.workOrder.findUnique({
    where: { id: workOrderId },
    include: { workers: true },
  });
  if (!order || order.status === "ZAKLJUCEN" || order.status === "NOV") return false;
  const ids = order.workers.map((w) => w.userId);
  if (ids.length === 0) return false;
  const latest = await latestDone(db, workOrderId, ids);
  if (!ids.every((id) => latest.get(id) === true)) return false;
  const running = await db.timeEntry.count({ where: { workOrderId, endedAt: null } });
  if (running > 0) return false;
  await db.workOrder.update({ where: { id: workOrderId }, data: { status: "ZAKLJUCEN" } });
  return true;
}
