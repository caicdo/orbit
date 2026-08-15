import { useEffect, useRef, useState } from "react";
import DueBadge from "../components/DueBadge";
import TaskCheckbox from "../components/TaskCheckbox";
import { useTaskEditor } from "../components/TaskModalHost";
import { useStore } from "../lib/store";
import { STATUS_COLUMNS, collapseDone, listColor, listName, visibleTasks } from "../lib/selectors";
import { armOnHold } from "../lib/dragArm";
import type { Status, Task } from "../lib/types";

export default function TasksPage() {
  const { data, dispatch } = useStore();
  const { createTask, openTask, editingId } = useTaskEditor();
  const { prefs, lists } = data;
  const [dragId, setDragId] = useState<string | null>(null);
  const [hotColumn, setHotColumn] = useState<Status | null>(null);
  const moved = useRef(false);

  // Drag a task onto a column (status change) or onto another task (reorder).
  // In the flat list view dropping only reorders — status there has no position.
  useEffect(() => {
    if (!dragId) return;
    const pureReorder = prefs.view === "list";

    const onMove = (e: MouseEvent) => {
      moved.current = true;
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const overTask = (el?.closest("[data-task-id]") as HTMLElement | null)?.dataset.taskId;
      const overCol = (el?.closest("[data-status]") as HTMLElement | null)?.dataset.status as
        | Status
        | undefined;
      setHotColumn(pureReorder ? null : overCol ?? null);

      if (overTask && overTask !== dragId) {
        dispatch({ type: "task/move", id: dragId, beforeId: overTask, adoptStatus: !pureReorder });
      } else if (overCol && !pureReorder) {
        dispatch({ type: "task/update", id: dragId, fields: { status: overCol } });
      }
    };
    const onUp = () => {
      setDragId(null);
      setHotColumn(null);
      setTimeout(() => (moved.current = false), 60);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragId, prefs.view, dispatch]);

  const vis = visibleTasks(data);
  const showMoreBtn = (hidden: number) => (
    <button
      className="btn btn-ghost show-more"
      onClick={() => dispatch({ type: "prefs/set", fields: { showDone: !prefs.showDone } })}
    >
      <i className={prefs.showDone ? "ph ph-caret-up" : "ph ph-caret-down"} />
      {prefs.showDone
        ? "Hide finished tasks"
        : `Show ${hidden} more finished ${hidden === 1 ? "task" : "tasks"}`}
    </button>
  );

  const columns = STATUS_COLUMNS.map((c) => {
    const all = vis.filter((t) => t.status === c.key);
    if (c.key !== "done") return { ...c, tasks: all, total: all.length, hidden: 0 };
    const { visible, total, hidden } = collapseDone(all, prefs.showDone);
    return { ...c, tasks: visible, total, hidden };
  });

  // The list's color tints the card itself (board + cards views only — the flat
  // list view keeps its plain row with just a color dot). A CSS var, not a
  // literal `background`, so hover/selected/dragging states in app.css still win.
  const cardProps = (t: Task) => ({
    "data-task-id": t.id,
    className: `task-card${editingId === t.id ? " is-selected" : ""}${dragId === t.id ? " is-dragging" : ""}`,
    style: { "--list-tint": listColor(lists, t.listId) } as React.CSSProperties,
    onMouseDown: (e: React.MouseEvent) => armOnHold(e, () => setDragId(t.id)),
    onClick: () => !moved.current && openTask(t.id),
  });

  if (data.tasks.length === 0)
    return (
      <div className="scroll pad">
        <div className="empty">
          <h4>No tasks yet</h4>
          <p className="muted small">Everything you add shows up in all three views.</p>
          <button className="btn btn-primary" onClick={() => createTask()}>
            <i className="ph ph-plus" />
            New task
          </button>
        </div>
      </div>
    );

  return (
    <div className="scroll pad">
      {prefs.view === "board" && (
        <div className="board">
          {columns.map((c) => (
            <div
              key={c.key}
              data-status={c.key}
              className={`column${hotColumn === c.key ? " is-hot" : ""}`}
            >
              <div className="column-head">
                <span className="dot round" style={{ background: c.dot }} />
                <span className="kicker">{c.title}</span>
                <span className="badge">{c.total}</span>
              </div>
              {c.tasks.map((t) => (
                <div key={t.id} {...cardProps(t)}>
                  <div className="row start">
                    <TaskCheckbox task={t} />
                    <span className={`grow${t.status === "done" ? " is-struck" : ""}`}>{t.title}</span>
                    <i
                      className={t.important ? "ph-fill ph-star" : "ph ph-star"}
                      style={{ color: t.important ? "#b5abfc" : "#4b4e5c" }}
                    />
                  </div>
                  <div className="card-meta">
                    <span className="dot" style={{ background: listColor(lists, t.listId) }} />
                    <span>{listName(lists, t.listId)}</span>
                    <DueBadge due={t.due} />
                    <span className="spacer" />
                    <span>
                      {t.steps.length
                        ? `${t.steps.filter((s) => s.done).length}/${t.steps.length} steps`
                        : ""}
                    </span>
                  </div>
                </div>
              ))}
              {c.key === "done" && c.total > 1 && showMoreBtn(c.hidden)}
              <button className="btn btn-ghost add" onClick={() => createTask({ status: c.key })}>
                <i className="ph ph-plus" />
                Add
              </button>
            </div>
          ))}
        </div>
      )}

      {prefs.view === "list" && (
        <div className="flat">
          <div className="flat-head">
            <span className="col-check" />
            <span className="grow">Task</span>
            <span className="col-md">List</span>
            <span className="col-sm">Due</span>
            <span className="col-sm">Status</span>
          </div>
          {(() => {
            const open = vis.filter((t) => t.status !== "done");
            const done = collapseDone(
              vis.filter((t) => t.status === "done"),
              prefs.showDone,
            );
            return (
              <>
                {[...open, ...done.visible].map((t) => (
                  <div
                    key={t.id}
                    data-task-id={t.id}
                    className={`flat-row${editingId === t.id ? " is-selected" : ""}${
                      dragId === t.id ? " is-dragging" : ""
                    }`}
                    onMouseDown={(e) => armOnHold(e, () => setDragId(t.id))}
                    onClick={() => !moved.current && openTask(t.id)}
                  >
                    <TaskCheckbox task={t} />
                    <span className={`grow${t.status === "done" ? " is-struck" : ""}`}>{t.title}</span>
                    <span className="col-md muted small row">
                      <span className="dot" style={{ background: listColor(lists, t.listId) }} />
                      {listName(lists, t.listId)}
                    </span>
                    <span className="col-sm small"><DueBadge due={t.due} /></span>
                    <span className="col-sm">
                      <span className={`pill is-${t.status}`}>
                        {t.status === "todo" ? "To do" : t.status === "doing" ? "In progress" : "Done"}
                      </span>
                    </span>
                  </div>
                ))}
                {done.total > 1 && showMoreBtn(done.hidden)}
              </>
            );
          })()}
        </div>
      )}

      {prefs.view === "cards" && (
        <div className="groups">
          {columns.map((c) => (
            <div
              key={c.key}
              data-status={c.key}
              className={`group${hotColumn === c.key ? " is-hot" : ""}`}
            >
              <div className="column-head">
                <span className="dot round" style={{ background: c.dot }} />
                <span className="kicker">{c.title}</span>
                <span className="badge">{c.total}</span>
              </div>
              <div className="card-grid">
                {c.tasks.map((t) => {
                  const { style, ...rest } = cardProps(t);
                  return (
                    <div
                      key={t.id}
                      {...rest}
                      style={{ ...style, borderLeft: `2px solid ${listColor(lists, t.listId)}` }}
                    >
                      <div className="row start">
                        <TaskCheckbox task={t} />
                        <span className={`grow${t.status === "done" ? " is-struck" : ""}`}>{t.title}</span>
                      </div>
                      <div className="card-meta">
                        <span>{listName(lists, t.listId)}</span>
                        <DueBadge due={t.due} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {c.key === "done" && c.total > 1 && showMoreBtn(c.hidden)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
