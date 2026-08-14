import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "../lib/store";
import type { Task } from "../lib/types";

/** Marks a task done, then asks for confirmation in the corner.
 *  "Not yet" restores the previous status. */
interface CompletionValue {
  complete(task: Task): void;
  uncomplete(task: Task): void;
}

const Ctx = createContext<CompletionValue | null>(null);
const DISMISS_MS = 7000;

export function CompletionHost({ children }: { children: ReactNode }) {
  const { dispatch } = useStore();
  const [pending, setPending] = useState<{ id: string; title: string; previous: Task["status"] } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const complete = useCallback(
    (task: Task) => {
      window.clearTimeout(timer.current);
      dispatch({ type: "task/update", id: task.id, fields: { status: "done", completedAt: Date.now() } });
      setPending({ id: task.id, title: task.title, previous: task.status });
      timer.current = window.setTimeout(() => setPending(null), DISMISS_MS);
    },
    [dispatch],
  );

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
    <Ctx.Provider value={{ complete, uncomplete }}>
      {children}
      {pending && (
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
    </Ctx.Provider>
  );
}

export function useCompletion(): CompletionValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCompletion must be used inside <CompletionHost>");
  return ctx;
}
