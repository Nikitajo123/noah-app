import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import StatusChip from "../components/StatusChip";
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

  if (orderQ.isLoading) return <div className="page">Nalaganje...</div>;
  if (orderQ.error || !orderQ.data) {
    return <div className="page error">{orderQ.error?.message ?? "Naloge ni"}</div>;
  }

  const order = orderQ.data;
  const act = activeQ.data ?? null;
  const running = act && act.workOrderId === order.id ? act : null;
  const elsewhere = act && act.workOrderId !== order.id ? act : null;
  const error = setStatus.error ?? startWork.error ?? endWork.error;

  const totalHours = order.timeEntries
    .filter((e) => e.endedAt)
    .reduce(
      (s, e) => s + (new Date(e.endedAt!).getTime() - new Date(e.startedAt).getTime()) / 3600000,
      0
    );

  return (
    <>
      <div className="detail-top">
        <Link to="/" className="back">
          ‹
        </Link>
        <h1>Nalog {order.number}</h1>
        <StatusChip status={order.status} />
      </div>

      <div className="section">
        <h2 className="project">{order.project.name}</h2>
        <p className="muted">
          {order.project.location}, vodja {order.manager.name}
        </p>
        <p>{order.description}</p>
      </div>

      <div className="section info">
        <small>Planirano</small>
        <strong>{plannedText(order) || "Ni podatka"}</strong>
      </div>
      <div className="section info">
        <small>Material</small>
        <strong>{order.materials.map((m) => m.name).join(", ") || "Ni podatka"}</strong>
      </div>

      {order.status === "NOV" && (
        <div className="section">
          <button
            className="btn-primary"
            disabled={setStatus.isPending}
            onClick={() => setStatus.mutate("V_DELU")}
          >
            Začni delovni nalog
          </button>
        </div>
      )}

      {(order.status === "V_DELU" || order.status === "PROBLEM") && (
        <div className="work">
          {running ? (
            <>
              <small>Delo poteka</small>
              <div className="big">Prihod {formatTime(running.startedAt)}</div>
              <button
                className="btn-light"
                disabled={endWork.isPending}
                onClick={() => endWork.mutate()}
              >
                Končaj delo
              </button>
            </>
          ) : elsewhere ? (
            <>
              <small>Delo že poteka</small>
              <div className="big">Na nalogu {elsewhere.workOrder.number}</div>
              <Link to={`/nalog/${elsewhere.workOrder.id}`} className="btn-light as-link">
                Odpri
              </Link>
            </>
          ) : (
            <>
              <small>Delo še ni začeto</small>
              <div className="big">Pritisni, ko prideš na objekt</div>
              {order.status === "V_DELU" ? (
                <button
                  className="btn-primary"
                  disabled={startWork.isPending}
                  onClick={() => startWork.mutate()}
                >
                  Začni delo
                </button>
              ) : (
                <small>Naloga ima status Problem.</small>
              )}
            </>
          )}
        </div>
      )}

      {order.timeEntries.length > 0 && (
        <div className="entries">
          <h3>Evidenca ur</h3>
          {order.timeEntries.map((e) => (
            <div key={e.id} className="entry-row">
              <span>
                {formatTime(e.startedAt)} do {e.endedAt ? formatTime(e.endedAt) : "poteka"}
              </span>
              <b>
                {e.endedAt
                  ? (
                      (new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime()) /
                      3600000
                    ).toFixed(2) + " h"
                  : ""}
              </b>
            </div>
          ))}
          <div className="entry-row">
            <span>Skupaj</span>
            <b>{totalHours.toFixed(2)} h</b>
          </div>
        </div>
      )}

      {error && <p className="error section">{error.message}</p>}
    </>
  );
}