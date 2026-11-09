import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "./db";

export type Role = "DELAVEC" | "VODJA" | "VODJA_GRADBISC" | "VODJA_DEL";
export type AuthUser = { id: string; role: Role };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// The token carries the role, but the current role is read from the database so a
// role change or a deleted user takes effect immediately.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Ni prijave" });
  }
  let payload: AuthUser;
  try {
    payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as unknown as AuthUser;
  } catch {
    return res.status(401).json({ error: "Neveljaven žeton" });
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, role: true },
  });
  if (!user) return res.status(401).json({ error: "Neveljaven žeton" });
  req.user = user;
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user && roles.includes(req.user.role)) return next();
    res.status(403).json({ error: "Ni dovoljenja" });
  };
}
