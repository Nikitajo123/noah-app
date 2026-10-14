import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { formatTime } from "../format";
import type { TimeEntry } from "../types";

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const dayText = (iso: string) =>
  new Date(iso).toLocaleDateString("sl-SI", { day: "numeric", month: "numeric" });
const hoursOf = (s: string, e: string) =>
  (new Date(e).getTime() - new Date(s).getTime()) / 3600000;

export default function TimeEntryRow({ entry, orderId }: { entry: TimeEntry; orderId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");

  const save = useMutation({
    mutationFn: () =>
      api(`/time-entries/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          startedAt: new Date(start).toISOString(),
          endedAt: new Date(end).toISOString(),
          reason: reason.trim(),
        }),
      }),
    onSuccess: () => {
      setOpen(false);
      setReason("");
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      qc.invalidateQueries({ queryKey: ["report"] });
      qc.invalidateQueries({ queryKey: ["day-reports"] });
    },
  });

  function begin() {
    setStart(toLocalInput(entry.startedAt));
    setEnd(toLocalInput(entry.endedAt ?? new Date().toISOString()));
    setReason("");
    save.reset();
    setOpen(true);
  }

  const edits = entry.edits ?? [];

  return (
    <div className="te">
      <div className="entry-row">
        <span>
          {entry.user?.name}, {dayText(entry.startedAt)}, {formatTime(entry.startedAt)} do{" "}
          {entry.endedAt ? formatTime(entry.endedAt) : "poteka"}
        </span>
        <b>{entry.endedAt ? hoursOf(entry.startedAt, entry.endedAt).toFixed(2) + " h" : ""}</b>
      </div>

      {!open && (
        <div className="te-actions">
          <button type="button" className="btn-mini neutral" onClick={begin}>
            Popravi
          </button>
          {edits.length > 0 && <span className="te-fixed">Popravljeno</span>}
        </div>
      )}

      {open && (
        <div className="te-edit">
          <label className="field">
            Začetek
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="field">
            Konec
            <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <label className="field">
            Razlog popravka
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Delavec je pozabil končati delo."
            />
          </label>
          {save.error && <p className="error">{save.error.message}</p>}
          <button
            type="button"
            className="btn-primary"
            disabled={save.isPending || !start || !end || reason.trim().length < 3}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Shranjujem..." : "Shrani popravek"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
            Prekliči
          </button>
        </div>
      )}

      {edits.length > 0 && (
        <div className="te-hist">
          {edits.map((x) => (
            <p key={x.id}>
              {x.editedBy.name}, {dayText(x.createdAt)} {formatTime(x.createdAt)}:{" "}
              {formatTime(x.oldStartedAt)} do {x.oldEndedAt ? formatTime(x.oldEndedAt) : "poteka"}
              {" → "}
              {formatTime(x.newStartedAt)} do {formatTime(x.newEndedAt)}. Razlog: {x.reason}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}