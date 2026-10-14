import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, downloadPdf } from "../api";
import ReportView from "../components/ReportView";
import TeamReportView from "../components/TeamReportView";
import { Skeleton } from "../components/States";
import { IconBack, IconCheck, IconChevron, IconDownload, IconEdit } from "../components/Icons";
import { formatTime } from "../format";
import type { DailyReportData, MyTeam, TeamReportData } from "../types";

const todayKey = () => new Date().toLocaleDateString("sv-SE");
const shiftDay = (key: string, by: number) => {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + by);
  return d.toLocaleDateString("sv-SE");
};

function PersonalPanel({ date }: { date: string }) {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["report", date],
    queryFn: () => api<DailyReportData>(`/reports?date=${date}`),
  });

  const submit = useMutation({
    mutationFn: () =>
      api("/reports/submit", { method: "POST", body: JSON.stringify({ date }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report", date] }),
  });

  const pdf = useMutation({
    mutationFn: () => downloadPdf(`/reports/pdf?date=${date}`, `porocilo-${date}.pdf`),
  });

  const report = q.data;
  const submitted = report?.status === "ODDANO";

  return (
    <div className="report-body">
      {q.isLoading && (
        <div className="section">
          <Skeleton rows={2} />
        </div>
      )}
      {q.error && (
        <p className="error section" role="alert">
          {q.error.message}
        </p>
      )}

      {report && (
        <>
          <p className={submitted ? "submitted ok" : "submitted"} role="status">
            {submitted ? <IconCheck size={16} /> : <IconEdit size={16} />}
            {submitted && report.submittedAt
              ? `Oddano ob ${formatTime(report.submittedAt)}`
              : "Osnutek, še ni oddano"}
          </p>
          <ReportView report={report} />
          {report.orders.length > 0 && (
            <>
              <div className="section actions">
                <button
                  className="btn-secondary"
                  disabled={pdf.isPending}
                  onClick={() => pdf.mutate()}
                >
                  <IconDownload size={20} />
                  {pdf.isPending ? "Pripravljam PDF..." : "Prenesi PDF"}
                </button>
                {pdf.error && (
                  <p className="error" role="alert">
                    {pdf.error.message}
                  </p>
                )}
              </div>
              <div className="actionbar-space" />
              <div className="actionbar">
                {submit.error && (
                  <p className="error" role="alert">
                    {submit.error.message}
                  </p>
                )}
                <button
                  className={submitted ? "btn-secondary btn-lg" : "btn-primary btn-lg"}
                  disabled={submit.isPending}
                  onClick={() => submit.mutate()}
                >
                  {submit.isPending
                    ? "Oddajam..."
                    : submitted
                      ? "Oddaj ponovno"
                      : "Oddaj poročilo"}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function TeamPanel({ date, isForeman }: { date: string; isForeman: boolean }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["team-report", "mine", date],
    queryFn: () => api<TeamReportData>(`/team-reports?date=${date}`),
  });

  const report = q.data;
  const submitted = report?.status === "ODDANO";
  const text = draft ?? report?.summary ?? "";

  const save = useMutation({
    mutationFn: (submit: boolean) =>
      api("/team-reports/save", {
        method: "POST",
        body: JSON.stringify({ date, summary: text.trim(), submit }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-report"] }),
  });

    const pdf = useMutation({
    mutationFn: () => downloadPdf(`/team-reports/pdf?date=${date}`, `porocilo-ekipe-${date}.pdf`),
  });

  return (
    <div className="report-body">
      {q.isLoading && (
        <div className="section">
          <Skeleton rows={2} />
        </div>
      )}
      {q.error && (
        <p className="error section" role="alert">
          {q.error.message}
        </p>
      )}

      {report && (
        <>
          <p className={submitted ? "submitted ok" : "submitted"} role="status">
            {submitted ? <IconCheck size={16} /> : <IconEdit size={16} />}
            {submitted && report.submittedAt
              ? `Oddano ob ${formatTime(report.submittedAt)}${report.submittedBy ? `, ${report.submittedBy}` : ""}`
              : "Osnutek, še ni oddano"}
          </p>

          {isForeman ? (
            <div className="section">
              <label className="field">
                Povzetek dneva (delovodja)
                <textarea
                  value={text}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Kaj je ekipa danes naredila, kaj ostane za jutri."
                />
              </label>
            </div>
          ) : (
            <p className="muted section">
              Poročilo ekipe oddaja delovodja {report.team.foreman.name}.
            </p>
          )}

          <TeamReportView report={isForeman ? { ...report, summary: null } : report} />

                    <div className="section actions">
            <button className="btn-secondary" disabled={pdf.isPending} onClick={() => pdf.mutate()}>
              <IconDownload size={20} />
              {pdf.isPending ? "Pripravljam PDF..." : "Prenesi PDF ekipe"}
            </button>
            {pdf.error && <p className="error">{pdf.error.message}</p>}
          </div>

          {isForeman && (
            <>
              <div className="section actions">
                <button
                  className="btn-secondary"
                  disabled={save.isPending}
                  onClick={() => save.mutate(false)}
                >
                  Shrani osnutek
                </button>
              </div>
              {report.orders.length > 0 && (
                <>
                  <div className="actionbar-space" />
                  <div className="actionbar">
                    {save.error && (
                      <p className="error" role="alert">
                        {save.error.message}
                      </p>
                    )}
                    <button
                      className={submitted ? "btn-secondary btn-lg" : "btn-primary btn-lg"}
                      disabled={save.isPending}
                      onClick={() => save.mutate(true)}
                    >
                      {save.isPending
                        ? "Oddajam..."
                        : submitted
                          ? "Oddaj ponovno"
                          : "Oddaj poročilo ekipe"}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function Report() {
  const [date, setDate] = useState(todayKey());
  const [mode, setMode] = useState<"team" | "mine">("team");

  const teamQ = useQuery({ queryKey: ["my-team"], queryFn: () => api<MyTeam>("/teams/mine") });
  const my = teamQ.data;
  const view = my?.team ? mode : "mine";

  return (
    <>
      <header className="top">
        <h1>{view === "team" ? "Poročilo ekipe" : "Dnevno poročilo"}</h1>
        <div className="date-nav">
          <button
            type="button"
            className="day-btn"
            aria-label="Prejšnji dan"
            onClick={() => setDate(shiftDay(date, -1))}
          >
            <IconBack />
          </button>
          <input
            className="date-input"
            type="date"
            value={date}
            max={todayKey()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          <button
            type="button"
            className="day-btn"
            aria-label="Naslednji dan"
            disabled={date >= todayKey()}
            onClick={() => setDate(shiftDay(date, 1))}
          >
            <IconChevron />
          </button>
        </div>
      </header>

      {my?.team && (
        <div className="seg">
          <button className={view === "team" ? "on" : ""} onClick={() => setMode("team")}>
            Ekipa
          </button>
          <button className={view === "mine" ? "on" : ""} onClick={() => setMode("mine")}>
            Moje ure
          </button>
        </div>
      )}

      {teamQ.isLoading ? (
        <div className="section">
          <Skeleton rows={2} />
        </div>
      ) : view === "team" && my?.team ? (
        <TeamPanel key={date} date={date} isForeman={my.isForeman} />
      ) : (
        <PersonalPanel date={date} />
      )}
    </>
  );
}