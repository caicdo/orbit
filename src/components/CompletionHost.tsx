import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "../lib/store";
import type { Task } from "../lib/types";

/** Two ways a task gets marked done. The checkbox everywhere (Home, Tasks,
 *  the My-day bucket list) just finishes it — a quiet toast with an Undo is
 *  all that's warranted for a click someone chose to make. A task programmed
 *  onto the day timeline gets the heavier "did you actually finish this?"
 *  check, since that's a block of planned time being closed out, not just a
 *  list item ticked off. Both offer the same escape hatch: undo restores the
 *  previous status. */
interface CompletionValue {
  completeSimple(task: Task): void;
  completeConfirm(task: Task): void;
  uncomplete(task: Task): void;
}

const Ctx = createContext<CompletionValue | null>(null);
const CONFIRM_MS = 7000;
const SIMPLE_MS = 5000;

type Pending = { id: string; title: string; previous: Task["status"]; mode: "simple" | "confirm" };

export function CompletionHost({ children }: { children: ReactNode }) {
  const { dispatch } = useStore();
  const [pending, setPending] = useState<Pending | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const finish = useCallback(
    (task: Task, mode: Pending["mode"]) => {
      window.clearTimeout(timer.current);
      dispatch({ type: "task/update", id: task.id, fields: { status: "done", completedAt: Date.now() } });
      setPending({ id: task.id, title: task.title, previous: task.status, mode });
      timer.current = window.setTimeout(() => setPending(null), mode === "confirm" ? CONFIRM_MS : SIMPLE_MS);
    },
    [dispatch],
  );

  const completeSimple = useCallback((task: Task) => finish(task, "simple"), [finish]);
  const completeConfirm = useCallback((task: Task) => finish(task, "confirm"), [finish]);

  const uncomplete = useCallback(
    (task: Task) => {
      dispatch({ type: "task/update", id: task.id, fields: { status: "todo", completedAt: null } });
    },
    [dispatch],
  );

  const keep = () => {
    window.clearTimeout(timer.current);
    setPending(null);
  };

  const restore = () => {
    window.clearTimeout(timer.current);
    if (pending)
      dispatch({
        type: "task/update",
        id: pending.id,
        fields: { status: pending.previous === "done" ? "todo" : pending.previous, completedAt: null },
      });
    setPending(null);
  };

  return (
    <Ctx.Provider value={{ completeSimple, completeConfirm, uncomplete }}>
      {children}
      {pending && pending.mode === "confirm" && (
        <div className="toast">
          <div className="toast-body">Did you complete the task “{pending.title}”?</div>
          <div className="toast-actions">
            <button className="btn btn-ghost small" onClick={restore}>
              Not yet
            </button>
            <button className="btn btn-primary small" onClick={keep}>
              Yes, done
            </button>
          </div>
        </div>
      )}
      {pending && pending.mode === "simple" && (
        <div className="toast">
          <div className="toast-body">Task “{pending.title}” finished</div>
          <div className="toast-actions">
            <button className="btn btn-ghost small" onClick={restore}>
              Undo
            </button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useCompletion(): CompletionValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCompletion must be used inside <CompletionHost>");
  return ctx;
}
