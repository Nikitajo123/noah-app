import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api";
import StatusChip from "../components/StatusChip";
import { formatDue, plannedText } from "../format";
import type { WorkOrder } from "../types";

export default function Orders() {
  const [tab, setTab] = useState<"open" | "done">("open");
  const { data, isLoading, error } = useQuery({
    queryKey: ["orders", tab],
    queryFn: () =>
      api<WorkOrder[]>(`/work-orders?status=${tab === "open" ? "open" : "ZAKLJUCEN"}`),
  });

  const groups = new Map<string, { name: string; location: string; orders: WorkOrder[] }>();
  for (const o of data ?? []) {
    const g = groups.get(o.project.id) ?? {
      name: o.project.name,
      location: o.project.location,
      orders: [],
    };
    g.orders.push(o);
    groups.set(o.project.id, g);
  }

  const today = new Date().toLocaleDateString("sl-SI", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <header className="top">
        <h1>Moji nalogi</h1>
        <p>{today}</p>
      </header>
      <div className="seg">
        <button className={tab === "open" ? "on" : ""} onClick={() => setTab("open")}>
          Odprti
        </button>
        <button className={tab === "done" ? "on" : ""} onClick={() => setTab("done")}>
          Zaključeni
        </button>
      </div>
      <div className="list">
        {isLoading && <p className="muted">Nalaganje...</p>}
        {error && <p className="error">{error.message}</p>}
        {data && data.length === 0 && <p className="muted">Ni nalogov.</p>}
        {[...groups.entries()].map(([pid, g]) => (
          <section key={pid} className="group">
            <p className="group-title">
              {g.name}, {g.location}
            </p>
            {g.orders.map((o) => (
              <Link key={o.id} to={`/nalog/${o.id}`} className="card" data-status={o.status}>
                <div className="card-top">
                  <span>{o.number}</span>
                  <StatusChip status={o.status} />
                </div>
                <h3>{o.project.name}</h3>
                <p>{o.description}</p>
                <div className="card-bottom">
                  <span>{plannedText(o)}</span>
                  <b>Rok: {formatDue(o.dueDate)}</b>
                </div>
              </Link>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}