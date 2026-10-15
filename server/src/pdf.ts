import PDFDocument from "pdfkit";
import path from "path";

export type PdfReport = {
  date: string;
  worker: { id: string; name: string };
  status: "OSNUTEK" | "ODDANO";
  submittedAt: Date | null;
  totalHours: number;
  orders: {
    number: string;
    status: string;
    project: { name: string; location: string };
    arrival: Date | null;
    departure: Date | null;
    hours: number;
    logs: { description: string; quantity: number | null; unit: string | null; note: string | null }[];
    materials: { name: string; usedQty: number | null }[];
    problems: (string | null)[];
    photos: { id: string; kind: string; path: string; takenAt: Date }[];
  }[];
};

const INK = "#000000";
const ACC = "#C1A050";
const MUTE = "#6E6C66";
const LINE = "#DEDCD6";
const FOG = "#F3F2EF";
const RED = "#C62828";
const PINK = "#FDECEC";

const STATUS_LABEL: Record<string, string> = {
  NOV: "Novo",
  V_DELU: "V delu",
  ZAKLJUCEN: "Zaključen",
  PROBLEM: "Problem",
};
const KIND_LABEL: Record<string, string> = {
  PRED: "Pred",
  MED: "Med delom",
  KONCANO: "Končano",
  PROBLEM: "Problem",
};

