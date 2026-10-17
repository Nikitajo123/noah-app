import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { EmptyState, Skeleton } from "./States";
import type { Team } from "../types";

type Worker = { id: string; name: string };

export default function TeamsAdmin() {
  const qc = useQueryClient();
  const teams = useQuery({ queryKey: ["teams"], queryFn: () => api<Team[]>("/teams") });
  const workers = useQuery({ queryKey: ["workers"], queryFn: () => api<Worker[]>("/workers") });

  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [foremanId, setForemanId] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [done, setDone] = useState("");

  const toggle = (id: string) =>
    setMemberIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  function reset() {
    setEditId(null);
    setName("");
    setForemanId("");
    setMemberIds([]);
  }

  function refresh() {
    qc.invalidateQueries({ queryKey: ["teams"] });
    qc.invalidateQueries({ queryKey: ["team-day"] });
    qc.invalidateQueries({ queryKey: ["team-report"] });
    qc.invalidateQueries({ queryKey: ["my-team"] });
  }

  const save = useMutation({
    mutationFn: () => {
      const body = JSON.stringify({
        name: name.trim(),
        foremanId,
        memberIds: [...new Set([...memberIds, foremanId])],
      });
      return editId
        ? api(`/teams/${editId}`, { method: "PUT", body })
        : api("/teams", { method: "POST", body });
    },
    onSuccess: () => {
      setDone(editId ? "Ekipa shranjena" : "Ekipa ustvarjena");
      reset();
      refresh();
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => api(`/teams/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });

  function edit(t: Team) {
    setDone("");
    save.reset();
    setEditId(t.id);
    setName(t.name);
    setForemanId(t.foreman.id);
    setMemberIds(t.members.map((m) => m.id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setDone("");
    save.mutate();
  }

  return (
    <>
      <form onSubmit={submit}>
        {done && <div className="okmsg">{done}</div>}
        <label className="field">
          Ime ekipe
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ekipa 1" />
        </label>
        <label className="field">
          Delovodja
          <select value={foremanId} onChange={(e) => setForemanId(e.target.value)}>
            <option value="">Izberi delovodjo</option>
            {workers.data?.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="checks">
          <legend>Člani ekipe</legend>
          {workers.data?.map((w) => (
            <label key={w.id} className="check">
              <input
                type="checkbox"
                checked={memberIds.includes(w.id) || w.id === foremanId}
                disabled={w.id === foremanId}
                onChange={() => toggle(w.id)}
              />
              {w.name}
              {w.id === foremanId && <small className="muted"> (delovodja)</small>}
            </label>
          ))}
        </fieldset>
        <p className="hint">Delavec je lahko samo v eni ekipi. Če ga izbereš, se premakne iz stare.</p>
        {save.error && <p className="error">{save.error.message}</p>}
        <button className="btn-primary" disabled={save.isPending || !name.trim() || !foremanId}>
          {save.isPending ? "Shranjujem..." : editId ? "Shrani ekipo" : "Ustvari ekipo"}
        </button>
        {editId && (
          <button type="button" className="btn-secondary" onClick={reset}>
            Prekliči urejanje
          </button>
        )}
      </form>

      <div className="adm-list">
      <h3>Ekipe</h3>
      {teams.isLoading && <Skeleton rows={2} variant="line" />}
      {teams.data?.length === 0 && <EmptyState>Ni ekip.</EmptyState>}
      {del.error && <p className="error">{del.error.message}</p>}
      {teams.data?.map((t) => (
        <div key={t.id} className="arow">
          <div>
            <b>{t.name}</b>
            <br />
            <small className="muted">
              Delovodja {t.foreman.name}. Člani: {t.members.map((m) => m.name).join(", ")}
            </small>
          </div>
          <button type="button" className="btn-mini neutral" onClick={() => edit(t)}>
            Uredi
          </button>
          <button
            type="button"
            className="btn-mini"
            disabled={del.isPending}
            onClick={() => {
              if (window.confirm(`Izbrišem ekipo ${t.name}? Poročila ekipe se izbrišejo.`)) {
                del.mutate(t.id);
              }
            }}
          >
            Izbriši
          </button>
        </div>
      ))}
      </div>
    </>
  );
}