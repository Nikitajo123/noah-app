import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api";
import StatusChip from "../components/StatusChip";
import { STATUS_LABEL, formatHours, formatTime } from "../format";
import type { OverviewRow, Project, Status } from "../types";

const todayKey = () => new Date().toLocaleDateString("sv-SE");

export default function ManagerOverview() {
  const [date, setDate] = useState(todayKey());
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState<"" | Status>("");

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<Project[]>("/projects"),
  });
  const q = useQuery({
    queryKey: ["overview", date, projectId],
    queryFn: () =>
      api<OverviewRow[]>(`/overview?date=${date}${projectId ? `&projectId=${projectId}` : ""}`),
    refetchInterval: 30000,
  });

  const rows = (q.data ?? []).filter((r) => !status || r.status === status);
  const working = rows.filter((r) => r.arrival && !r.departure).length;
  const hours = rows.reduce((s, r) => s + (r.hours ?? 0), 0);
  const problems = rows.filter((r) => r.status === "PROBLEM").length;

  const arrival = (r: OverviewRow) => (r.arrival ? formatTime(r.arrival) : "-");
  const departure = (r: OverviewRow) =>
    r.departure ? formatTime(r.departure) : r.arrival ? "poteka" : "-";
  const hoursText = (r: OverviewRow) => (r.hours != null ? formatHours(r.hours) : "-");
  const link = (r: OverviewRow) => `/nalog/${r.workOrderId}?date=${date}`;

  return (
    <>
      <header className="top">
        <h1>Pregled dela</h1>
        <p>Stanje na objektih</p>
      </header>

      <div className="filters">
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Vsi projekti</option>
          {projects.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as "" | Status)}>
          <option value="">Vsi statusi</option>
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="kpis">
        <div className="kpi">
          <small>Delavci na delu</small>
          <b>{working}</b>
        </div>
        <div className="kpi">
          <small>Ure</small>
          <b>{formatHours(hours)}</b>
        </div>
        <div className={problems > 0 ? "kpi red" : "kpi"}>
          <small>Problemi</small>
          <b>{problems}</b>
        </div>
      </div>

      {q.isLoading && <p className="muted section">Nalaganje...</p>}
      {q.error && <p className="error section">{q.error.message}</p>}
      {q.data && rows.length === 0 && <p className="muted section">Ni nalogov za ta dan.</p>}

      <div className="otable">
        <div className="orow head">
          <span>Delavec</span>
          <span>Objekt</span>
          <span>Delovni nalog</span>
          <span>Prihod</span>
          <span>Odhod</span>
          <span>Ure</span>
          <span>Status</span>
        </div>
        {rows.map((r) => (
          <Link key={r.workOrderId} to={link(r)} className="orow">
            <b>{r.worker.name}</b>
            <span>{r.project.name}</span>
            <span>{r.number}</span>
            <span>{arrival(r)}</span>
            <span>{departure(r)}</span>
            <span>{hoursText(r)}</span>
            <StatusChip status={r.status} />
          </Link>
        ))}
      </div>

      <div className="ocards">
        {rows.map((r) => (
          <Link key={r.workOrderId} to={link(r)} className="card" data-status={r.status}>
            <div className="card-top">
              <b>{r.worker.name}</b>
              <StatusChip status={r.status} />
            </div>
            <h3>{r.project.name}</h3>
            <p>Nalog {r.number}</p>
            <div className="card-bottom">
              <span>
                {arrival(r)} do {departure(r)}
              </span>
              <b>{hoursText(r)}</b>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}