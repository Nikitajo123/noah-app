import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { useAuth } from "../auth";
import { EmptyState, Skeleton } from "./States";
import { IconCheck } from "./Icons";
import type { ManagerRef, Project, Role } from "../types";

type ManagerRole = Extract<Role, "VODJA_GRADBISC" | "VODJA_DEL">;

function ManagersPicker({
  project,
  role,
  people,
  onDone,
}: {
  project: Project;
  role: ManagerRole;
  people: ManagerRef[];
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const current = (project.managers ?? []).filter((m) => m.role === role).map((m) => m.id);
  const [picked, setPicked] = useState<string[]>(current);
  const save = useMutation({
    mutationFn: () =>
      api(`/projects/${project.id}/managers`, {
        method: "PUT",
        body: JSON.stringify({ role, userIds: picked }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      onDone();
    },
  });
  const list = people.filter((p) => p.role === role);
  const toggle = (id: string) =>
    setPicked((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="pa-pick">
      <fieldset className="checks">
        <legend>{role === "VODJA_DEL" ? "Vodje del na gradbišču" : "Vodje gradbišč na gradbišču"}</legend>
        {list.length === 0 && <p className="muted">Ni uporabnikov s to vlogo.</p>}
        {list.map((p) => (
          <label key={p.id} className="check">
            <input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} />
            {p.name}
          </label>
        ))}
      </fieldset>
      {save.error && <p className="error">{save.error.message}</p>}
      <div className="pa-actions">
        <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Shranjujem..." : "Shrani"}
        </button>
        <button className="btn-secondary" onClick={onDone}>
          Prekliči
        </button>
      </div>
    </div>
  );
}

function ProjectRow({ project, people }: { project: Project; people: ManagerRef[] }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user!.role === "VODJA";
  const [mode, setMode] = useState<"" | "edit" | "VODJA_DEL" | "VODJA_GRADBISC">("");
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
      setMode("");
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/projects/${project.id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  const names = (role: Role) =>
    (project.managers ?? [])
      .filter((m) => m.role === role)
      .map((m) => m.name)
      .join(", ") || "nihče";
  const orders = project._count?.workOrders ?? 0;

  return (
    <div className="pa-row">
      <div className="pa-head">
        <div>
          <b>{project.name}</b>, {project.location}
          <p className="muted">
            Vodje gradbišč: {names("VODJA_GRADBISC")}. Vodje del: {names("VODJA_DEL")}. Nalogi: {orders}.
          </p>
        </div>
      </div>

      {mode === "" && (
        <div className="pa-actions">
          <button className="btn-mini neutral" onClick={() => setMode("edit")}>
            Uredi
          </button>
          <button className="btn-mini neutral" onClick={() => setMode("VODJA_DEL")}>
            Vodje del
          </button>
          {isAdmin && (
            <button className="btn-mini neutral" onClick={() => setMode("VODJA_GRADBISC")}>
              Vodje gradbišč
            </button>
          )}
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

      {mode === "edit" && (
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
            <button className="btn-secondary" onClick={() => setMode("")}>
              Prekliči
            </button>
          </div>
        </div>
      )}
      {(mode === "VODJA_DEL" || mode === "VODJA_GRADBISC") && (
        <ManagersPicker project={project} role={mode} people={people} onDone={() => setMode("")} />
      )}
    </div>
  );
}

export default function ProjectsAdmin() {
  const qc = useQueryClient();
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => api<Project[]>("/projects") });
  const people = useQuery({
    queryKey: ["managers"],
    queryFn: () => api<ManagerRef[]>("/workers/managers"),
  });
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
          <ProjectRow key={p.id} project={p} people={people.data ?? []} />
        ))}
      </div>
    </>
  );
}
