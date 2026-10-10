import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import StatusChip from "../components/StatusChip";
import ReportView from "../components/ReportView";
import { formatTime, plannedText } from "../format";
import type { DailyReportData, PhotoKind, WorkOrderDetail } from "../types";

const KIND_LABEL: Record<PhotoKind, string> = {
  PRED: "Pred",
  MED: "Med delom",
  KONCANO: "Končano",
  PROBLEM: "Problem",
};

const todayKey = () => new Date().toLocaleDateString("sv-SE");

export default function ManagerOrder() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const date = sp.get("date") ?? todayKey();

  const orderQ = useQuery({
    queryKey: ["order", id],
    queryFn: () => api<WorkOrderDetail>(`/work-orders/${id}`),
  });
  const workerId = orderQ.data?.worker.id;
  const reportQ = useQuery({
    queryKey: ["report", workerId, date],
    enabled: !!workerId,
    queryFn: () => api<DailyReportData>(`/reports?userId=${workerId}&date=${date}`),
  });

  if (orderQ.isLoading) return <div className="page">Nalaganje...</div>;
  if (orderQ.error || !orderQ.data) {
    return <div className="page error">{orderQ.error?.message ?? "Naloge ni"}</div>;
  }

  const o = orderQ.data;
  const hoursOf = (s: string, e: string) =>
    (new Date(e).getTime() - new Date(s).getTime()) / 3600000;
  const total = o.timeEntries
    .filter((e) => e.endedAt)
    .reduce((s, e) => s + hoursOf(e.startedAt, e.endedAt!), 0);
  const lastNote = [...o.workLogs].reverse().find((l) => l.note)?.note;
  const dateText = new Date(date).toLocaleDateString("sl-SI", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });

  return (
    <div className="mdetail">
      <div className="detail-top">
        <Link to="/" className="back">
          ‹
        </Link>
        <h1>Nalog {o.number}</h1>
        <StatusChip status={o.status} />
      </div>

      {o.status === "PROBLEM" && (
        <div className="banner-problem">
          <strong>Delavec je prijavil težavo.</strong>
          {lastNote && <div>{lastNote}</div>}
        </div>
      )}

      <div className="section">
        <h2 className="project">{o.project.name}</h2>
        <p className="muted">
          {o.project.location}, delavec {o.worker.name}
        </p>
        <p>{o.description}</p>
      </div>

      <div className="section info">
        <small>Planirano</small>
        <strong>{plannedText(o) || "Ni podatka"}</strong>
      </div>

      <div className="entries">
        <h3>Evidenca ur</h3>
        {o.timeEntries.length === 0 && <p className="muted">Delo še ni začeto.</p>}
        {o.timeEntries.map((e) => (
          <div key={e.id} className="entry-row">
            <span>
              {new Date(e.startedAt).toLocaleDateString("sl-SI", { day: "numeric", month: "numeric" })}
              , {formatTime(e.startedAt)} do {e.endedAt ? formatTime(e.endedAt) : "poteka"}
            </span>
            <b>{e.endedAt ? hoursOf(e.startedAt, e.endedAt).toFixed(2) + " h" : ""}</b>
          </div>
        ))}
        {o.timeEntries.length > 0 && (
          <div className="entry-row">
            <span>Skupaj</span>
            <b>{total.toFixed(2)} h</b>
          </div>
        )}
      </div>

      <div className="section">
        <h3>Kaj je bilo narejeno</h3>
        {o.workLogs.length === 0 && <p className="muted">Ni vnosov.</p>}
        <div className="logs">
          {o.workLogs.map((l) => {
            const isProblem = l.description === "Prijavljena težava";
            return (
              <div key={l.id} className={isProblem ? "log-card problem" : "log-card"}>
                <div className="log-head">
                  <span>
                    {isProblem ? "Težava, " : ""}
                    {formatTime(l.createdAt)}
                  </span>
                  {l.quantity != null && (
                    <b className="qty">
                      {l.quantity} {l.unit}
                    </b>
                  )}
                </div>
                {!isProblem && <p>{l.description}</p>}
                {l.note && (
                  <div className="log-note">{isProblem ? l.note : `Opomba: ${l.note}`}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="section">
        <h3>Material</h3>
        {o.materials.map((m) => (
          <div key={m.id} className="kv">
            <span>{m.name}</span>
            <b>{m.usedQty ?? "-"}</b>
          </div>
        ))}
      </div>

      <div className="section">
        <h3>Fotografije</h3>
        {o.photos.length === 0 && <p className="muted">Ni fotografij.</p>}
        <div className="thumbs">
          {o.photos.map((p) => (
            <div key={p.id} className="thumb">
              <a href={p.path} target="_blank" rel="noreferrer">
                <img src={p.path} alt={KIND_LABEL[p.kind]} />
              </a>
              <small>
                {KIND_LABEL[p.kind]}, {formatTime(p.takenAt)}
              </small>
            </div>
          ))}
        </div>
      </div>

      <h2 className="rep-title">Dnevno poročilo, {dateText}</h2>
      {reportQ.isLoading && <p className="muted section">Nalaganje...</p>}
      {reportQ.error && <p className="error section">{reportQ.error.message}</p>}
      {reportQ.data && (
        <>
          <p className={reportQ.data.status === "ODDANO" ? "submitted ok" : "submitted"}>
            {reportQ.data.status === "ODDANO" && reportQ.data.submittedAt
              ? `Oddano ob ${formatTime(reportQ.data.submittedAt)}`
              : "Delavec poročila še ni oddal"}
          </p>
          <ReportView report={reportQ.data} />
        </>
      )}
    </div>
  );
}