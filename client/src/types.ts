export type Status = "NOV" | "V_DELU" | "ZAKLJUCEN" | "PROBLEM";

export type Project = { id: string; name: string; location: string };
export type Material = { id: string; name: string; usedQty: number | null };
export type TimeEntry = {
  id: string;
  startedAt: string;
  endedAt: string | null;
};

export type WorkOrder = {
  id: string;
  number: string;
  description: string;
  plannedQty: number | null;
  plannedUnit: string | null;
  plannedHours: number | null;
  dueDate: string;
  status: Status;
  project: Project;
  worker: { id: string; name: string };
  materials: Material[];
};

export type WorkOrderDetail = WorkOrder & {
  manager: { id: string; name: string };
  timeEntries: TimeEntry[];
};

export type ActiveEntry = {
  id: string;
  workOrderId: string;
  startedAt: string;
  endedAt: string | null;
  workOrder: { id: string; number: string; project: Project };
} | null;