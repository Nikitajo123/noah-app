import { Request, Response, NextFunction } from "express";
import { prisma } from "./db";
import type { AuthUser } from "./auth";

// VODJA is the Admin role (kept for existing users).
export const isAdmin = (u: AuthUser) => u.role === "VODJA";
// Admin and Vodja gradbišč work on every gradbišče. Only Vodja dela is limited to assigned ones.
const seesAllProjects = (u: AuthUser) => u.role === "VODJA" || u.role === "VODJA_GRADBISC";
export const isManagerRole = (u: AuthUser) => u.role !== "DELAVEC";
export const canEditProjects = (u: AuthUser) => u.role === "VODJA" || u.role === "VODJA_GRADBISC";

// null means "all gradbišča" (Admin).
export async function assignedProjectIds(u: AuthUser): Promise<string[] | null> {
  if (seesAllProjects(u)) return null;
  if (!isManagerRole(u)) return [];
  const rows = await prisma.projectAssignment.findMany({
    where: { userId: u.id },
    select: { projectId: true },
  });
  return rows.map((r) => r.projectId);
}

export async function canManageProject(u: AuthUser, projectId: string) {
  if (seesAllProjects(u)) return true;
  if (!isManagerRole(u)) return false;
  const link = await prisma.projectAssignment.findUnique({
    where: { projectId_userId: { projectId, userId: u.id } },
  });
  return !!link;
}

// Prisma filter for rows that have a projectId.
export const inProjects = (ids: string[] | null) => (ids === null ? {} : { projectId: { in: ids } });

export function requireManager(req: Request, res: Response, next: NextFunction) {
  if (req.user && isManagerRole(req.user)) return next();
  res.status(403).json({ error: "Ni dovoljenja" });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user && isAdmin(req.user)) return next();
  res.status(403).json({ error: "Ni dovoljenja" });
}

// A work order visible to this manager, or null (caller answers 404).
export async function scopedOrder(u: AuthUser, id: string) {
  const order = await prisma.workOrder.findUnique({ where: { id } });
  if (!order) return null;
  if (!(await canManageProject(u, order.projectId))) return null;
  return order;
}
