import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { useAuth } from "../auth";
import { EmptyState, Skeleton } from "./States";
import { IconCheck } from "./Icons";
import type { Project } from "../types";

function ProjectRow({ project }: { project: Project }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user!.role === "VODJA";
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [location, setLocation] = useState(project.location);

  const update = useMutation({
    mutationFn: () =>
      api(`/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim(), location: location.trim() }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["all-orders"] });
      setEditing(false);
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/projects/${project.id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  const orders = project._count?.workOrders ?? 0;

  return (
    <div className="pa-row">
      <div className="pa-head">
        <div>
          <b>{project.name}</b>, {project.location}
          <p className="muted">Nalogi: {orders}</p>
        </div>
      </div>

      {!editing && (
        <div className="pa-actions">
          <button className="btn-mini neutral" onClick={() => setEditing(true)}>
            Uredi
          </button>
          {isAdmin && (
            <button
              className="btn-mini"
              disabled={remove.isPending || orders > 0}
              title={orders > 0 ? "Gradbišča z nalogi ni mogoče izbrisati" : undefined}
              onClick={() => {
                if (window.confirm(`Izbrišem gradbišče ${project.name}?`)) remove.mutate();
              }}
            >
              Izbriši
            </button>
          )}
        </div>
      )}
      {remove.error && <p className="error">{remove.error.message}</p>}

      {editing && (
        <div className="pa-pick">
          <label className="field">
            Ime gradbišča
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            Lokacija
            <input value={location} onChange={(e) => setLocation(e.target.value)} />
          </label>
          {update.error && <p className="error">{update.error.message}</p>}
          <div className="pa-actions">
            <button
              className="btn-primary"
              disabled={update.isPending || !name.trim() || !location.trim()}
              onClick={() => update.mutate()}
            >
              {update.isPending ? "Shranjujem..." : "Shrani"}
            </button>
            <button className="btn-secondary" onClick={() => setEditing(false)}>
              Prekliči
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectsAdmin() {
  const qc = useQueryClient();
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => api<Project[]>("/projects") });
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [done, setDone] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api<Project>("/projects", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), location: location.trim() }),
      }),
    onSuccess: (p) => {
      setDone(`Ustvarjeno gradbišče ${p.name}`);
      setName("");
      setLocation("");
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setDone("");
    create.mutate();
  }

  return (
    <>
      <form onSubmit={submit}>
        {done && (
          <div className="okmsg" role="status">
            <IconCheck size={18} />
            {done}
          </div>
        )}
        <label className="field">
          Ime gradbišča
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hiša Horvat" />
        </label>
        <label className="field">
          Lokacija
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Maribor" />
        </label>
        {create.error && <p className="error">{create.error.message}</p>}
        <button className="btn-primary" disabled={create.isPending || !name.trim() || !location.trim()}>
          {create.isPending ? "Ustvarjam..." : "Ustvari gradbišče"}
        </button>
      </form>
      <div className="adm-list">
        <h3>Gradbišča</h3>
        {projects.isLoading && <Skeleton rows={2} variant="line" />}
        {projects.error && <p className="error">{projects.error.message}</p>}
        {projects.data?.length === 0 && <EmptyState>Ni gradbišč.</EmptyState>}
        {projects.data?.map((p) => (
          <ProjectRow key={p.id} project={p} />
        ))}
      </div>
    </>
  );
}
