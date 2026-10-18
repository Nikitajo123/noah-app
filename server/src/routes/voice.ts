import { Router } from "express";
import multer from "multer";
import { requireAuth, requireRole } from "../auth";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

export const voiceRouter = Router();
voiceRouter.use(requireAuth, requireRole("DELAVEC"));

// At most 10 recordings per minute per user, to protect the free Groq quota.
const recent = new Map<string, number[]>();
function allowed(userId: string) {
  const now = Date.now();
  const list = (recent.get(userId) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= 10) {
    recent.set(userId, list);
    return false;
  }
  list.push(now);
  recent.set(userId, list);
  return true;
}

function extensionFor(mime: string) {
  const m = mime.toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "mp4";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("wav")) return "wav";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  return "webm";
}

voiceRouter.post("/transcribe", (req, res) => {
  upload.single("audio")(req, res, async (err?: unknown) => {
    try {
      if (err) return res.status(400).json({ error: "Posnetek je neveljaven ali predolg" });
      const file = req.file;
      if (!file || file.size < 500) {
        return res.status(400).json({ error: "Posnetek je prazen. Poskusi znova." });
      }
      if (!file.mimetype.startsWith("audio/") && !file.mimetype.startsWith("video/")) {
        return res.status(400).json({ error: "Datoteka ni zvočni posnetek" });
      }
      const key = process.env.GROQ_API_KEY;
      if (!key) return res.status(503).json({ error: "Glasovni vnos ni nastavljen" });
      if (!allowed(req.user!.id)) {
        return res.status(429).json({ error: "Preveč posnetkov naenkrat. Počakaj minuto." });
      }

      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }),
        `voice.${extensionFor(file.mimetype)}`
      );
      form.append("model", process.env.GROQ_WHISPER_MODEL || "whisper-large-v3");
      form.append("language", "sl");
      form.append("response_format", "json");
      form.append("temperature", "0");
      form.append(
        "prompt",
        "Delovni nalog. Montaža stenskih elementov, vijaki, tesnilni material, količina, kos."
      );

      const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
        signal: AbortSignal.timeout(25_000),
      });

      if (r.status === 429) {
        return res.status(429).json({ error: "Omejitev glasovnega vnosa je dosežena. Poskusi pozneje." });
      }
      if (!r.ok) {
        console.error("Groq transcription failed", r.status, (await r.text()).slice(0, 300));
        return res.status(502).json({ error: "Prepoznava govora ni uspela" });
      }
      const data = (await r.json()) as { text?: string };
      res.json({ text: (data.text ?? "").trim() });
    } catch (e) {
      console.error("Voice route error", e instanceof Error ? e.message : e);
      res.status(502).json({ error: "Prepoznava govora ni uspela" });
    }
  });
});