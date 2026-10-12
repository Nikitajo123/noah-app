import { STATUS_LABEL } from "../format";
import type { Status } from "../types";
import { IconCheck } from "./Icons";

const STEPS: Status[] = ["NOV", "V_DELU", "ZAKLJUCEN"];

export default function StatusSteps({ status }: { status: Status }) {
  const cur = status === "PROBLEM" ? 1 : STEPS.indexOf(status);
  const closed = status === "ZAKLJUCEN";
  return (
    <ol className={status === "PROBLEM" ? "steps problem" : "steps"}>
      {STEPS.map((s, i) => {
        const done = i < cur || closed;
        const isCur = i === cur && !closed;
        return (
          <li
            key={s}
            className={done ? "done" : isCur ? "cur" : ""}
            aria-current={i === cur ? "step" : undefined}
          >
            <span className="dot">{done ? <IconCheck size={15} /> : i + 1}</span>
            <span className="lbl">{STATUS_LABEL[s]}</span>
          </li>
        );
      })}
    </ol>
  );
}
