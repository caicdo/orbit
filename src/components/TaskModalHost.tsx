import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { uid } from "../lib/id";
import { newTask } from "../lib/reducer";
import { useStore } from "../lib/store";
import { DUE, type Status, type Task } from "../lib/types";

/** Centered task editor (Trello-style). Opening a brand-new task and closing it
 *  without changing anything deletes it again. */
interface EditorValue {
  openTask(id: string): void;
  createTask(seed?: Partial<Task>): void;
  editingId: string | null;
}

const Ctx = createContext<EditorValue | null>(null);

export function TaskModalHost({ children }: { children: ReactNode }) {
  const { data, dispatch } = useStore();
  const [state, setState] = useState<{ id: string; isNew: boolean; snapshot: string } | null>(null);
  const [stepDraft, setStepDraft] = useState("");
  const closing = useRef(false);

  const task = state ? data.tasks.find((t) => t.id === state.id) : undefined;

  const openTask = useCallback(
    (id: string) => {
      const found = data.tasks.find((t) => t.id === id);
      if (!found) return;
      setStepDraft("");
      setState({ id, isNew: false, snapshot: JSON.stringify(found) });
    },
    [data.tasks],
  );

  const createTask = useCallback(
    (seed: Partial<Task> = {}) => {
      const created = newTask({ listId: data.prefs.filterListId ?? null, ...seed });
      dispatch({ type: "task/add", task: created });
      setStepDraft("");
      setState({ id: created.id, isNew: true, snapshot: JSON.stringify(created) });
    },
    [dispatch, data.prefs.filterListId],
  );

  const close = useCallback(
    (action: "save" | "cancel" | "delete") => {
      if (!state || closing.current) return;
      closing.current = true;
      const current = data.tasks.find((t) => t.id === state.id);
      if (current) {
        if (action === "delete" || (action === "cancel" && state.isNew)) {
          dispatch({ type: "task/remove", id: state.id });
        } else if (action === "cancel") {
          dispatch({ type: "task/replace", task: JSON.parse(state.snapshot) as Task });
        }
      }
      setState(null);
      setTimeout(() => (closing.current = false), 0);
    },
    [state, data.tasks, dispatch],
  );

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close("cancel");
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, close]);

  const set = (fields: Partial<Task>) => task && dispatch({ type: "task/update", id: task.id, fields });

  const hasLists = data.lists.length > 0;
  const titleOk = Boolean(task && task.title.trim());
  const listOk = Boolean(task && (!hasLists || task.listId));
  const valid = titleOk && listOk;

  return (
    <Ctx.Provider value={{ openTask, createTask, editingId: state?.id ?? null }}>
      {children}
      {task && state && (
        <div className="modal-backdrop" onMouseDown={() => close("cancel")}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <header className="modal-head">
              <span className="kicker">{state.isNew ? "New task" : "Edit task"}</span>
              <button
                className={`btn btn-icon${task.important ? " is-on" : ""}`}
                title="Important"
                onClick={() => set({ important: !task.important })}
              >
                <i className={task.important ? "ph-fill ph-star" : "ph ph-star"} />
              </button>
              <button className="btn btn-icon" title="Close" onClick={() => close("cancel")}>
                <i className="ph ph-x" />
              </button>
            </header>

            <input
              className={`input modal-title${titleOk ? "" : " needs"}`}
              autoFocus
              value={task.title}
              placeholder="What needs doing?"
              onChange={(e) => set({ title: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && valid && close("save")}
            />
            <div className={`modal-hint${valid ? "" : " needs"}`}>
              {!titleOk ? "A title is required." : !listOk ? "Pick a list before saving." : ""}
            </div>

            <div className="modal-grid">
              <label className="field">
                <span>List</span>
                <select
                  className={`input${listOk ? "" : " needs"}`}
                  value={task.listId ?? ""}
                  onChange={(e) => set({ listId: e.target.value || null })}
                >
                  <option value="">{hasLists ? "Choose a list…" : "No list"}</option>
                  {data.lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Due</span>
                <select
                  className="input"
                  value={task.due}
                  onChange={(e) => set({ due: Number(e.target.value) as Task["due"] })}
                >
                  <option value={DUE.today}>Today</option>
                  <option value={DUE.tomorrow}>Tomorrow</option>
                  <option value={DUE.week}>Later this week</option>
                  <option value={DUE.none}>No date</option>
                </select>
              </label>

              <label className="field">
                <span>Status</span>
                <select
                  className="input"
                  value={task.status}
                  onChange={(e) => {
                    const status = e.target.value as Status;
                    set({ status, completedAt: status === "done" ? Date.now() : null });
                  }}
                >
                  <option value="todo">To do</option>
                  <option value="doing">In progress</option>
                  <option value="done">Done</option>
                </select>
              </label>

              <label className="field">
                <span>Remind me</span>
                <select
                  className="input"
                  value={task.remind}
                  onChange={(e) => set({ remind: e.target.value as Task["remind"] })}
                >
                  <option value="none">No reminder</option>
                  <option value="15m">15 min before</option>
                  <option value="1h">1 hour before</option>
                  <option value="morning">Morning of</option>
                </select>
              </label>

              <label className="field">
                <span>Repeat</span>
                <select
                  className="input"
                  value={task.repeat}
                  onChange={(e) => set({ repeat: e.target.value as Task["repeat"] })}
                >
                  <option value="none">Never</option>
                  <option value="daily">Daily</option>
                  <option value="weekdays">Weekdays</option>
                  <option value="weekly">Weekly</option>
                </select>
              </label>

              <label className="field">
                <span>Length</span>
                <select
                  className="input"
                  value={task.estMin}
                  onChange={(e) => set({ estMin: Number(e.target.value) })}
                >
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                </select>
              </label>
            </div>

            <button
              className={`btn btn-ghost modal-myday${task.myDay ? " is-on" : ""}`}
              onClick={() => set({ myDay: !task.myDay })}
            >
              <i className="ph ph-sun" />
              {task.myDay ? "Added to My day" : "Add to My day"}
            </button>

            <div className="rule" />

            <div className="kicker">Steps</div>
            {task.steps.map((s) => (
              <div className="step" key={s.id}>
                <button
                  className={`check${s.done ? " is-done" : ""}`}
                  onClick={() =>
                    set({ steps: task.steps.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })
                  }
                >
                  <i className="ph ph-check" />
                </button>
                <span className={s.done ? "is-struck" : ""}>{s.text}</span>
                <button
                  className="btn btn-icon"
                  onClick={() => set({ steps: task.steps.filter((x) => x.id !== s.id) })}
                >
                  <i className="ph ph-x" />
                </button>
              </div>
            ))}
            <input
              className="input ghost-input"
              value={stepDraft}
              placeholder="+ Add step"
              onChange={(e) => setStepDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || !stepDraft.trim()) return;
                set({ steps: [...task.steps, { id: uid(), text: stepDraft.trim(), done: false }] });
                setStepDraft("");
              }}
            />

            <label className="field notes">
              <span>Notes</span>
              <textarea
                className="input"
                rows={3}
                value={task.notes}
                placeholder="Add note"
                onChange={(e) => set({ notes: e.target.value })}
              />
            </label>

            <footer className="modal-foot">
              <button className="btn btn-ghost" onClick={() => close("delete")}>
                <i className="ph ph-trash" />
                Delete
              </button>
              <span className="spacer" />
              <button className="btn btn-ghost" onClick={() => close("cancel")}>
                {state.isNew ? "Discard" : "Cancel"}
              </button>
              <button className="btn btn-primary" disabled={!valid} onClick={() => close("save")}>
                {state.isNew ? "Add task" : "Save"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useTaskEditor(): EditorValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTaskEditor must be used inside <TaskModalHost>");
  return ctx;
}
