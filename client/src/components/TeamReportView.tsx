import StatusChip from "./StatusChip";
import PhotoImg from "./PhotoImg";
import { EmptyState } from "./States";
import { IconReport } from "./Icons";
import { formatHours, formatTime } from "../format";
import type { PhotoKind, TeamReportData } from "../types";

const KIND_LABEL: Record<PhotoKind, string> = {
  PRED: "Pred",
  MED: "Med delom",
  KONCANO: "Končano",
  PROBLEM: "Problem",
};

export default function TeamReportView({ report }: { report: TeamReportData }) {
  return (
    <>
      <div className="report-total">
        <div>
          <small>Skupaj ur ekipe</small>
          <div className="num">{formatHours(report.totalHours)}</div>
        </div>
        <span>{report.team.name}</span>
      </div>

      <p className="tr-meta">
        Delovodja: {report.team.foreman.name}. Člani: {report.team.members.map((m) => m.name).join(", ")}.
      </p>

      {report.summary && (
        <div className="tr-summary">
          <small>Povzetek dneva</small>
          <p>{report.summary}</p>
        </div>
      )}

      {report.orders.length === 0 && (
        <EmptyState icon={<IconReport size={28} />}>Za ta dan ni vnosov ekipe.</EmptyState>
      )}

      {report.orders.map((o) => {
        const work = o.logs.filter((l) => l.description !== "Prijavljena težava");
        const used = o.materials.filter((m) => m.usedQty != null);
        return (
          <section key={o.workOrderId} className="report-order">
            <div className="report-order-head">
              <div>
                <h3>{o.project.name}</h3>
                <small className="muted">
                  {o.project.location}, nalog {o.number}
                </small>
              </div>
              <StatusChip status={o.status} />
            </div>

            <div className="tr-workers">
              {o.workers.map((w) => (
                <div key={w.userId} className="tr-wrow">
                  <span>{w.name}</span>
                  <span className="muted">
                    {w.arrival ? formatTime(w.arrival) : "-"} do{" "}
                    {w.departure ? formatTime(w.departure) : "poteka"}
                  </span>
                  <b>{formatHours(w.hours)}</b>
                </div>
              ))}
              <div className="tr-wrow total">
                <span>Ure naloga</span>
                <span />
                <b>{formatHours(o.hours)}</b>
              </div>
            </div>

            <p className="rsub">Opravljeno delo</p>
            {work.length === 0 && <p className="muted rline">Ni vnosov.</p>}
            {work.map((l, i) => (
              <p key={i} className="rline">
                {l.description}
                {l.quantity != null && (
                  <b>
                    {" "}
                    ({l.quantity} {l.unit})
                  </b>
                )}{" "}
                <span className="muted">({l.author})</span>
              </p>
            ))}

            <p className="rsub">Uporabljen material</p>
            {used.length === 0 && <p className="muted rline">Ni vnesenih količin.</p>}
            {used.map((m) => (
              <p key={m.name} className="rline">
                {m.name}: <b>{m.usedQty}</b>
              </p>
            ))}

            {o.problems.length > 0 && (
              <>
                <p className="rsub">Problemi in opombe</p>
                {o.problems.map((p, i) => (
                  <div key={i} className="log-note">
                    {p.text} ({p.author})
                  </div>
                ))}
              </>
            )}

            {o.photos.length > 0 && (
              <>
                <p className="rsub">Fotografije</p>
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
              </>
            )}
          </section>
        );
      })}
    </>
  );
}