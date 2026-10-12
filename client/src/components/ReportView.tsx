import StatusChip from "./StatusChip";
import PhotoImg from "./PhotoImg";
import { formatHours, formatTime } from "../format";
import type { DailyReportData, PhotoKind } from "../types";

const KIND_LABEL: Record<PhotoKind, string> = {
  PRED: "Pred",
  MED: "Med delom",
  KONCANO: "Končano",
  PROBLEM: "Problem",
};

export default function ReportView({ report }: { report: DailyReportData }) {
  if (report.orders.length === 0) {
    return <p className="muted section">Za ta dan ni vnosov.</p>;
  }

  return (
    <>
      <div className="report-total">
        <div>
          <small>Skupaj ur</small>
          <div className="num">{formatHours(report.totalHours)}</div>
        </div>
        <span>{report.worker.name}</span>
      </div>

      {report.orders.map((o) => {
        const work = o.logs.filter((l) => l.description !== "Prijavljena težava");
        const used = o.materials.filter((m) => m.usedQty != null);
        const problems = o.problems.filter(Boolean) as string[];
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

            <div className="kv">
              <span>Prihod</span>
              <b>{o.arrival ? formatTime(o.arrival) : "-"}</b>
            </div>
            <div className="kv">
              <span>Odhod</span>
              <b>{o.departure ? formatTime(o.departure) : o.arrival ? "še poteka" : "-"}</b>
            </div>
            <div className="kv">
              <span>Ure</span>
              <b>{formatHours(o.hours)}</b>
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
                )}
              </p>
            ))}

            <p className="rsub">Uporabljen material</p>
            {used.length === 0 && <p className="muted rline">Ni vnesenih količin.</p>}
            {used.map((m) => (
              <p key={m.name} className="rline">
                {m.name}: <b>{m.usedQty}</b>
              </p>
            ))}

            {problems.length > 0 && (
              <>
                <p className="rsub">Problemi in opombe</p>
                {problems.map((p, i) => (
                  <div key={i} className="log-note">
                    {p}
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