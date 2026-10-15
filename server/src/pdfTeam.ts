import PDFDocument from "pdfkit";
import path from "path";

export type TeamPdfReport = {
  date: string;
  team: {
    name: string;
    foreman: { name: string };
    members: { name: string }[];
  };
  status: "OSNUTEK" | "ODDANO";
  summary: string | null;
  submittedAt: Date | null;
  submittedBy: string | null;
  totalHours: number;
  orders: {
    number: string;
    status: string;
    project: { name: string; location: string };
    hours: number;
    workers: {
      name: string;
      arrival: Date | null;
      departure: Date | null;
      hours: number;
      running: boolean;
    }[];
    logs: {
      author: string;
      description: string;
      quantity: number | null;
      unit: string | null;
      note: string | null;
    }[];
    materials: { name: string; usedQty: number | null }[];
    problems: { author: string; text: string }[];
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

export function streamTeamReportPdf(
  report: TeamPdfReport,
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
  text("Poročilo ekipe", M, 72);
  const dateText = new Date(`${report.date}T12:00:00`).toLocaleDateString("sl-SI", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
  doc.font("B").fontSize(16).fillColor("#FFFFFF");
  text(dateText, M, 44, { width: W, align: "right" });

  // Summary row
  const sy = 124;
  const summary: [string, string][] = [
    ["Ekipa", report.team.name],
    ["Delovodja", report.team.foreman.name],
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
  doc.y = sy + 54;

  // Members line
  doc.font("R").fontSize(9.5).fillColor(MUTE);
  const membersLine =
    `Člani: ${report.team.members.map((m) => m.name).join(", ")}.` +
    (report.submittedBy ? ` Oddal: ${report.submittedBy}.` : "");
  const mh = doc.heightOfString(membersLine, { width: W });
  doc.text(membersLine, M, doc.y, { width: W });
  doc.y += mh > 0 ? 8 : 0;

  // Foreman summary
  if (report.summary) {
    doc.font("R").fontSize(10.5);
    const h = doc.heightOfString(report.summary, { width: W - 28 });
    ensure(h + 40);
    const py = doc.y;
    doc.roundedRect(M, py, W, h + 34, 8).fill(FOG);
    doc.rect(M, py, 4, h + 34).fill(ACC);
    doc.font("R").fontSize(8.5).fillColor(MUTE);
    text("Povzetek dneva", M + 16, py + 8);
    doc.font("R").fontSize(10.5).fillColor(INK);
    doc.text(report.summary, M + 16, py + 22, { width: W - 28 });
    doc.y = py + h + 46;
  } else {
    doc.y += 6;
  }

  if (report.orders.length === 0) {
    doc.font("R").fontSize(12).fillColor(MUTE);
    text("Za ta dan ni vnosov ekipe.", M, doc.y);
  }

  for (const o of report.orders) {
    ensure(170);
    const hy = doc.y;
    doc.roundedRect(M, hy, W, 46, 8).fill(FOG);
    doc.font("B").fontSize(14).fillColor(INK);
    text(o.project.name, M + 14, hy + 9, { width: 300 });
    doc.font("R").fontSize(10).fillColor(MUTE);
    text(`${o.project.location}, nalog ${o.number}`, M + 14, hy + 28, { width: 300 });
    doc.font("B").fontSize(10).fillColor(INK);
    text(STATUS_LABEL[o.status] ?? o.status, M, hy + 18, { width: W - 14, align: "right" });
    doc.y = hy + 58;

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

    heading("Delavci in ure");
    for (const w of o.workers) {
      ensure(24);
      const ry = doc.y;
      doc.font("R").fontSize(10.5).fillColor(INK);
      text(w.name, M, ry, { width: 200 });
      doc.fillColor(MUTE);
      text(
        `${w.arrival ? hhmm(w.arrival) : "-"} do ${w.departure ? hhmm(w.departure) : "še poteka"}`,
        M + 210,
        ry,
        { width: 160 }
      );
      doc.font("B").fillColor(INK);
      text(hoursText(w.hours), M, ry, { width: W, align: "right" });
      doc.moveTo(M, ry + 17).lineTo(M + W, ry + 17).lineWidth(0.5).strokeColor(LINE).stroke();
      doc.y = ry + 22;
    }
    ensure(24);
    const ty = doc.y;
    doc.font("B").fontSize(10.5).fillColor(INK);
    text("Ure naloga", M, ty);
    text(hoursText(o.hours), M, ty, { width: W, align: "right" });
    doc.y = ty + 28;

    heading("Opravljeno delo");
    const work = o.logs.filter((l) => l.description !== "Prijavljena težava");
    if (work.length === 0) line("Ni vnosov.", MUTE);
    for (const l of work) {
      line(
        `•  ${l.description}${l.quantity != null ? `  (${l.quantity} ${l.unit ?? ""})` : ""}  [${l.author}]`
      );
    }
    doc.y += 8;

    heading("Uporabljen material");
    const used = o.materials.filter((m) => m.usedQty != null);
    if (used.length === 0) line("Ni vnesenih količin.", MUTE);
    for (const m of used) line(`•  ${m.name}: ${m.usedQty}`);
    doc.y += 8;

    if (o.problems.length > 0) {
      heading("Problemi in opombe");
      for (const p of o.problems) {
        const s = `${p.text} [${p.author}]`;
        doc.font("R").fontSize(10.5);
        const h = doc.heightOfString(s, { width: W - 28 });
        ensure(h + 24);
        const py = doc.y;
        doc.roundedRect(M, py, W, h + 16, 6).fill(PINK);
        doc.rect(M, py, 4, h + 16).fill(RED);
        doc.fillColor(RED);
        doc.text(s, M + 16, py + 8, { width: W - 28 });
        doc.y = py + h + 24;
      }
      doc.y += 2;
    }

    if (o.photos.length > 0) {
      ensure(122 + 60);
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
    text(`NOAH, poročilo ekipe ${report.team.name}, ${dateText}`, M, 812, { width: 360 });
    text(`Stran ${i + 1} od ${range.count}`, M, 812, { width: W, align: "right" });
  }

  doc.end();
}