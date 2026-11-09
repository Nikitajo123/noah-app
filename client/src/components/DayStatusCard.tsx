import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import VoiceButton from "./VoiceButton";
import PhotoSection from "./PhotoSection";
import { useAuth } from "../auth";
import { IconCheck } from "./Icons";
import type { WorkOrderDetail } from "../types";

type Save = "idle" | "saving" | "saved" | "error";

const todayKey = () => new Date().toLocaleDateString("sv-SE");
const dayText = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString("sl-SI", { day: "numeric", month: "numeric" });

// Worker's answer for today: is the order done (DA) or not (NE), plus a note. Saves by itself.
// DA is only saved once this worker has at least one photo of the finished work (kind KONCANO).
export default function DayStatusCard({
  order,
  running,
}: {
  order: WorkOrderDetail;
  running: boolean;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const today = todayKey();
  const hasFinalPhoto = order.photos.some((p) => p.kind === "KONCANO" && p.userId === user!.id);
  const todayRow = order.dayStatuses.find((s) => s.date.slice(0, 10) === today);
  const earlier = order.dayStatuses.find((s) => s.date.slice(0, 10) !== today);

  const [done, setDone] = useState<boolean | null>(todayRow?.done ?? null);
  const [note, setNote] = useState(todayRow?.note ?? "");
  const [save, setSave] = useState<Save>("idle");
  const [error, setError] = useState("");
  // DA was chosen but is waiting for the first photo of the finished work.
  const [needsPhoto, setNeedsPhoto] = useState(false);
  const noteRef = useRef(note);
  useEffect(() => {
    noteRef.current = note;
  });

  const timer = useRef<number | null>(null);
  const seq = useRef(0);
  const clientId = useRef(crypto.randomUUID());

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  async function persist(nextDone: boolean, nextNote: string) {
    const mine = ++seq.current;
    setSave("saving");
    setError("");
    try {
      await api(`/work-orders/${order.id}/day-status`, {
        method: "PATCH",
        body: JSON.stringify({ id: clientId.current, done: nextDone, note: nextNote.trim() || null }),
      });
      if (mine !== seq.current) return;
      setSave("saved");
      qc.invalidateQueries({ queryKey: ["order", order.id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["active"] });
    } catch (e) {
      if (mine !== seq.current) return;
      setSave("error");
      setError(e instanceof Error ? e.message : "");
    }
  }

  function changeNote(v: string, now: boolean) {
    setNote(v);
    if (timer.current) window.clearTimeout(timer.current);
    if (done === null || needsPhoto) return;
    if (done === false && !v.trim()) {
      setSave("idle");
      return;
    }
    if (now) void persist(done, v);
    else timer.current = window.setTimeout(() => void persist(done, v), 1000);
  }

  async function choose(value: boolean) {
    if (timer.current) window.clearTimeout(timer.current);
    if (value === done) return;
    if (value) {
      if (running) {
        const ok = window.confirm("Delo še poteka. Končam delo in zaključim nalog?");
        if (!ok) return;
        try {
          await api("/time/end", {
            method: "POST",
            body: JSON.stringify({ at: new Date().toISOString() }),
          });
        } catch (e) {
          setSave("error");
          setError(e instanceof Error ? e.message : "");
          return;
        }
      }
      setDone(true);
      if (hasFinalPhoto) {
        void persist(true, note);
      } else {
        setNeedsPhoto(true);
        setSave("idle");
      }
    } else {
      setNeedsPhoto(false);
      setDone(false);
      if (note.trim()) void persist(false, note);
      else setSave("idle");
    }
  }

  const closed = order.status === "ZAKLJUCEN";

  return (
    <div className="section panel dstatus">
      <h3 className="panel-title">Zaključen nalog</h3>
      <div className="yn" role="group" aria-label="Zaključen nalog">
        <button
          type="button"
          className={done === true ? "yn-btn yes on" : "yn-btn yes"}
          aria-pressed={done === true}
          onClick={() => void choose(true)}
        >
          {done === true && <IconCheck size={22} />}
          DA
        </button>
        <button
          type="button"
          className={done === false ? "yn-btn no on" : "yn-btn no"}
          aria-pressed={done === false}
          onClick={() => void choose(false)}
        >
          NE
        </button>
      </div>

      {done === null && earlier && (
        <p className="hint">
          Zadnji vnos, {dayText(earlier.date.slice(0, 10))}: {earlier.done ? "narejeno" : "ni narejeno"}
          {earlier.note ? `. ${earlier.note}` : ""}
        </p>
      )}

      {done === true && needsPhoto && (
        <div className="ds-needs-photo">
          <p>
            <b>Dodaj fotografijo končanega dela.</b> Nalog se zaključi, ko se prva fotografija naloži.
          </p>
          <PhotoSection
            orderId={order.id}
            photos={order.photos}
            kind="KONCANO"
            compact
            onUploaded={() => {
              setNeedsPhoto(false);
              void persist(true, noteRef.current);
            }}
          />
        </div>
      )}

      {done !== null && (
        <div className="ds-note">
          <label className="field">
            {done ? "Opomba (neobvezno)" : "Zakaj ni narejeno in kaj ostane"}
            <textarea
              value={note}
              onChange={(e) => changeNote(e.target.value, false)}
              required={!done}
              aria-invalid={!done && !note.trim()}
              placeholder={
                done ? "Npr. vse pritrjeno, ostanek materiala je v skladišču." : "Npr. manjka 10 vijakov, jutri dokončamo."
              }
            />
          </label>
          <VoiceButton value={note} onChange={(v) => changeNote(v, true)} />
          {!done && !note.trim() && <p className="hint">Brez razloga se stanje NE ne shrani.</p>}
          <p className={`save-state ${save}`} role="status" aria-live="polite">
            {save === "saving" && "Shranjujem..."}
            {save === "saved" && "Shranjeno"}
            {save === "error" && `Napaka, poskusi znova${error ? `: ${error}` : ""}`}
          </p>
        </div>
      )}
      {done === null && save === "error" && <p className="error">{error}</p>}

      {done === false && <p className="hint">Nalog ostane odprt in se prenese na naslednji dan.</p>}
      {closed && done === true && (
        <p className="hint">Nalog je zaključen. Opombo in fotografije lahko še dopolnjuješ.</p>
      )}
      {!closed && done === true && !needsPhoto && save === "saved" && (
        <p className="hint">Čakamo še na ostale delavce na tem nalogu.</p>
      )}
    </div>
  );
}
