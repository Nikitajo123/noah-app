import type { ReactNode } from "react";
import { IconInbox } from "./Icons";

export function Skeleton({ rows = 3, variant = "card" }: { rows?: number; variant?: "card" | "line" }) {
  return (
    <div className={`skel-wrap ${variant}`} role="status" aria-live="polite">
      <span className="sr-only">Nalaganje...</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skel-item" aria-hidden="true">
          <span className="skel w40" />
          <span className="skel w80 tall" />
          <span className="skel w60" />
        </div>
      ))}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="spinner-page" role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only">Nalaganje...</span>
    </div>
  );
}

export function EmptyState({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-ic">{icon ?? <IconInbox size={28} />}</span>
      <p>{children}</p>
    </div>
  );
}
