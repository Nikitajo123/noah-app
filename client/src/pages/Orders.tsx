import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api";
import StatusChip from "../components/StatusChip";
import { formatDue, plannedText } from "../format";
import { EmptyState, Skeleton } from "../components/States";
import SearchBox, { matchesQuery } from "../components/SearchBox";
import { IconClock } from "../components/Icons";
import type { WorkOrder } from "../types";

export default function Orders() {
  const [tab, setTab] = useState<"open" | "done">("open");
  const [query, setQuery] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["orders", tab],
    queryFn: () =>
      api<WorkOrder[]>(`/work-orders?status=${tab === "open" ? "open" : "ZAKLJUCEN"}`),
  });

  const groups = new Map<string, { name: string; location: string; orders: WorkOrder[] }>();
  const found = (data ?? []).filter((o) =>
    matchesQuery(query, o.number, o.project.name, o.project.location, o.description)
  );
  for (const o of found) {
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
    <div className="pg">
      <header className="top">
        <h1>Moji nalogi</h1>
        <p>{today}</p>
      </header>
      <div className="seg">
        <button className={tab === "open" ? "on" : ""} aria-pressed={tab === "open"} onClick={() => setTab("open")}>
          Odprti
        </button>
        <button className={tab === "done" ? "on" : ""} aria-pressed={tab === "done"} onClick={() => setTab("done")}>
          Zaključeni
        </button>
      </div>
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Išči po nalogih"
        label="Iskanje nalogov"
      />
      <div className="list">
        {isLoading && <Skeleton rows={3} />}
        {error && <p className="error" role="alert">{error.message}</p>}
        {data && data.length === 0 && <EmptyState>Ni nalogov.</EmptyState>}
        {data && data.length > 0 && found.length === 0 && <EmptyState>Ni zadetkov.</EmptyState>}
        {[...groups.entries()].map(([pid, g]) => (
          <section key={pid} className="group">
            <p className="group-title">
              <span className="gt-name">{g.name}</span>, {g.location}
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
                  <span className="cb-plan">
                    {plannedText(o) && <IconClock size={16} />}
                    {plannedText(o)}
                  </span>
                  <b>Rok: {formatDue(o.dueDate)}</b>
                </div>
              </Link>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}