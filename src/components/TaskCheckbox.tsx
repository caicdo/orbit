import { useCompletion } from "./CompletionHost";
import type { Task } from "../lib/types";

/** `confirmOnComplete` is only set on the day timeline's own checkbox — every
 *  other checkbox in the app (Home, Tasks, the My-day bucket list) finishes
 *  the task immediately with just an Undo toast. */
export default function TaskCheckbox({ task, confirmOnComplete = false }: { task: Task; confirmOnComplete?: boolean }) {
  const { completeSimple, completeConfirm, uncomplete } = useCompletion();
  const done = task.status === "done";
  return (
    <button
      className={`check${done ? " is-done" : ""}`}
      title={done ? "Mark as not done" : "Mark as done"}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        if (done) uncomplete(task);
        else if (confirmOnComplete) completeConfirm(task);
        else completeSimple(task);
      }}
    >
      <i className="ph ph-check" />
    </button>
  );
}
