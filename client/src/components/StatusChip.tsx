import { STATUS_LABEL } from "../format";
import type { Status } from "../types";

export default function StatusChip({ status }: { status: Status }) {
  return (
    <span className="chip" data-status={status}>
      <i />
      {STATUS_LABEL[status]}
    </span>
  );
}