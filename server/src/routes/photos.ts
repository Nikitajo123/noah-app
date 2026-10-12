import { Router } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../auth";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ["image/jpeg", "image/png"].includes(file.mimetype)),
});

export const photosRouter = Router();
photosRouter.use(requireAuth);

const bodySchema = z.object({
  id: z.string().uuid().optional(),
  workOrderId: z.string().uuid(),
  kind: z.enum(["PRED", "MED", "KONCANO", "PROBLEM"]),
  takenAt: z.coerce.date().optional(),
});

photosRouter.post("/", requireRole("DELAVEC"), upload.single("photo"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "Manjka fotografija (JPEG ali PNG)" });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Napačni podatki" });
  const { id, workOrderId, kind, takenAt } = parsed.data;
  const userId = req.user!.id;

  if (id) {
    const existing = await prisma.photo.findUnique({ where: { id } });
    if (existing && existing.userId === userId) return res.json(existing);
  }

  const order = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
  if (!order || order.workerId !== userId) {
    return res.status(404).json({ error: "Naloga ni" });
  }
  if (order.status === "ZAKLJUCEN") {
    return res.status(400).json({ error: "Naloga je zaključena" });
  }

  const photoId = id ?? randomUUID();
  const photo = await prisma.photo.create({
    data: {
      id: photoId,
      workOrderId,
      userId,
      kind,
      path: `/photos/${photoId}/file`,
      takenAt: takenAt ?? new Date(),
      file: { create: { mimeType: file.mimetype, data: file.buffer } },
    },
  });
  res.status(201).json(photo);
});

photosRouter.get("/:id/file", async (req, res) => {
  const photo = await prisma.photo.findUnique({
    where: { id: req.params.id as string },
    include: { file: true },
  });
  if (!photo || !photo.file) return res.status(404).json({ error: "Fotografije ni" });
  if (req.user!.role === "DELAVEC" && photo.userId !== req.user!.id) {
    return res.status(403).json({ error: "Ni dovoljenja" });
  }
  res.setHeader("Content-Type", photo.file.mimeType);
  res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
  res.send(Buffer.from(photo.file.data));
});