const TZ = "Europe/Ljubljana";
const hhmm = (d: Date) =>
  d.toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const hoursText = (h: number) => {
  const m = Math.round(h * 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")} h`;
};

const fontDir = path.join(path.dirname(require.resolve("inter-ui/package.json")), "Inter (web)");

const M = 40;
const W = 515;
const BOTTOM = 790;

export function streamReportPdf(
  report: PdfReport,
  out: NodeJS.WritableStream,
  photoData: Map<string, Buffer> = new Map()
) {
  const doc = new PDFDocument({ size: "A4", margin: M, bufferPages: true });
  doc.registerFont("R", path.join(fontDir, "Inter-Regular.woff"));
  doc.registerFont("B", path.join(fontDir, "Inter-Bold.woff"));
  doc.pipe(out);

  const ensure = (h: number) => {
    if (doc.y + h > BOTTOM) {
      doc.addPage();
      doc.y = M;
    }
  };
  const text = (s: string, x: number, y: number, o: PDFKit.Mixins.TextOptions = {}) =>
    doc.text(s, x, y, { lineBreak: false, ...o });

  // Header
  doc.rect(0, 0, 595, 100).fill(INK);
  doc.rect(M, 26, 48, 5).fill(ACC);
  doc.fillColor("#FFFFFF").font("B").fontSize(28);
  text("NOAH", M, 38);
  doc.font("R").fontSize(13).fillColor("#BDBBB4");
  text("Dnevno poročilo", M, 72);
  const dateText = new Date(`${report.date}T12:00:00`).toLocaleDateString("sl-SI", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
  doc.font("B").fontSize(16).fillColor("#FFFFFF");
  text(dateText, M, 44, { width: W, align: "right" });

  // Summary
  const sy = 124;
  const summary: [string, string][] = [
    ["Delavec", report.worker.name],
    ["Datum", dateText],
    ["Skupaj ur", hoursText(report.totalHours)],
    [
      "Stanje",
      report.status === "ODDANO" && report.submittedAt
        ? `Oddano ob ${hhmm(report.submittedAt)}`
        : "Osnutek",
    ],
  ];
  summary.forEach(([label, value], i) => {
    const x = M + i * (W / 4);
    doc.font("R").fontSize(9).fillColor(MUTE);
    text(label, x, sy);
    doc.font("B").fontSize(13).fillColor(INK);
    text(value, x, sy + 14, { width: W / 4 - 8 });
  });
  doc.rect(M, sy + 38, W, 2).fill(ACC);
  doc.y = sy + 58;

  if (report.orders.length === 0) {
    doc.font("R").fontSize(12).fillColor(MUTE);
    text("Za ta dan ni vnosov.", M, doc.y);
  }

  for (const o of report.orders) {
    ensure(150);
    const hy = doc.y;
    doc.roundedRect(M, hy, W, 46, 8).fill(FOG);
    doc.font("B").fontSize(14).fillColor(INK);
    text(o.project.name, M + 14, hy + 9, { width: 300 });
    doc.font("R").fontSize(10).fillColor(MUTE);
    text(`${o.project.location}, nalog ${o.number}`, M + 14, hy + 28, { width: 300 });
    doc.font("B").fontSize(10).fillColor(INK);
    text(STATUS_LABEL[o.status] ?? o.status, M, hy + 18, { width: W - 14, align: "right" });
    doc.y = hy + 60;

    const ty = doc.y;
    const times: [string, string][] = [
      ["Prihod", o.arrival ? hhmm(o.arrival) : "-"],
      ["Odhod", o.departure ? hhmm(o.departure) : o.arrival ? "še poteka" : "-"],
      ["Ure", hoursText(o.hours)],
    ];
    times.forEach(([label, value], i) => {
      const x = M + i * (W / 3);
      doc.font("R").fontSize(9).fillColor(MUTE);
      text(label, x, ty);
      doc.font("B").fontSize(12).fillColor(INK);
      text(value, x, ty + 13);
    });
    doc.moveTo(M, ty + 34).lineTo(M + W, ty + 34).lineWidth(0.7).strokeColor(LINE).stroke();
    doc.y = ty + 46;

    const heading = (s: string) => {
      ensure(40);
      doc.font("B").fontSize(11).fillColor(INK);
      text(s, M, doc.y);
      doc.y += 18;
    };
    const line = (s: string, color = INK) => {
      doc.font("R").fontSize(10.5).fillColor(color);
      const h = doc.heightOfString(s, { width: W });
      ensure(h + 4);
      doc.text(s, M, doc.y, { width: W });
      doc.y += 4;
    };

    heading("Opravljeno delo");
    const work = o.logs.filter((l) => l.description !== "Prijavljena težava");
    if (work.length === 0) line("Ni vnosov.", MUTE);
    for (const l of work) {
      line(`•  ${l.description}${l.quantity != null ? `  (${l.quantity} ${l.unit ?? ""})` : ""}`);
    }
    doc.y += 8;

    heading("Uporabljen material");
    const used = o.materials.filter((m) => m.usedQty != null);
    if (used.length === 0) line("Ni vnesenih količin.", MUTE);
    for (const m of used) line(`•  ${m.name}: ${m.usedQty}`);
    doc.y += 8;

    const problems = o.problems.filter(Boolean) as string[];
    if (problems.length > 0) {
      heading("Problemi in opombe");
      for (const p of problems) {
        doc.font("R").fontSize(10.5);
        const h = doc.heightOfString(p, { width: W - 28 });
        ensure(h + 24);
        const py = doc.y;
        doc.roundedRect(M, py, W, h + 16, 6).fill(PINK);
        doc.rect(M, py, 4, h + 16).fill(RED);
        doc.fillColor(RED);
        doc.text(p, M + 16, py + 8, { width: W - 28 });
        doc.y = py + h + 24;
      }
      doc.y += 2;
    }

    if (o.photos.length > 0) {
      heading("Fotografije");
      const cw = 163;
      const ch = 122;
      const gap = 13;
      o.photos.forEach((p, i) => {
        const col = i % 3;
        if (col === 0) ensure(ch + 30);
        const x = M + col * (cw + gap);
        const y = doc.y;
        doc.roundedRect(x, y, cw, ch, 6).fill(FOG);
        try {
          const data = photoData.get(p.id);
          if (!data) throw new Error("missing");
          doc.image(data, x + 4, y + 4, { fit: [cw - 8, ch - 8], align: "center", valign: "center" });
        } catch {
          doc.font("R").fontSize(9).fillColor(MUTE);
          text("Fotografije ni mogoče prikazati", x + 8, y + ch / 2 - 5, { width: cw - 16, align: "center" });
        }
        doc.font("R").fontSize(8.5).fillColor(MUTE);
        text(`${KIND_LABEL[p.kind] ?? p.kind}, ${hhmm(p.takenAt)}`, x, y + ch + 4, { width: cw });
        if (col === 2 || i === o.photos.length - 1) doc.y = y + ch + 24;
        else doc.y = y;
      });
    }

    doc.y += 14;
    if (doc.y < BOTTOM) {
      doc.moveTo(M, doc.y).lineTo(M + W, doc.y).lineWidth(0.7).strokeColor(LINE).stroke();
      doc.y += 18;
    }
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.page.margins.bottom = 0;
    doc.font("R").fontSize(8).fillColor(MUTE);
    text(`NOAH, dnevno poročilo, ${report.worker.name}, ${dateText}`, M, 812, { width: 360 });
    text(`Stran ${i + 1} od ${range.count}`, M, 812, { width: W, align: "right" });
  }

  doc.end();
}