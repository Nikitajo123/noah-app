export type Status = "NOV" | "V_DELU" | "ZAKLJUCEN" | "PROBLEM";
export type PhotoKind = "PRED" | "MED" | "KONCANO" | "PROBLEM";

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

export type WorkLog = {
  id: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  createdAt: string;
};

export type Photo = {
  id: string;
  kind: PhotoKind;
  path: string;
  takenAt: string;
};

export type WorkOrderDetail = WorkOrder & {
  manager: { id: string; name: string };
  timeEntries: TimeEntry[];
  workLogs: WorkLog[];
  photos: Photo[]
};

export type ActiveEntry = {
  id: string;
  workOrderId: string;
  startedAt: string;
  endedAt: string | null;
  workOrder: { id: string; number: string; project: Project };
} | null;