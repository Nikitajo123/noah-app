import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import StatusChip from "../components/StatusChip";
import StatusSteps from "../components/StatusSteps";
import WorkLogForm from "../components/WorkLogForm";
import MaterialsUsed from "../components/MaterialsUsed";
import PhotoSection from "../components/PhotoSection";
import ProblemReport from "../components/ProblemReport";
import { Skeleton } from "../components/States";
import { IconAlert, IconBack, IconClock, IconHistory, IconPlay, IconStop } from "../components/Icons";
import { formatTime, plannedText } from "../format";
import type { ActiveEntry, WorkOrderDetail } from "../types";

export default function OrderDetail() {
  const { id } = useParams();
  const qc = useQueryClient();

  const orderQ = useQuery({
    queryKey: ["order", id],
    queryFn: () => api<WorkOrderDetail>(`/work-orders/${id}`),
  });
  const activeQ = useQuery({
    queryKey: ["active"],
    queryFn: () => api<ActiveEntry>("/time/active"),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["order", id] });
    qc.invalidateQueries({ queryKey: ["active"] });
    qc.invalidateQueries({ queryKey: ["orders"] });
  };

  const setStatus = useMutation({
    mutationFn: (status: string) =>
      api(`/work-orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: refresh,
  });
  const startWork = useMutation({
    mutationFn: () =>
      api("/time/start", { method: "POST", body: JSON.stringify({ workOrderId: id }) }),
    onSuccess: refresh,
  });
  const endWork = useMutation({
    mutationFn: () => api("/time/end", { method: "POST", body: "{}" }),
    onSuccess: refresh,
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

  const order = orderQ.data;
  const act = activeQ.data ?? null;
  const running = act && act.workOrderId === order.id ? act : null;
  const elsewhere = act && act.workOrderId !== order.id ? act : null;
  const error = setStatus.error ?? startWork.error ?? endWork.error;
  const inProgress = order.status === "V_DELU" || order.status === "PROBLEM";

  const hoursOf = (s: string, e: string) =>
    (new Date(e).getTime() - new Date(s).getTime()) / 3600000;
  const totalHours = order.timeEntries
    .filter((e) => e.endedAt)
    .reduce((s, e) => s + hoursOf(e.startedAt, e.endedAt!), 0);

  const hasFinishedWork = order.timeEntries.some((e) => e.endedAt);
  const allowedPhotos = {
    PRED: order.status !== "ZAKLJUCEN",
    MED: inProgress,
    KONCANO: inProgress && !running && hasFinishedWork,
    PROBLEM: order.status === "PROBLEM",
  };

  const problemNote = [...order.workLogs].reverse().find((l) => l.note)?.note;

  // The main action of the screen lives in a sticky bar above the tabs.
  let mainAction = null;
  if (order.status === "NOV") {
    mainAction = (
      <button
        className="btn-primary btn-lg"
        disabled={setStatus.isPending}
        onClick={() => setStatus.mutate("V_DELU")}
      >
        Začni delovni nalog
      </button>
    );
  } else if (inProgress && running) {
    mainAction = (
      <button
        className="btn-dark btn-lg"
        disabled={endWork.isPending}
        onClick={() => endWork.mutate()}
      >
        <IconStop />
        Končaj delo
      </button>
    );
  } else if (inProgress && elsewhere) {
    mainAction = (
      <Link to={`/nalog/${elsewhere.workOrder.id}`} className="btn-secondary btn-lg">
        Odpri
      </Link>
    );
  } else if (inProgress) {
    mainAction = (
      <button
        className="btn-primary btn-lg"
        disabled={startWork.isPending}
        onClick={() => startWork.mutate()}
      >
        <IconPlay />
        Začni delo
      </button>
    );
  }

  return (
    <>
      <div className="detail-top">
        <Link to="/" className="back" aria-label="Nazaj">
          <IconBack />
        </Link>
        <h1>Nalog {order.number}</h1>
        <StatusChip status={order.status} />
      </div>

      <StatusSteps status={order.status} />

      {order.status === "PROBLEM" && (
        <div className="banner-problem" role="alert">
          <IconAlert />
          <div>
            <strong>Težava je prijavljena vodji.</strong>
            {problemNote && <div>{problemNote}</div>}
          </div>
        </div>
      )}

      <div className="section">
        <h2 className="project">{order.project.name}</h2>
        <p className="muted">
          {order.project.location}, vodja {order.manager.name}
        </p>
        <p className="desc">{order.description}</p>
      </div>

      <div className="info-grid">
        <div className="info">
          <small>Planirano</small>
          <strong>{plannedText(order) || "Ni podatka"}</strong>
        </div>
        <div className="info">
          <small>Material</small>
          <strong>{order.materials.map((m) => m.name).join(", ") || "Ni podatka"}</strong>
        </div>
      </div>

      {inProgress && (
        <div className={running ? "work running" : "work"}>
          <div className="work-main">
            {running ? (
              <>
                <small>
                  <span className="live" aria-hidden="true" />
                  Delo poteka
                </small>
                <div className="big">
                  Prihod <span className="num">{formatTime(running.startedAt)}</span>
                </div>
              </>
            ) : elsewhere ? (
              <>
                <small>Delo že poteka</small>
                <div className="big">Na nalogu {elsewhere.workOrder.number}</div>
              </>
            ) : (
              <>
                <small>Delo še ni začeto</small>
                <div className="big">Pritisni, ko prideš na objekt</div>
              </>
            )}
          </div>
          {hasFinishedWork && (
            <div className="work-stat">
              <small>Skupaj</small>
              <span className="num">{totalHours.toFixed(2)} h</span>
            </div>
          )}
        </div>
      )}

      {inProgress && (
        <>
          <WorkLogForm orderId={order.id} />
          <MaterialsUsed materials={order.materials} orderId={order.id} />
        </>
      )}

      {order.workLogs.length > 0 && (
        <div className="section panel">
          <h3 className="panel-title">
            <span className="pt-ic"><IconHistory size={18} /></span>
            Vnosi
          </h3>
          <div className="logs">
            {order.workLogs.map((l) => {
              const isProblem = l.description === "Prijavljena težava";
              return (
                <div key={l.id} className={isProblem ? "log-card problem" : "log-card"}>
                  <div className="log-head">
                    <span>{isProblem ? "Težava, " : ""}{formatTime(l.createdAt)}</span>
                    {l.quantity != null && (
                      <b className="qty">
                        {l.quantity} {l.unit}
                      </b>
                    )}
                  </div>
                  {!isProblem && <p>{l.description}</p>}
                  {l.note && (
                    <div className="log-note">
                      {isProblem ? l.note : `Opomba: ${l.note}`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <PhotoSection orderId={order.id} photos={order.photos} allowed={allowedPhotos} />

      {order.timeEntries.length > 0 && (
        <div className="section panel">
          <h3 className="panel-title">
            <span className="pt-ic"><IconClock size={18} /></span>
            Evidenca ur
          </h3>
          {order.timeEntries.map((e) => (
            <div key={e.id} className="entry-row">
              <span>
                {formatTime(e.startedAt)} do {e.endedAt ? formatTime(e.endedAt) : "poteka"}
              </span>
              <b>{e.endedAt ? hoursOf(e.startedAt, e.endedAt).toFixed(2) + " h" : ""}</b>
            </div>
          ))}
          <div className="entry-row total">
            <span>Skupaj</span>
            <b>{totalHours.toFixed(2)} h</b>
          </div>
        </div>
      )}

      {inProgress && (
        <div className="section actions">
          {order.status === "V_DELU" ? (
            <ProblemReport orderId={order.id} />
          ) : (
            <button
              className="btn-secondary"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate("V_DELU")}
            >
              Težava rešena, nadaljuj delo
            </button>
          )}
          <button
            className="btn-primary btn-lg"
            disabled={setStatus.isPending || !!running || !hasFinishedWork}
            onClick={() => setStatus.mutate("ZAKLJUCEN")}
          >
            Zaključi delovni nalog
          </button>
          {running && <p className="muted center">Najprej končaj delo.</p>}
          {!running && !hasFinishedWork && (
            <p className="muted center">Najprej začni in končaj delo, da se zapišejo ure.</p>
          )}
        </div>
      )}

      {error && !mainAction && (
        <p className="error section" role="alert">
          {error.message}
        </p>
      )}

      {mainAction && (
        <>
          <div className="actionbar-space" />
          <div className="actionbar">
            {error && (
              <p className="error" role="alert">
                {error.message}
              </p>
            )}
            {mainAction}
          </div>
        </>
      )}
    </>
  );
}
