import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Project, WorkOrderDetail } from "../types";

type MaterialRow = { key: string; id?: string; name: string };

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("sv-SE");
const UNITS = ["kos", "m", "m²", "kg"];

// "Uredi nalog": edits every field of an order in any status. The server logs each change.
export default function OrderEditForm({ order, onClose }: { order: WorkOrderDetail; onClose: () => void }) {
  const qc = useQueryClient();
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => api<Project[]>("/projects") });
  const workers = useQuery({
    queryKey: ["workers"],
    queryFn: () => api<{ id: string; name: string }[]>("/workers"),
  });

  const [description, setDescription] = useState(order.description);
  const [projectId, setProjectId] = useState(order.project.id);
  const [qty, setQty] = useState(order.plannedQty?.toString() ?? "");
  const [unit, setUnit] = useState(order.plannedUnit ?? "kos");
  const [hours, setHours] = useState(order.plannedHours?.toString() ?? "");
  const [workDate, setWorkDate] = useState(dayKey(order.workDate));
  const [due, setDue] = useState(dayKey(order.dueDate));
  const [materials, setMaterials] = useState<MaterialRow[]>(
    order.materials.map((m) => ({ key: m.id, id: m.id, name: m.name }))
  );
  const [workerIds, setWorkerIds] = useState(order.workers.map((w) => w.id));

  const save = useMutation({
    mutationFn: () =>
      api(`/work-orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          description: description.trim(),
          projectId,
          plannedQty: qty === "" ? null : Number(qty),
          plannedUnit: qty === "" ? null : unit,
          plannedHours: hours === "" ? null : Number(hours),
          workDate: `${workDate}T12:00:00`,
          dueDate: `${due}T12:00:00`,
          materials: materials
            .filter((m) => m.name.trim())
            .map((m) => ({ ...(m.id ? { id: m.id } : {}), name: m.name.trim() })),
          workerIds,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order", order.id] });
      qc.invalidateQueries({ queryKey: ["all-orders"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      onClose();
    },
  });

  const setMaterial = (key: string, name: string) =>
    setMaterials((list) => list.map((m) => (m.key === key ? { ...m, name } : m)));
  const toggleWorker = (id: string) =>
    setWorkerIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <form className="section panel edit-form" onSubmit={submit}>
      <h3 className="panel-title">Uredi nalog</h3>
      <label className="field">
        Naloga
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="field">
        Gradbišče
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {!projects.data?.some((p) => p.id === projectId) && (
            <option value={projectId}>{order.project.name}</option>
          )}
          {projects.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}, {p.location}
            </option>
          ))}
        </select>
      </label>
      <div className="two">
        <label className="field">
          Planirana količina
          <input type="number" inputMode="decimal" step="any" min="0" value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
        <label className="field">
          Enota
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            {[...new Set([...UNITS, unit])].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        Predviden čas (ure)
        <input type="number" inputMode="decimal" step="any" min="0" value={hours} onChange={(e) => setHours(e.target.value)} />
      </label>
      <div className="two">
        <label className="field">
          Datum
          <input type="date" value={workDate} onChange={(e) => e.target.value && setWorkDate(e.target.value)} />
        </label>
        <label className="field">
          Rok
          <input type="date" value={due} onChange={(e) => e.target.value && setDue(e.target.value)} />
        </label>
      </div>

      <fieldset className="checks">
        <legend>Material</legend>
        {materials.length === 0 && <p className="muted">Ni materiala.</p>}
        {materials.map((m) => (
          <div key={m.key} className="mat-edit">
            <input
              value={m.name}
              aria-label="Ime materiala"
              onChange={(e) => setMaterial(m.key, e.target.value)}
            />
            <button
              type="button"
              className="btn-mini"
              onClick={() => setMaterials((list) => list.filter((x) => x.key !== m.key))}
            >
              Odstrani
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn-mini neutral"
          onClick={() => setMaterials((list) => [...list, { key: crypto.randomUUID(), name: "" }])}
        >
          Dodaj material
        </button>
      </fieldset>

      <fieldset className="checks">
        <legend>Delavci</legend>
        {workers.data?.map((w) => (
          <label key={w.id} className="check">
            <input type="checkbox" checked={workerIds.includes(w.id)} onChange={() => toggleWorker(w.id)} />
            {w.name}
          </label>
        ))}
      </fieldset>

      {save.error && (
        <p className="error" role="alert">
          {save.error.message}
        </p>
      )}
      <button
        className="btn-primary"
        disabled={save.isPending || !description.trim() || workerIds.length === 0}
      >
        {save.isPending ? "Shranjujem..." : "Shrani spremembe"}
      </button>
      <button type="button" className="btn-secondary" disabled={save.isPending} onClick={onClose}>
        Prekliči
      </button>
    </form>
  );
}
