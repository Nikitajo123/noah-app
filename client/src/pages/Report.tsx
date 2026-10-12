import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, downloadPdf } from "../api";
import ReportView from "../components/ReportView";
import { Skeleton } from "../components/States";
import { IconCheck, IconDownload, IconEdit } from "../components/Icons";
import { formatTime } from "../format";
import type { DailyReportData } from "../types";

const todayKey = () => new Date().toLocaleDateString("sv-SE");

export default function Report() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayKey());

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
    <>
      <header className="top">
        <h1>Dnevno poročilo</h1>
        <input
          className="date-input"
          type="date"
          value={date}
          max={todayKey()}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
      </header>

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
    </>
  );
}
