import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type AuthUser = { id: string; role: "DELAVEC" | "VODJA" };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Ni prijave" });
  }
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as unknown as AuthUser;
    next();
  } catch {
    res.status(401).json({ error: "Neveljaven žeton" });
  }
}

export function requireRole(role: "DELAVEC" | "VODJA") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role === role) return next();
    res.status(403).json({ error: "Ni dovoljenja" });
  };
}