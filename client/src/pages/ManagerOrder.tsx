import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, downloadPdf } from "../api";
import StatusChip from "../components/StatusChip";
import ReportView from "../components/ReportView";
import PhotoImg from "../components/PhotoImg";
import StatusSteps from "../components/StatusSteps";
import { Skeleton } from "../components/States";
import {
  IconAlert,
  IconBack,
  IconBox,
  IconCamera,
  IconCheck,
  IconClock,
  IconDownload,
  IconEdit,
  IconHistory,
} from "../components/Icons";
import { formatTime, plannedText } from "../format";
import type { DailyReportData, PhotoKind, WorkOrderDetail } from "../types";

const KIND_LABEL: Record<PhotoKind, string> = {
  PRED: "Pred",
  MED: "Med delom",
  KONCANO: "Končano",
  PROBLEM: "Problem",
};

const todayKey = () => new Date().toLocaleDateString("sv-SE");
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("sv-SE");
const dayLabel = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString("sl-SI", { day: "numeric", month: "numeric" });

export default function ManagerOrder() {
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();

  const orderQ = useQuery({
    queryKey: ["order", id],
    queryFn: () => api<WorkOrderDetail>(`/work-orders/${id}`),
  });

  // Days on which the worker recorded anything on this order. Without a date in the
  // link (e.g. from Projekti) the report opens on the last of them, not on today.
  const d = orderQ.data;
  const workDays = d
    ? [
        ...d.timeEntries.map((e) => e.startedAt),
        ...d.workLogs.map((l) => l.createdAt),
        ...d.photos.map((p) => p.takenAt),
      ].map(dayKey)
    : [];
  const date = sp.get("date") ?? workDays.sort().at(-1) ?? todayKey();
  const reportDays = [...new Set([...workDays, date])].sort();
  const workerId = orderQ.data?.worker.id;
  const reportQ = useQuery({
    queryKey: ["report", workerId, date],
    enabled: !!workerId,
    queryFn: () => api<DailyReportData>(`/reports?userId=${workerId}&date=${date}`),
  });

  const pdf = useMutation({
    mutationFn: () =>
      downloadPdf(`/reports/pdf?userId=${workerId}&date=${date}`, `porocilo-${date}.pdf`),
  });

  if (orderQ.isLoading) {
    return (
      <div className="page">
        <Skeleton rows={3} />
      </div>
    );
  }
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
        <Link to="/" className="back" aria-label="Nazaj">
          <IconBack />
        </Link>
        <h1>Nalog {o.number}</h1>
        <StatusChip status={o.status} />
      </div>

      <StatusSteps status={o.status} />

      {o.status === "PROBLEM" && (
        <div className="banner-problem" role="alert">
          <IconAlert />
          <div>
            <strong>Delavec je prijavil težavo.</strong>
            {lastNote && <div>{lastNote}</div>}
          </div>
        </div>
      )}

      <div className="section">
        <h2 className="project">{o.project.name}</h2>
        <p className="muted">
          {o.project.location}, delavec {o.worker.name}
        </p>
        <p className="desc">{o.description}</p>
      </div>

      <div className="info-grid">
        <div className="info">
          <small>Datum in rok</small>
          <strong>
            {new Date(o.workDate).toLocaleDateString("sl-SI")}, rok{" "}
            {new Date(o.dueDate).toLocaleDateString("sl-SI")}
          </strong>
        </div>
        <div className="info">
          <small>Planirano</small>
          <strong>{plannedText(o) || "Ni podatka"}</strong>
        </div>
      </div>

      <div className="section panel">
        <h3 className="panel-title">
          <span className="pt-ic"><IconClock size={18} /></span>
          Evidenca ur
        </h3>
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
          <div className="entry-row total">
            <span>Skupaj</span>
            <b>{total.toFixed(2)} h</b>
          </div>
        )}
      </div>

      <div className="section panel">
        <h3 className="panel-title">
          <span className="pt-ic"><IconHistory size={18} /></span>
          Kaj je bilo narejeno
        </h3>
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

      <div className="section panel">
        <h3 className="panel-title">
          <span className="pt-ic"><IconBox size={18} /></span>
          Material
        </h3>
        {o.materials.map((m) => (
          <div key={m.id} className="kv">
            <span>{m.name}</span>
            <b>{m.usedQty ?? "-"}</b>
          </div>
        ))}
      </div>

      <div className="section panel">
        <h3 className="panel-title">
          <span className="pt-ic"><IconCamera size={18} /></span>
          Fotografije
        </h3>
        {o.photos.length === 0 && <p className="muted">Ni fotografij.</p>}
        <div className="thumbs">
          {o.photos.map((p) => (
            <div key={p.id} className="thumb">
              <PhotoImg path={p.path} alt={KIND_LABEL[p.kind]} />
              <small>
                {KIND_LABEL[p.kind]}, {formatTime(p.takenAt)}
              </small>
            </div>
          ))}
        </div>
      </div>

      <h2 className="rep-title">Dnevno poročilo, {dateText}</h2>
      {reportDays.length > 1 && (
        <div className="day-chips">
          {reportDays.map((k) => (
            <button
              key={k}
              className={k === date ? "on" : ""}
              aria-pressed={k === date}
              onClick={() => setSp({ date: k }, { replace: true })}
            >
              {dayLabel(k)}
            </button>
          ))}
        </div>
      )}
      {reportQ.isLoading && (
        <div className="section">
          <Skeleton rows={1} />
        </div>
      )}
      {reportQ.error && <p className="error section">{reportQ.error.message}</p>}
      {reportQ.data && (
        <>
          <p className={reportQ.data.status === "ODDANO" ? "submitted ok" : "submitted"}>
            {reportQ.data.status === "ODDANO" ? <IconCheck size={16} /> : <IconEdit size={16} />}
            {reportQ.data.status === "ODDANO" && reportQ.data.submittedAt
              ? `Oddano ob ${formatTime(reportQ.data.submittedAt)}`
              : "Delavec poročila še ni oddal"}
          </p>
          <div className="section">
            <button
              className="btn-secondary"
              disabled={pdf.isPending}
              onClick={() => pdf.mutate()}
            >
              <IconDownload size={20} />
              {pdf.isPending ? "Pripravljam PDF..." : "Prenesi PDF"}
            </button>
            {pdf.error && <p className="error">{pdf.error.message}</p>}
          </div>
          <ReportView report={reportQ.data} />
        </>
      )}
    </div>
  );
}