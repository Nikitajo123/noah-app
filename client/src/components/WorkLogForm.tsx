import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import VoiceButton from "./VoiceButton";
import { IconEdit } from "./Icons";

export default function WorkLogForm({ orderId }: { orderId: string }) {
  const qc = useQueryClient();
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kos");
  const [note, setNote] = useState("");

  const save = useMutation({
    mutationFn: () =>
      api("/logs", {
        method: "POST",
        body: JSON.stringify({
          workOrderId: orderId,
          description: description.trim(),
          ...(quantity !== "" ? { quantity: Number(quantity), unit } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      }),
    onSuccess: () => {
      setDescription("");
      setQuantity("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["order", orderId] });
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (description.trim()) save.mutate();
  }

  return (
    <form className="section panel" onSubmit={submit}>
      <h3 className="panel-title">
        <span className="pt-ic"><IconEdit size={18} /></span>
        Opravljeno delo
      </h3>
      <label className="field">
        Kaj je bilo narejeno
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Montiranih 8 stenskih elementov."
        />
      </label>
      <VoiceButton value={description} onChange={setDescription} />
      <div className="two">
        <label className="field">
          Količina
          <input
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
        <label className="field">
          Enota
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option>kos</option>
            <option>m</option>
            <option>m²</option>
            <option>kg</option>
            <option>ur</option>
          </select>
        </label>
      </div>
      <label className="field">
        Opomba ali problem
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Pri elementu št. 6 manjka pritrdilni material."
        />
      </label>
      <VoiceButton value={note} onChange={setNote} />
      {save.error && <p className="error">{save.error.message}</p>}
      <button className="btn-primary" disabled={save.isPending || !description.trim()}>
        {save.isPending ? "Shranjujem..." : "Shrani vnos"}
      </button>
    </form>
  );
}