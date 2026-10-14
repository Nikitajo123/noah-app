import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, downloadPdf } from "../api";
import TeamReportView from "../components/TeamReportView";
import { EmptyState, Skeleton } from "../components/States";
import { IconAlert, IconCheck, IconDownload, IconEdit } from "../components/Icons";
import { formatHours, formatTime } from "../format";
import type { ProjectHoursData, TeamDayRow, TeamReportData } from "../types";

const todayKey = () => new Date().toLocaleDateString("sv-SE");
const shift = (key: string, days: number) => {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("sv-SE");
};
const weekStart = () => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toLocaleDateString("sv-SE");
};
const monthStart = () => {
  const d = new Date();
  d.setDate(1);
  return d.toLocaleDateString("sv-SE");
};

function TeamDetail({ teamId, date }: { teamId: string; date: string }) {
  const q = useQuery({
    queryKey: ["team-report", teamId, date],
    queryFn: () => api<TeamReportData>(`/team-reports?teamId=${teamId}&date=${date}`),
  });
  const pdf = useMutation({
    mutationFn: () =>
      downloadPdf(`/team-reports/pdf?teamId=${teamId}&date=${date}`, `porocilo-ekipe-${date}.pdf`),
  });
  if (q.isLoading) return <Skeleton rows={2} />;
  if (q.error || !q.data) return <p className="error">{q.error?.message ?? "Napaka"}</p>;
  return (
    <>
      <div className="section">
        <button className="btn-secondary" disabled={pdf.isPending} onClick={() => pdf.mutate()}>
          <IconDownload size={20} />
          {pdf.isPending ? "Pripravljam PDF..." : "Prenesi PDF ekipe"}
        </button>
        {pdf.error && <p className="error">{pdf.error.message}</p>}
      </div>
      <TeamReportView report={q.data} />
    </>
  );
}

function ByTeams() {
  const [date, setDate] = useState(todayKey());
  const [open, setOpen] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["team-day", date],
    queryFn: () => api<TeamDayRow[]>(`/team-reports/day?date=${date}`),
    refetchOnWindowFocus: true,
  });

  const rows = q.data ?? [];
  const submitted = rows.filter((r) => r.status === "ODDANO").length;
  const hours = rows.reduce((s, r) => s + r.totalHours, 0);
  const isToday = date >= todayKey();

  function go(d: string) {
    setDate(d);
    setOpen(null);
  }

  return (
    <>
      <div className="tr-nav">
        <button type="button" aria-label="Prejšnji dan" onClick={() => go(shift(date, -1))}>
          ‹
        </button>
        <input
          type="date"
          value={date}
          max={todayKey()}
          onChange={(e) => e.target.value && go(e.target.value)}
        />
        <button
          type="button"
          aria-label="Naslednji dan"
          disabled={isToday}
          onClick={() => go(shift(date, 1))}
        >
          ›
        </button>
        {!isToday && (
          <button type="button" className="today" onClick={() => go(todayKey())}>
            Danes
          </button>
        )}
      </div>

      <div className="kpis">
        <div className="kpi">
          <small>Ekipe</small>
          <b>{rows.length}</b>
        </div>
        <div className="kpi">
          <small>Oddana poročila</small>
          <b>
            {submitted}/{rows.length}
          </b>
        </div>
        <div className="kpi">
          <small>Ure skupaj</small>
          <b>{formatHours(hours)}</b>
        </div>
      </div>

      {q.isLoading && (
        <div className="section">
          <Skeleton rows={2} />
        </div>
      )}
      {q.error && <p className="error section">{q.error.message}</p>}
      {q.data && rows.length === 0 && (
        <EmptyState>Ni ekip. Ustvari jih v Upravljanje, zavihek Ekipe.</EmptyState>
      )}

      <div className="tr-list">
        {rows.map((r) => (
          <div key={r.teamId} className={open === r.teamId ? "tr-card open" : "tr-card"}>
            <button
              type="button"
              className="tr-head"
              aria-expanded={open === r.teamId}
              onClick={() => setOpen(open === r.teamId ? null : r.teamId)}
            >
              <div>
                <b>{r.name}</b>
                <small className="muted">
                  Delovodja {r.foreman}, {r.members} članov, {r.orders}{" "}
                  {r.orders === 1 ? "nalog" : "nalogov"}
                </small>
              </div>
              <div className="tr-side">
                {r.problem && (
                  <span className="tr-problem" title="Problem">
                    <IconAlert />
                  </span>
                )}
                <b className="num">{formatHours(r.totalHours)}</b>
                <small className={r.status === "ODDANO" ? "tr-ok" : "muted"}>
                  {r.status === "ODDANO" && r.submittedAt ? (
                    <>
                      <IconCheck size={14} /> Oddano {formatTime(r.submittedAt)}
                    </>
                  ) : (
                    <>
                      <IconEdit size={14} /> Osnutek
                    </>
                  )}
                </small>
              </div>
            </button>
            {open === r.teamId && <TeamDetail teamId={r.teamId} date={date} />}
          </div>
        ))}
      </div>
    </>
  );
}

