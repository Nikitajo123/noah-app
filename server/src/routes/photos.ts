import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../auth";

export const uploadDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) =>
    cb(null, randomUUID() + path.extname(file.originalname).toLowerCase()),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
});

export const photosRouter = Router();
photosRouter.use(requireAuth, requireRole("DELAVEC"));

const bodySchema = z.object({
  id: z.string().uuid().optional(),
  workOrderId: z.string().uuid(),
  kind: z.enum(["PRED", "MED", "KONCANO", "PROBLEM"]),
  takenAt: z.coerce.date().optional(),
});

photosRouter.post("/", upload.single("photo"), async (req, res) => {
  const file = req.file;
  const discard = () => file && fs.unlink(file.path, () => {});

  if (!file) return res.status(400).json({ error: "Manjka fotografija" });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    discard();
    return res.status(400).json({ error: "Napačni podatki" });
  }
  const { id, workOrderId, kind, takenAt } = parsed.data;
  const userId = req.user!.id;

  if (id) {
    const existing = await prisma.photo.findUnique({ where: { id } });
    if (existing && existing.userId === userId) {
      discard();
      return res.json(existing);
    }
  }

  const order = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
  if (!order || order.workerId !== userId) {
    discard();
    return res.status(404).json({ error: "Naloga ni" });
  }
  if (order.status === "ZAKLJUCEN") {
    discard();
    return res.status(400).json({ error: "Naloga je zaključena" });
  }

  const photo = await prisma.photo.create({
    data: {
      ...(id ? { id } : {}),
      workOrderId,
      userId,
      kind,
      path: `/uploads/${file.filename}`,
      takenAt: takenAt ?? new Date(),
    },
  });
  res.status(201).json(photo);
});