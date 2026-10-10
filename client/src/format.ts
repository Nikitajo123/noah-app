import type { Status, WorkOrder } from "./types";

export const STATUS_LABEL: Record<Status, string> = {
  NOV: "Novo",
  V_DELU: "V delu",
  ZAKLJUCEN: "Zaključen",
  PROBLEM: "Problem",
};

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" });
}

export function formatDue(iso: string) {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(new Date(iso)) - day(new Date())) / 86400000);
  if (diff === 0) return "danes";
  if (diff === 1) return "jutri";
  if (diff === -1) return "včeraj";
  return new Date(iso).toLocaleDateString("sl-SI", { day: "numeric", month: "numeric" });
}

export function plannedText(o: WorkOrder) {
  return [
    o.plannedQty != null ? `${o.plannedQty} ${o.plannedUnit ?? ""}`.trim() : null,
    o.plannedHours != null ? `${o.plannedHours} ur` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

export function formatHours(h: number) {
  const m = Math.round(h * 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}