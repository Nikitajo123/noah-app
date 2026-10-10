import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api";
import StatusChip from "../components/StatusChip";
import type { Project, WorkOrder } from "../types";

export default function ProjectsList() {
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<Project[]>("/projects"),
  });
  const orders = useQuery({
    queryKey: ["all-orders"],
    queryFn: () => api<WorkOrder[]>("/work-orders"),
  });

  return (
    <>
      <header className="top">
        <h1>Projekti</h1>
        <p>Objekti in delovni nalogi</p>
      </header>
      <div className="list">
        {(projects.isLoading || orders.isLoading) && <p className="muted">Nalaganje...</p>}
        {projects.error && <p className="error">{projects.error.message}</p>}
        {projects.data?.map((p) => {
          const list = (orders.data ?? []).filter((o) => o.project.id === p.id);
          return (
            <section key={p.id} className="group">
              <p className="group-title">
                {p.name}, {p.location} ({list.length})
              </p>
              {list.length === 0 && <p className="muted">Ni nalogov.</p>}
              {list.map((o) => (
                <Link key={o.id} to={`/nalog/${o.id}`} className="card" data-status={o.status}>
                  <div className="card-top">
                    <span>{o.number}</span>
                    <StatusChip status={o.status} />
                  </div>
                  <h3>{o.worker.name}</h3>
                  <p>{o.description}</p>
                </Link>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}