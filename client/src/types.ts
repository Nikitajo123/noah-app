export type Status = "NOV" | "V_DELU" | "ZAKLJUCEN" | "PROBLEM";
export type PhotoKind = "PRED" | "MED" | "KONCANO" | "PROBLEM";

export type Project = { id: string; name: string; location: string };
export type Material = { id: string; name: string; usedQty: number | null };

export type TimeEntryEdit = {
  id: string;
  reason: string;
  oldStartedAt: string;
  oldEndedAt: string | null;
  newStartedAt: string;
  newEndedAt: string;
  createdAt: string;
  editedBy: { id: string; name: string };
};

export type TimeEntry = {
  id: string;
  user?: { id: string; name: string };
  startedAt: string;
  endedAt: string | null;
  edits?: TimeEntryEdit[];
};

export type OrderNote = {
  id: string;
  text: string;
  resolved: boolean;
  createdAt: string;
  author: { id: string; name: string };
};

export type WorkOrder = {
  id: string;
  number: string;
  description: string;
  plannedQty: number | null;
  plannedUnit: string | null;
  plannedHours: number | null;
  dueDate: string;
  workDate: string;
  status: Status;
  project: Project;
  worker: { id: string; name: string };
  workers: { id: string; name: string }[];
  materials: Material[];
};

export type WorkLog = {
  id: string;
  user?: { id: string; name: string };
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
  photos: Photo[];
  notes: OrderNote[];
};

export type ActiveEntry = {
  id: string;
  workOrderId: string;
  startedAt: string;
  endedAt: string | null;
  workOrder: { id: string; number: string; project: Project };
} | null;

export type ReportOrder = {
  workOrderId: string;
  number: string;
  status: Status;
  project: { name: string; location: string };
  arrival: string | null;
  departure: string | null;
  hours: number;
  logs: { description: string; quantity: number | null; unit: string | null; note: string | null }[];
  materials: { name: string; usedQty: number | null }[];
  problems: (string | null)[];
  photos: Photo[];
};

export type DailyReportData = {
  date: string;
  worker: { id: string; name: string };
  status: "OSNUTEK" | "ODDANO";
  submittedAt: string | null;
  totalHours: number;
  orders: ReportOrder[];
};

export type OverviewRow = {
  workOrderId: string;
  number: string;
  worker: { id: string; name: string };
  project: Project;
  arrival: string | null;
  departure: string | null;
  hours: number | null;
  status: Status;
};

export type DayReportRow = {
  userId: string;
  name: string;
  status: "OSNUTEK" | "ODDANO";
  submittedAt: string | null;
  totalHours: number;
  orders: number;
  photos: number;
  problem: boolean;
};

export type TeamPerson = { id: string; name: string };
export type Team = { id: string; name: string; foreman: TeamPerson; members: TeamPerson[] };
export type MyTeam = { team: Team | null; isForeman: boolean };

export type TeamReportOrder = {
  workOrderId: string;
  number: string;
  status: Status;
  project: { name: string; location: string };
  hours: number;
  workers: {
    userId: string;
    name: string;
    arrival: string | null;
    departure: string | null;
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
  photos: Photo[];
};

export type TeamReportData = {
  date: string;
  team: Team;
  status: "OSNUTEK" | "ODDANO";
  summary: string | null;
  submittedAt: string | null;
  submittedBy: string | null;
  totalHours: number;
  orders: TeamReportOrder[];
};

export type TeamDayRow = {
  teamId: string;
  name: string;
  foreman: string;
  members: number;
  status: "OSNUTEK" | "ODDANO";
  submittedAt: string | null;
  totalHours: number;
  orders: number;
  photos: number;
  problem: boolean;
};

export type ProjectHoursData = {
  from: string;
  to: string;
  totalHours: number;
  projects: {
    projectId: string;
    name: string;
    location: string;
    hours: number;
    orders: number;
    workers: { name: string; hours: number }[];
  }[];
};