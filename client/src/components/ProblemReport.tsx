import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { compressImage } from "../image";
import { IconAlert, IconCamera, IconCheck } from "./Icons";

export default function ProblemReport({ orderId }: { orderId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const ids = useRef({ log: crypto.randomUUID(), photo: crypto.randomUUID() });

  const send = useMutation({
    mutationFn: async () => {
      await api("/logs", {
        method: "POST",
        body: JSON.stringify({
          id: ids.current.log,
          workOrderId: orderId,
          description: "Prijavljena težava",
          note: note.trim(),
        }),
      });
      if (file) {
        const fd = new FormData();
        fd.append("id", ids.current.photo);
        fd.append("workOrderId", orderId);
        fd.append("kind", "PROBLEM");
        fd.append("takenAt", new Date().toISOString());
        fd.append("photo", await compressImage(file));
        await api("/photos", { method: "POST", body: fd });
      }
      await api(`/work-orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "PROBLEM" }),
      });
    },
    onSuccess: () => {
      ids.current = { log: crypto.randomUUID(), photo: crypto.randomUUID() };
      setOpen(false);
      setNote("");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  if (!open) {
    return (
      <button className="btn-danger" onClick={() => setOpen(true)}>
        <IconAlert size={20} />
        Prijavi težavo
      </button>
    );
  }

  return (
    <div className="problem-box">
      <h3>Prijava težave</h3>
      <label className="field">
        Kaj je narobe
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Pri elementu št. 6 manjka pritrdilni material."
          autoFocus
        />
      </label>
      <label className={file ? "tile wide added" : "tile wide"}>
        {file ? <IconCheck size={26} /> : <IconCamera size={26} />}
        {file ? "Fotografija dodana" : "Dodaj fotografijo problema"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {send.error && <p className="error">{send.error.message}</p>}
      <button
        className="btn-danger-fill"
        disabled={send.isPending || !note.trim()}
        onClick={() => send.mutate()}
      >
        {send.isPending ? "Pošiljam..." : "Pošlji vodji"}
      </button>
      <button className="btn-secondary" disabled={send.isPending} onClick={() => setOpen(false)}>
        Prekliči
      </button>
    </div>
  );
}