import { useEffect, useRef, useState } from "react";
import { api } from "../api";

const MAX_SECONDS = 30;
const JUNK = /^(hvala za (ogled|pozornost|gledanje)|titlovi|podnapisi|prevod)/i;

function pickMime(): string {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return options.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

function extFor(type: string) {
  const t = type.toLowerCase();
  if (t.includes("mp4") || t.includes("aac")) return "mp4";
  if (t.includes("ogg")) return "ogg";
  return "webm";
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

function micError(e: unknown) {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Dostop do mikrofona je zavrnjen. Dovoli ga v nastavitvah brskalnika.";
  }
  if (name === "NotFoundError") return "Mikrofon ni najden.";
  if (name === "NotReadableError") return "Mikrofon uporablja druga aplikacija.";
  return "Snemanje ni uspelo.";
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function VoiceButton({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "recording" | "processing">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");

  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });

  const aliveRef = useRef(true);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<number | null>(null);
  const limitRef = useRef<number | null>(null);
  const startedRef = useRef(0);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        rec.onstop = null;
        rec.stop();
      }
      if (tickRef.current) window.clearInterval(tickRef.current);
      if (limitRef.current) window.clearTimeout(limitRef.current);
      stopStream(streamRef.current);
    };
  }, []);

  async function finish(recMime: string) {
    if (tickRef.current) window.clearInterval(tickRef.current);
    if (limitRef.current) window.clearTimeout(limitRef.current);
    tickRef.current = null;
    limitRef.current = null;
    stopStream(streamRef.current);
    streamRef.current = null;

    const duration = Date.now() - startedRef.current;
    const type = recMime || chunksRef.current[0]?.type || "audio/webm";
    const blob = new Blob(chunksRef.current, { type });
    chunksRef.current = [];
    if (!aliveRef.current) return;

    if (duration < 700 || blob.size < 1500) {
      setPhase("idle");
      setError("Posnetek je prekratek. Poskusi znova.");
      return;
    }

    setPhase("processing");
    try {
      const fd = new FormData();
      fd.append("audio", blob, `voice.${extFor(type)}`);
      const r = await api<{ text: string }>("/voice/transcribe", { method: "POST", body: fd });
      if (!aliveRef.current) return;
      const text = r.text.trim();
      if (!text || (duration < 4000 && JUNK.test(text))) {
        setError("Nisem razumel govora. Poskusi znova.");
      } else {
        const base = valueRef.current.trim();
        onChangeRef.current(
          base ? `${base} ${text}` : text.charAt(0).toUpperCase() + text.slice(1)
        );
      }
    } catch (e) {
      if (aliveRef.current) {
        setError(e instanceof Error ? e.message : "Napaka pri prepoznavi govora.");
      }
    } finally {
      if (aliveRef.current) setPhase("idle");
    }
  }

  function stop() {
    const rec = recorderRef.current;
    if (rec && rec.state === "recording") rec.stop();
  }

  async function start() {
    setError("");
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(
        window.isSecureContext
          ? "Ta brskalnik ne podpira snemanja zvoka."
          : "Glasovni vnos zahteva varno povezavo (HTTPS)."
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!aliveRef.current) {
        stopStream(stream);
        return;
      }
      streamRef.current = stream;
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        void finish(rec.mimeType || mime);
      };
      recorderRef.current = rec;
      rec.start();
      startedRef.current = Date.now();
      setSeconds(0);
      setPhase("recording");
      tickRef.current = window.setInterval(
        () => setSeconds(Math.floor((Date.now() - startedRef.current) / 1000)),
        250
      );
      limitRef.current = window.setTimeout(stop, MAX_SECONDS * 1000);
    } catch (e) {
      stopStream(streamRef.current);
      streamRef.current = null;
      setPhase("idle");
      setError(micError(e));
    }
  }

  const recording = phase === "recording";
  const processing = phase === "processing";

  return (
    <div className="voice-row">
      <button
        type="button"
        className={recording ? "voice-btn on" : processing ? "voice-btn busy" : "voice-btn"}
        disabled={processing}
        onClick={recording ? stop : start}
      >
        {processing ? (
          <>
            <span className="spinner sm" aria-hidden="true" />
            Pretvarjam v besedilo...
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
            </svg>
            {recording ? (
              <>
                Snemam <span className="voice-time">{clock(seconds)}</span>, pritisni za konec
              </>
            ) : (
              "Govori"
            )}
          </>
        )}
      </button>
      {error && (
        <span className="error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}