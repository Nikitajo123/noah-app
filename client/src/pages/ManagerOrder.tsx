import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, downloadPdf } from "../api";
import StatusChip from "../components/StatusChip";
import ReportView from "../components/ReportView";
import PhotoImg from "../components/PhotoImg";
import StatusSteps from "../components/StatusSteps";
import ManagerNotes from "../components/ManagerNotes";
import TimeEntryRow from "../components/TimeEntryRow";
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
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [reportUser, setReportUser] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const orderQ = useQuery({
    queryKey: ["order", id],
    queryFn: () => api<WorkOrderDetail>(`/work-orders/${id}`),
  });
  const workersQ = useQuery({
    queryKey: ["workers"],
    queryFn: () => api<{ id: string; name: string }[]>("/workers"),
  });

  const refreshOrder = () => {
    qc.invalidateQueries({ queryKey: ["order", id] });
    qc.invalidateQueries({ queryKey: ["overview"] });
    qc.invalidateQueries({ queryKey: ["all-orders"] });
    qc.invalidateQueries({ queryKey: ["orders"] });
  };

  const saveWorkers = useMutation({
    mutationFn: () =>
      api(`/work-orders/${id}/workers`, {
        method: "PUT",
        body: JSON.stringify({ workerIds: selected }),
      }),
    onSuccess: () => {
      setEditing(false);
      refreshOrder();
    },
  });

  const addNote = useMutation({
    mutationFn: () =>
      api(`/work-orders/${id}/notes`, {
        method: "POST",
        body: JSON.stringify({ text: noteText.trim() }),
      }),
    onSuccess: () => {
      setNoteText("");
      refreshOrder();
    },
  });

  const resolve = useMutation({
    mutationFn: () =>
      api(`/work-orders/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ text: noteText.trim() }),
      }),
    onSuccess: () => {
      setNoteText("");
      refreshOrder();
    },
  });

  // Days on which anyone recorded something on this order. Without a date in the
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

  const reportWorkerId = reportUser ?? d?.workers[0]?.id;
  const reportQ = useQuery({
    queryKey: ["report", reportWorkerId, date],
    enabled: !!reportWorkerId,
    queryFn: () => api<DailyReportData>(`/reports?userId=${reportWorkerId}&date=${date}`),
  });

  const pdf = useMutation({
    mutationFn: () =>
      downloadPdf(`/reports/pdf?userId=${reportWorkerId}&date=${date}`, `porocilo-${date}.pdf`),
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
  const perWorker = o.workers.map((w) => {
    const entries = o.timeEntries.filter((e) => e.user?.id === w.id);
    return {
      ...w,
      hours: entries
        .filter((e) => e.endedAt)
        .reduce((s, e) => s + hoursOf(e.startedAt, e.endedAt!), 0),
      running: entries.some((e) => !e.endedAt),
    };
  });
  const lastNote = [...o.workLogs].reverse().find((l) => l.note)?.note;
  const dateText = new Date(date).toLocaleDateString("sl-SI", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
  const noteError = addNote.error ?? resolve.error;

  function startEdit() {
    setSelected(o.workers.map((w) => w.id));
    saveWorkers.reset();
    setEditing(true);
  }
  const toggle = (wid: string) =>
    setSelected((s) => (s.includes(wid) ? s.filter((x) => x !== wid) : [...s, wid]));

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

      <ManagerNotes notes={o.notes} />

      {o.status !== "ZAKLJUCEN" && (
        <div className="section panel">
          <h3 className="panel-title">
            {o.status === "PROBLEM" ? "Ukrep za težavo" : "Opomba delavcem"}
          </h3>
          <div className="note-form">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={
                o.status === "PROBLEM"
                  ? "Kaj bo narejeno? Npr. vijake dobavimo do 14:00."
                  : "Sporočilo za delavce na tem nalogu."
              }
            />
            {noteError && <p className="error">{noteError.message}</p>}
            <button
              className="btn-secondary"
              disabled={addNote.isPending || !noteText.trim()}
              onClick={() => addNote.mutate()}
            >
              {addNote.isPending ? "Shranjujem..." : "Shrani opombo"}
            </button>
            {o.status === "PROBLEM" && (
              <button
                className="btn-primary"
                disabled={resolve.isPending || !noteText.trim()}
                onClick={() => resolve.mutate()}
              >
                {resolve.isPending ? "Shranjujem..." : "Težava rešena, nadaljuj delo"}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="section">
        <h2 className="project">{o.project.name}</h2>
        <p className="muted">
          {o.project.location}, delavci: {o.workers.map((w) => w.name).join(", ")}
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
        <h3 className="panel-title">Delavci na nalogu</h3>
        {perWorker.map((w) => (
          <div key={w.id} className="wk-row">
            <span>
              {w.name}
              {w.running && <em className="wk-live"> dela</em>}
            </span>
            <b>{w.hours.toFixed(2)} h</b>
          </div>
        ))}
        <div className="wk-row total">
          <span>Skupaj ur</span>
          <b>{total.toFixed(2)} h</b>
        </div>

        {o.status !== "ZAKLJUCEN" && !editing && (
          <button className="btn-secondary" onClick={startEdit}>
            Spremeni delavce
          </button>
        )}
        {editing && (
          <div className="wk-edit">
            <fieldset className="checks">
              <legend>Izberi delavce</legend>
              {workersQ.data?.map((w) => (
                <label key={w.id} className="check">
                  <input
                    type="checkbox"
                    checked={selected.includes(w.id)}
                    onChange={() => toggle(w.id)}
                  />
                  {w.name}
                </label>
              ))}
            </fieldset>
            {saveWorkers.error && <p className="error">{saveWorkers.error.message}</p>}
            <button
              className="btn-primary"
              disabled={saveWorkers.isPending || selected.length === 0}
              onClick={() => saveWorkers.mutate()}
            >
              {saveWorkers.isPending ? "Shranjujem..." : "Shrani"}
            </button>
            <button className="btn-secondary" onClick={() => setEditing(false)}>
              Prekliči
            </button>
          </div>
        )}
      </div>

      <div className="section panel">
        <h3 className="panel-title">
          <span className="pt-ic"><IconClock size={18} /></span>
          Evidenca ur
        </h3>
        {o.timeEntries.length === 0 && <p className="muted">Delo še ni začeto.</p>}
        {o.timeEntries.map((e) => (
          <TimeEntryRow key={e.id} entry={e} orderId={o.id} />
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
                    {l.user?.name}, {isProblem ? "težava, " : ""}
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
      {o.workers.length > 1 && (
        <div className="day-chips">
          {o.workers.map((w) => (
            <button
              key={w.id}
              className={w.id === reportWorkerId ? "on" : ""}
              aria-pressed={w.id === reportWorkerId}
              onClick={() => setReportUser(w.id)}
            >
              {w.name}
            </button>
          ))}
        </div>
      )}
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