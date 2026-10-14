import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import StatusChip from "../components/StatusChip";
import type { Project, WorkOrder } from "../types";
import { EmptyState, Skeleton } from "../components/States";
import { IconCheck } from "../components/Icons";
import TeamsAdmin from "../components/TeamsAdmin";
import ResetPassword from "../components/ResetPassword";

type Tab = "order" | "orders" | "project" | "user" | "teams";
type Worker = { id: string; name: string };
type UserRow = { id: string; name: string; email: string; role: "DELAVEC" | "VODJA" };

const todayKey = () => new Date().toLocaleDateString("sv-SE");

function OrderForm() {
  const qc = useQueryClient();
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => api<Project[]>("/projects") });
  const workers = useQuery({ queryKey: ["workers"], queryFn: () => api<Worker[]>("/workers") });

  const [projectId, setProjectId] = useState("");
  const [workerIds, setWorkerIds] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("kos");
  const [hours, setHours] = useState("");
  const [workDate, setWorkDate] = useState(todayKey());
  const [due, setDue] = useState(todayKey());
  const [materials, setMaterials] = useState("");
  const [done, setDone] = useState("");

  const toggle = (id: string) =>
    setWorkerIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const create = useMutation({
    mutationFn: () =>
      api<WorkOrder>("/work-orders", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          workerIds,
          description: description.trim(),
          ...(qty !== "" ? { plannedQty: Number(qty), plannedUnit: unit } : {}),
          ...(hours !== "" ? { plannedHours: Number(hours) } : {}),
          workDate: `${workDate}T12:00:00`,
          dueDate: `${due}T12:00:00`,
          materials: materials
            .split("\n")
            .map((m) => m.trim())
            .filter(Boolean),
        }),
      }),
    onSuccess: (o) => {
      setDone(`Ustvarjen nalog ${o.number}`);
      setDescription("");
      setQty("");
      setHours("");
      setMaterials("");
      setWorkerIds([]);
      qc.invalidateQueries({ queryKey: ["all-orders"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setDone("");
    create.mutate();
  }

  return (
    <form onSubmit={submit}>
      {done && <div className="okmsg">{done}</div>}
      <label className="field">
        Projekt
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Izberi projekt</option>
          {projects.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}, {p.location}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="checks">
        <legend>Delavci (en ali več)</legend>
        {workers.data?.map((w) => (
          <label key={w.id} className="check">
            <input type="checkbox" checked={workerIds.includes(w.id)} onChange={() => toggle(w.id)} />
            {w.name}
          </label>
        ))}
      </fieldset>
      <label className="field">
        Naloga
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Montaža zunanjih stenskih elementov na severni strani objekta."
        />
      </label>
      <div className="two">
        <label className="field">
          Planirana količina
          <input
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </label>
        <label className="field">
          Enota
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option>kos</option>
            <option>m</option>
            <option>m²</option>
            <option>kg</option>
          </select>
        </label>
      </div>
      <label className="field">
        Predviden čas (ure)
        <input
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
        />
      </label>
      <div className="two">
        <label className="field">
          Datum
          <input
            type="date"
            value={workDate}
            onChange={(e) => e.target.value && setWorkDate(e.target.value)}
          />
        </label>
        <label className="field">
          Rok
          <input type="date" value={due} onChange={(e) => e.target.value && setDue(e.target.value)} />
        </label>
      </div>
      <label className="field">
        Material (ena vrstica na material)
        <textarea
          value={materials}
          onChange={(e) => setMaterials(e.target.value)}
          placeholder={"stenski elementi\nvijaki\ntesnilni material"}
        />
      </label>
      {create.error && <p className="error">{create.error.message}</p>}
      <button
        className="btn-primary"
        disabled={create.isPending || !projectId || workerIds.length === 0 || !description.trim()}
      >
        {create.isPending ? "Ustvarjam..." : "Ustvari nalog"}
      </button>
    </form>
  );
}

function OrdersList() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["all-orders"], queryFn: () => api<WorkOrder[]>("/work-orders") });
  const del = useMutation({
    mutationFn: (id: string) => api(`/work-orders/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-orders"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return (
    <div>
      {q.isLoading && <Skeleton rows={3} variant="line" />}
      {q.data?.length === 0 && <EmptyState>Ni nalogov.</EmptyState>}
      {del.error && <p className="error">{del.error.message}</p>}
      {q.data?.map((o) => (
        <div key={o.id} className="arow">
          <div>
            <b>{o.number}</b>
            <br />
            <small className="muted">
              {o.project.name}, {o.worker.name}
            </small>
          </div>
          <StatusChip status={o.status} />
          <button
            className="btn-mini"
            disabled={del.isPending}
            onClick={() => {
              if (
                window.confirm(
                  `Izbrišem nalog ${o.number}? Izbrišejo se tudi ure, vnosi in fotografije.`
                )
              ) {
                del.mutate(o.id);
              }
            }}
          >
            Izbriši
          </button>
        </div>
      ))}
    </div>
  );
}

function ProjectForm() {
  const qc = useQueryClient();
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
      setDone(`Ustvarjen projekt ${p.name}`);
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
    <form onSubmit={submit}>
      {done && (
        <div className="okmsg" role="status">
          <IconCheck size={18} />
          {done}
        </div>
      )}
      <label className="field">
        Ime projekta
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hiša Horvat" />
      </label>
      <label className="field">
        Lokacija
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Maribor" />
      </label>
      {create.error && <p className="error">{create.error.message}</p>}
      <button className="btn-primary" disabled={create.isPending || !name.trim() || !location.trim()}>
        {create.isPending ? "Ustvarjam..." : "Ustvari projekt"}
      </button>
    </form>
  );
}

function UserForm() {
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<UserRow[]>("/users") });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"DELAVEC" | "VODJA">("DELAVEC");
  const [done, setDone] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api<UserRow>("/users", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, role }),
      }),
    onSuccess: (u) => {
      setDone(`Ustvarjen uporabnik ${u.email}`);
      setName("");
      setEmail("");
      setPassword("");
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["workers"] });
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
          Ime in priimek
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          E-pošta
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="field">
          Geslo (vsaj 8 znakov)
          <input value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
        </label>
        <label className="field">
          Vloga
          <select value={role} onChange={(e) => setRole(e.target.value as "DELAVEC" | "VODJA")}>
            <option value="DELAVEC">Delavec</option>
            <option value="VODJA">Vodja</option>
          </select>
        </label>
        {create.error && <p className="error">{create.error.message}</p>}
        <button
          className="btn-primary"
          disabled={create.isPending || !name.trim() || !email.trim() || password.length < 8}
        >
          {create.isPending ? "Ustvarjam..." : "Ustvari uporabnika"}
        </button>
      </form>
      <h3>Uporabniki</h3>
      {users.data?.map((u) => (
        <div key={u.id} className="arow">
          <div>
            <b>{u.name}</b>
            <br />
            <small className="muted">{u.email}</small>
          </div>
          <small>{u.role === "VODJA" ? "vodja" : "delavec"}</small>
          <ResetPassword userId={u.id} name={u.name} />
        </div>
      ))}
    </>
  );
}

export default function Admin() {
  const [tab, setTab] = useState<Tab>("order");
  const tabs: { id: Tab; label: string }[] = [
    { id: "order", label: "Nov nalog" },
    { id: "orders", label: "Nalogi" },
    { id: "project", label: "Projekt" },
    { id: "user", label: "Uporabnik" },
    { id: "teams", label: "Ekipe" },
  ];

  return (
    <>
      <header className="top">
        <h1>Upravljanje</h1>
        <p>Ustvari naloge, projekte in uporabnike</p>
      </header>
      <div className="seg five">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "on" : ""}
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="admin">
        {tab === "order" && <OrderForm />}
        {tab === "orders" && <OrdersList />}
        {tab === "project" && <ProjectForm />}
        {tab === "user" && <UserForm />}
        {tab === "teams" && <TeamsAdmin />}
      </div>
    </>
  );
}