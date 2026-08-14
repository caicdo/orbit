import { useStore } from "../lib/store";
import { useNav } from "../lib/navContext";
import { useTaskEditor } from "../components/TaskModalHost";
import TaskCheckbox from "../components/TaskCheckbox";
import { listColor } from "../lib/selectors";
import { dueLabel, formatHours, formatTime } from "../lib/time";
import { DUE } from "../lib/types";

export default function HomePage() {
  const { data, dispatch } = useStore();
  const { createTask } = useTaskEditor();
  const goTo = useNav();
  const { tasks, lists } = data;

  const open = tasks.filter((t) => t.status !== "done");
  const todayOpen = open.filter((t) => t.due === DUE.today);
  const scheduled = tasks.filter((t) => t.startMin !== null && t.startMin >= 0 && t.startMin < 1440);
  const scheduledMin = scheduled
    .filter((t) => t.status !== "done")
    .reduce((a, t) => a + t.estMin, 0);

  const stats = [
    { label: "Open tasks", value: open.length, note: `${lists.length} ${lists.length === 1 ? "list" : "lists"}` },
    { label: "Due today", value: todayOpen.length, note: `${todayOpen.filter((t) => t.important).length} important` },
    { label: "Scheduled", value: formatHours(scheduledMin), note: "on the day timeline" },
    {
      label: "Done today",
      value: tasks.filter((t) => t.status === "done" && t.due === DUE.today).length,
      note: "completed",
    },
  ];

  const isEmpty = tasks.length === 0 && lists.length === 0;
  const weekTasks = tasks
    .filter((t) => t.status !== "done" && t.due >= DUE.today && t.due < DUE.none)
    .sort((a, b) => a.due - b.due || a.createdAt - b.createdAt);

  return (
    <div className="scroll pad">
      {isEmpty ? (
        <div className="empty">
          <h4>Nothing here yet</h4>
          <p className="muted small">
            Make a list, add a few tasks, then open My day and drag them onto the timeline.
          </p>
          <div className="row gap">
            <button className="btn btn-primary" onClick={() => dispatch({ type: "list/add" })}>
              <i className="ph ph-plus" />
              New list
            </button>
            <button className="btn btn-secondary" onClick={() => createTask()}>
              <i className="ph ph-plus" />
              New task
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="section-title-row">
            <h4>Overview</h4>
            <span className="muted small">All time</span>
          </div>
          <div className="panel-stats">
            {stats.map((s) => (
              <button className="stat-tile" key={s.label} onClick={() => goTo("tasks")}>
                <div className="kicker">{s.label}</div>
                <div className="stat-value">{s.value}</div>
                <div className="muted small">{s.note}</div>
              </button>
            ))}
          </div>

          <section className="week-card">
            <header className="panel-head">
              <h4>This week</h4>
              <span className="muted small">{weekTasks.length} open</span>
            </header>
            <div className="week-list">
              {weekTasks.map((t) => (
                <div className="mini-row" key={t.id} onClick={() => goTo("tasks")}>
                  <TaskCheckbox task={t} />
                  <span className="dot" style={{ background: listColor(lists, t.listId) }} />
                  <span className="grow">{t.title}</span>
                  <span className="muted small">{dueLabel(t.due)}</span>
                </div>
              ))}
              {weekTasks.length === 0 && <p className="hint">Nothing on deck this week.</p>}
            </div>
          </section>

          <section className="day-strip" onClick={() => goTo("myday")}>
            <header className="panel-head">
              <h4>Today's timeline</h4>
              <span className="muted small">
                {scheduled.length} scheduled · {formatHours(scheduledMin)} planned
              </span>
            </header>
            <div className="strip-track">
              {[0, 6, 12, 18, 24].map((h) =>
                h === 24 ? (
                  <span key={h} className="strip-tick is-last">
                    12 AM
                  </span>
                ) : (
                  <span key={h} className="strip-tick" style={{ left: `${(h / 24) * 100}%` }}>
                    {formatTime(h * 60)}
                  </span>
                ),
              )}
              {scheduled.map((t) => (
                <div
                  key={t.id}
                  className={`strip-block${t.status === "done" ? " is-done" : ""}`}
                  style={{
                    left: `${(t.startMin! / 1440) * 100}%`,
                    width: `${Math.max((t.estMin / 1440) * 100, 0.8)}%`,
                    background: listColor(lists, t.listId),
                  }}
                  title={`${t.title} · ${formatTime(t.startMin!)}`}
                />
              ))}
              {scheduled.length === 0 && <p className="hint strip-hint">Nothing scheduled today.</p>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