function ByProjects() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayKey());
  const [open, setOpen] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["project-hours", from, to],
    queryFn: () => api<ProjectHoursData>(`/project-hours?from=${from}&to=${to}`),
    enabled: from <= to,
  });

  const data = q.data;
  const max = Math.max(1, ...(data?.projects.map((p) => p.hours) ?? [0]));

  return (
    <>
      <div className="tr-range">
        <div className="tr-presets">
          <button type="button" onClick={() => { setFrom(todayKey()); setTo(todayKey()); }}>
            Danes
          </button>
          <button type="button" onClick={() => { setFrom(weekStart()); setTo(todayKey()); }}>
            Ta teden
          </button>
          <button type="button" onClick={() => { setFrom(monthStart()); setTo(todayKey()); }}>
            Ta mesec
          </button>
        </div>
        <div className="tr-dates">
          <label>
            Od
            <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          </label>
          <label>
            Do
            <input type="date" value={to} min={from} max={todayKey()} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="kpis two">
        <div className="kpi">
          <small>Ure skupaj</small>
          <b>{formatHours(data?.totalHours ?? 0)}</b>
        </div>
        <div className="kpi">
          <small>Projekti z delom</small>
          <b>{data?.projects.length ?? 0}</b>
        </div>
      </div>

      {q.isLoading && (
        <div className="section">
          <Skeleton rows={2} />
        </div>
      )}
      {q.error && <p className="error section">{q.error.message}</p>}
      {data && data.projects.length === 0 && (
        <EmptyState>V izbranem obdobju ni zaključenih ur.</EmptyState>
      )}

      <div className="tr-list">
        {data?.projects.map((p) => (
          <div key={p.projectId} className={open === p.projectId ? "tr-card open" : "tr-card"}>
            <button
              type="button"
              className="tr-head"
              aria-expanded={open === p.projectId}
              onClick={() => setOpen(open === p.projectId ? null : p.projectId)}
            >
              <div className="tr-grow">
                <b>{p.name}</b>
                <small className="muted">
                  {p.location}, {p.orders} {p.orders === 1 ? "nalog" : "nalogov"}
                </small>
                <div className="tr-bar">
                  <i style={{ width: `${Math.max(4, (p.hours / max) * 100)}%` }} />
                </div>
              </div>
              <b className="num">{formatHours(p.hours)}</b>
            </button>
            {open === p.projectId && (
              <div className="tr-people">
                {p.workers.map((w) => (
                  <div key={w.name} className="tr-wrow">
                    <span>{w.name}</span>
                    <b>{formatHours(w.hours)}</b>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

export default function Reports() {
  const [tab, setTab] = useState<"teams" | "projects">("teams");
  return (
    <>
      <header className="top">
        <h1>Poročila</h1>
        <p>Poročila ekip in ure po projektih</p>
      </header>
      <div className="seg">
        <button className={tab === "teams" ? "on" : ""} onClick={() => setTab("teams")}>
          Po ekipah
        </button>
        <button className={tab === "projects" ? "on" : ""} onClick={() => setTab("projects")}>
          Ure po projektih
        </button>
      </div>
      {tab === "teams" ? <ByTeams /> : <ByProjects />}
    </>
  );
}