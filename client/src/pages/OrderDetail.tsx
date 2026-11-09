import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import StatusChip from "../components/StatusChip";
import StatusSteps from "../components/StatusSteps";
import DayStatusCard from "../components/DayStatusCard";
import PhotoSection from "../components/PhotoSection";
import ProblemReport from "../components/ProblemReport";
import ManagerNotes from "../components/ManagerNotes";
import { Skeleton } from "../components/States";
import { IconAlert, IconBack, IconClock, IconPlay, IconStop } from "../components/Icons";
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
      api("/time/start", {
        method: "POST",
        body: JSON.stringify({ workOrderId: id, at: new Date().toISOString() }),
      }),
    onSuccess: refresh,
  });
  const endWork = useMutation({
    mutationFn: () =>
      api("/time/end", { method: "POST", body: JSON.stringify({ at: new Date().toISOString() }) }),
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
  const closed = order.status === "ZAKLJUCEN";

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
    <div className="od">
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

        <ManagerNotes notes={order.notes} />

      <div className="section">
        <p className="desc">{order.description}</p>
        <p className="muted">
          {order.project.name}, {order.project.location}
        </p>
      </div>

      <div className="section">
        <div className="kv">
          <span>Datum</span>
          <b>{new Date(order.workDate).toLocaleDateString("sl-SI")}</b>
        </div>
        <div className="kv">
          <span>Rok</span>
          <b>{new Date(order.dueDate).toLocaleDateString("sl-SI")}</b>
        </div>
        <p className="small-facts">
          Planirano: {plannedText(order) || "ni podatka"}. Material:{" "}
          {order.materials.map((m) => m.name).join(", ") || "ni podatka"}.
        </p>
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

      {(inProgress || closed) && <DayStatusCard order={order} running={!!running} />}

      {(inProgress || closed) && (
        <PhotoSection
          orderId={order.id}
          photos={order.photos}
          kind={closed ? "KONCANO" : "MED"}
        />
      )}

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
    </div>
  );
}