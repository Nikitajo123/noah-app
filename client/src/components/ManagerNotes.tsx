import { formatTime } from "../format";
import type { OrderNote } from "../types";

export default function ManagerNotes({ notes }: { notes: OrderNote[] }) {
  if (notes.length === 0) return null;
  return (
    <div className="section panel">
      <h3 className="panel-title">Sporočila vodje</h3>
      <div className="notes">
        {notes.map((n) => (
          <div key={n.id} className={n.resolved ? "note resolved" : "note"}>
            <div className="note-head">
              <span>
                {n.author.name},{" "}
                {new Date(n.createdAt).toLocaleDateString("sl-SI", { day: "numeric", month: "numeric" })}{" "}
                {formatTime(n.createdAt)}
              </span>
              {n.resolved && <b className="note-tag">Rešeno</b>}
            </div>
            <p>{n.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}