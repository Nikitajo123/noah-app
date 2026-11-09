import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api";
import StatusChip from "../components/StatusChip";
import SearchBox, { matchesQuery } from "../components/SearchBox";
import { EmptyState, Skeleton } from "../components/States";
import { IconChevron } from "../components/Icons";
import { formatHours } from "../format";
import type { DailyOverviewData, DailyOverviewGroup, DayState, Project } from "../types";

const todayKey = () => new Date().toLocaleDateString("sv-SE");
const dayText = (iso: string) =>
  new Date(iso).toLocaleDateString("sl-SI", { day: "numeric", month: "numeric" });

const STATE: Record<DayState, { label: string; cls: string }> = {
  DONE: { label: "Narejeno", cls: "ds-chip yes" },
  NOT_DONE: { label: "Ni narejeno", cls: "ds-chip no" },
  NONE: { label: "Brez vnosa", cls: "ds-chip none" },
};

const photosText = (n: number) =>
  n === 1 ? "1 fotografija" : n === 2 ? "2 fotografiji" : n === 3 || n === 4 ? `${n} fotografije` : `${n} fotografij`;
const daysText = (n: number) => (n === 1 ? "1 dan" : `${n} dni`);

function Group({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={open ? "dp-group open" : "dp-group"}>
      <button className="dp-head" aria-expanded={open} onClick={onToggle}>
        <span className="dp-name">{title}</span>
        <span className="dp-count">{count}</span>
        <span className="dp-chev" aria-hidden="true">
          <IconChevron size={18} />
        </span>
      </button>
      {open && <div className="dp-body">{children}</div>}
    </section>
  );
}

export default function DailyOverview() {
  const [date, setDate] = useState(todayKey());
  const [projectId, setProjectId] = useState("");
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const projects = useQuery({ queryKey: ["projects"], queryFn: () => api<Project[]>("/projects") });
  const q = useQuery({
    queryKey: ["daily-overview", date, projectId],
    queryFn: () =>
      api<DailyOverviewData>(`/daily-overview?date=${date}${projectId ? `&projectId=${projectId}` : ""}`),
  });

  const toggle = (key: string) =>
    setClosed((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const groups = (q.data?.projects ?? []).filter((g) => matchesQuery(query, g.name, g.location));
  const withDay = groups.filter((g) => g.orders.length > 0);
  const withOpen = groups.filter((g) => g.open.length > 0);

  const dayCount = (g: DailyOverviewGroup) => {
    const states = g.orders.flatMap((o) => o.workers.map((w) => w.state));
    const done = states.filter((s) => s === "DONE").length;
    return `${g.orders.length} ${g.orders.length === 1 ? "nalog" : "nalogov"}, narejeno ${done} od ${states.length}`;
  };

  return (
    <div className="pg">
      <header className="top">
        <h1>Dnevni pregled</h1>
        <p>Kaj so delavci danes naredili in kaj ostaja odprto</p>
      </header>

      <div className="filters">
        <input
          type="date"
          aria-label="Datum"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
        <select aria-label="Gradbišče" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Vsa gradbišča</option>
          {projects.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <SearchBox value={query} onChange={setQuery} placeholder="Išči gradbišče" label="Iskanje gradbišča" />
      </div>

      <div className="dp">
        {q.isLoading && <Skeleton rows={3} />}
        {q.error && (
          <p className="error" role="alert">
            {q.error.message}
          </p>
        )}

        {q.data && (
          <>
            <h2 className="dp-title">Nalogi na ta dan</h2>
            {withDay.length === 0 && <EmptyState>Za ta dan ni nalogov.</EmptyState>}
            {withDay.map((g) => (
              <Group
                key={`d-${g.id}`}
                title={`${g.name}, ${g.location}`}
                count={dayCount(g)}
                open={!closed.has(`d-${g.id}`)}
                onToggle={() => toggle(`d-${g.id}`)}
              >
                {g.orders.map((o) => (
                  <article key={o.id} className="dp-order">
                    <div className="dp-order-head">
                      <Link to={`/nalog/${o.id}?date=${date}`} className="dp-link">
                        Nalog {o.number}
                      </Link>
                      <StatusChip status={o.status} />
                    </div>
                    <p className="dp-desc">{o.description}</p>
                    {o.workers.map((w) => (
                      <div key={w.id} className="dp-worker">
                        <div className="dp-wmain">
                          <b>{w.name}</b>
                          <span className="muted">
                            {w.running
                              ? "dela"
                              : w.hours != null
                                ? `${formatHours(w.hours)} h`
                                : w.state === "DONE" && o.noHours
                                  ? "brez ur"
                                  : ""}
                            {w.photos > 0 ? `${w.hours != null || w.running || (w.state === "DONE" && o.noHours) ? ", " : ""}${photosText(w.photos)}` : ""}
                          </span>
                          {w.note && <p className="dp-note">{w.note}</p>}
                        </div>
                        <span className={STATE[w.state].cls}>{STATE[w.state].label}</span>
                      </div>
                    ))}
                  </article>
                ))}
              </Group>
            ))}

            <h2 className="dp-title">Odprti nalogi</h2>
            <p className="muted dp-sub">Nalogi iz prejšnjih dni, ki še niso zaključeni.</p>
            {withOpen.length === 0 && <EmptyState>Ni odprtih nalogov iz prejšnjih dni.</EmptyState>}
            {withOpen.map((g) => (
              <Group
                key={`o-${g.id}`}
                title={`${g.name}, ${g.location}`}
                count={`${g.open.length} ${g.open.length === 1 ? "odprt nalog" : "odprtih nalogov"}`}
                open={!closed.has(`o-${g.id}`)}
                onToggle={() => toggle(`o-${g.id}`)}
              >
                {g.open.map((o) => (
                  <article key={o.id} className="dp-order">
                    <div className="dp-order-head">
                      <Link to={`/nalog/${o.id}`} className="dp-link">
                        Nalog {o.number}
                      </Link>
                      <StatusChip status={o.status} />
                    </div>
                    <p className="dp-desc">{o.description}</p>
                    <p className="muted">
                      Odprt {daysText(o.daysOpen)} (od {dayText(o.workDate)}). Delavci: {o.workers.join(", ")}.
                    </p>
                    {o.lastNote ? (
                      <p className="dp-note">
                        {o.lastNote.by}, {dayText(o.lastNote.date)}: {o.lastNote.text}
                      </p>
                    ) : (
                      <p className="muted">Ni opombe.</p>
                    )}
                  </article>
                ))}
              </Group>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
