import { useCompletion } from "./CompletionHost";
import type { Task } from "../lib/types";

export default function TaskCheckbox({ task }: { task: Task }) {
  const { complete, uncomplete } = useCompletion();
  const done = task.status === "done";
  return (
    <button
      className={`check${done ? " is-done" : ""}`}
      title={done ? "Mark as not done" : "Mark as done"}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        done ? uncomplete(task) : complete(task);
      }}
    >
      <i className="ph ph-check" />
    </button>
  );
}
