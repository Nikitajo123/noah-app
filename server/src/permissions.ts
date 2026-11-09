import { Request, Response, NextFunction } from "express";
import { prisma } from "./db";
import type { AuthUser } from "./auth";

// VODJA is the Admin role (kept for existing users).
export const isAdmin = (u: AuthUser) => u.role === "VODJA";
export const isManagerRole = (u: AuthUser) => u.role !== "DELAVEC";
// Creating and editing gradbišča: Admin and Vodja gradbišč.
export const canEditProjects = (u: AuthUser) => u.role === "VODJA" || u.role === "VODJA_GRADBISC";

// Every manager role (Admin, Vodja gradbišč, Vodja dela) works on every gradbišče.
// The scope helpers stay, so a narrower scope can be added later in one place.
// null means "all gradbišča".
export async function assignedProjectIds(u: AuthUser): Promise<string[] | null> {
  return isManagerRole(u) ? null : [];
}

export async function canManageProject(u: AuthUser, _projectId: string) {
  return isManagerRole(u);
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
