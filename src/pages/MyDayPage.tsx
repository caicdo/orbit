import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TaskCheckbox from "../components/TaskCheckbox";
import Timeline from "../components/Timeline";
import { useTaskEditor } from "../components/TaskModalHost";
import { useStore } from "../lib/store";
import { BUCKETS, bucketTasks, listColor, listName, scheduledTasks } from "../lib/selectors";
import { formatHours, formatRange, geometry, minutesNow, snap } from "../lib/time";
import type { BucketKey, Task } from "../lib/types";

type DragMode = "schedule" | "move" | "resize-top" | "resize-bottom";
interface Drag {
  id: string;
  mode: DragMode;
  grabOffset: number;
  startY: number;
  startMin: number | null;
  startEst: number;
  moved: boolean;
}

export default function MyDayPage() {
  const { data, dispatch } = useStore();
  const { openTask } = useTaskEditor();
  const { tasks, lists, prefs } = data;
  const [nowMin, setNowMin] = useState(() => minutesNow());
  const [drag, setDrag] = useState<Drag | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  const geo = useMemo(() => geometry(nowMin, prefs.zoom), [nowMin, prefs.zoom]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMin(minutesNow()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const scrollToNow = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = Math.max(0, geo.topFor(nowMin) - el.clientHeight * 0.3);
  }, [geo, nowMin]);

  // Center on now when the page opens.
  useEffect(() => {
    const id = window.setTimeout(scrollToNow, 60);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** When an open bucket empties (its last task got scheduled onto the day), close
   *  it and open the next one that has tasks. When a *closed* bucket gains a task
   *  back (e.g. a card is dragged off the timeline into it), reopen just that
   *  bucket — the other open buckets are left exactly as they are. `prevCounts`
   *  is null until the first real call so mount doesn't treat a saved closed-but-
   *  nonempty bucket as something that just "regained" a task. */
  const prevCounts = useRef<Record<BucketKey, number> | null>(null);
  const rebalance = useCallback(
    (next: Task[]) => {
      const counts = Object.fromEntries(
        BUCKETS.map((b) => [b.key, bucketTasks(next, b.key).length]),
      ) as Record<BucketKey, number>;
      const prev = prevCounts.current;
      const buckets = { ...prefs.buckets };
      let changed = false;

      if (prev) {
        BUCKETS.forEach((b) => {
          if (buckets[b.key] && counts[b.key] === 0 && prev[b.key] > 0) {
            buckets[b.key] = false;
            changed = true;
          } else if (!buckets[b.key] && counts[b.key] > 0 && prev[b.key] === 0) {
            buckets[b.key] = true;
            changed = true;
          }
        });
      }

      if (!BUCKETS.some((b) => buckets[b.key])) {
        const first = BUCKETS.find((b) => counts[b.key] > 0);
        buckets[first ? first.key : "today"] = true;
        changed = true;
      }

      prevCounts.current = counts;
      if (changed) dispatch({ type: "prefs/set", fields: { buckets } });
    },
    [prefs.buckets, dispatch],
  );

  useEffect(() => {
    if (!drag) return;

    const overTimeline = (x: number, y: number) => {
      const el = scrollRef.current;
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };

    const minAtClientY = (clientY: number, grabOffset: number) => {
      const el = scrollRef.current!;
      const r = el.getBoundingClientRect();
      return geo.minAt(clientY - r.top + el.scrollTop - grabOffset);
    };

    const onMove = (e: MouseEvent) => {
      setPointer({ x: e.clientX, y: e.clientY });
      if (!drag.moved && Math.abs(e.clientY - drag.startY) > 3) {
        moved.current = true;
        setDrag({ ...drag, moved: true });
      }

      if (drag.mode === "schedule" || drag.mode === "move") {
        if (overTimeline(e.clientX, e.clientY)) {
          const min = Math.max(geo.windowStart, snap(minAtClientY(e.clientY, drag.grabOffset)));
          dispatch({ type: "task/update", id: drag.id, fields: { startMin: min } });
        } else if (drag.mode === "move") {
          dispatch({ type: "task/update", id: drag.id, fields: { startMin: null } });
        }
        return;
      }

      const delta = snap((e.clientY - drag.startY) / geo.pxPerMin);
      if (drag.mode === "resize-bottom") {
        dispatch({ type: "task/update", id: drag.id, fields: { estMin: Math.max(15, drag.startEst + delta) } });
      } else {
        const base = drag.startMin ?? 0;
        const start = Math.min(base + drag.startEst - 15, base + delta);
        dispatch({
          type: "task/update",
          id: drag.id,
          fields: { startMin: start, estMin: Math.max(15, drag.startEst - (start - base)) },
        });
      }
    };

    const onUp = () => {
      setDrag(null);
      rebalance(tasks);
      setTimeout(() => (moved.current = false), 60);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, geo, dispatch, rebalance, tasks]);

  // Also rebalance when a task leaves a bucket by being completed or deleted.
  useEffect(() => {
    rebalance(tasks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const begin = (mode: DragMode, task: Task, e: React.MouseEvent, grabOffset: number) => {
    e.preventDefault();
    e.stopPropagation();
    setPointer({ x: e.clientX, y: e.clientY });
    setDrag({
      id: task.id,
      mode,
      grabOffset,
      startY: e.clientY,
      startMin: task.startMin,
      startEst: task.estMin,
      moved: false,
    });
  };

  const scheduled = scheduledTasks(tasks);
  const ghostTask = drag?.moved ? tasks.find((t) => t.id === drag.id) : undefined;

  return (
    <div className="myday">
      <aside className="buckets">
        {BUCKETS.map((b) => {
          const list = bucketTasks(tasks, b.key);
          const open = prefs.buckets[b.key];
          return (
            <section className="bucket" key={b.key}>
              <button
                className="bucket-head"
                onClick={() => dispatch({ type: "prefs/bucket", key: b.key, open: !open })}
              >
                <i className={open ? "ph ph-caret-down" : "ph ph-caret-right"} />
                <span className="grow">{b.title}</span>
                <span className="badge">{list.length}</span>
              </button>
              {open && (
                <div className="bucket-body">
                  {list.map((t) => (
                    <div
                      key={t.id}
                      className={`day-card${drag?.id === t.id && drag.moved ? " is-dragging" : ""}`}
                      style={{ borderLeftColor: listColor(lists, t.listId) }}
                      onMouseDown={(e) => e.button === 0 && begin("schedule", t, e, 18)}
                      onClick={() => !moved.current && openTask(t.id)}
                    >
                      <div className="row start">
                        <TaskCheckbox task={t} />
                        <span className="grow">{t.title}</span>
                        <i className="ph ph-dots-six-vertical grip" />
                      </div>
                      <div className="card-meta">
                        <span className="dot" style={{ background: listColor(lists, t.listId) }} />
                        <span>{listName(lists, t.listId)}</span>
                        <span className="spacer" />
                        <span>{formatHours(t.estMin)}</span>
                      </div>
                    </div>
                  ))}
                  {list.length === 0 && <p className="hint">Nothing here.</p>}
                </div>
              )}
            </section>
          );
        })}
      </aside>

      <div className="day-right">
        <header className="day-bar">
          <span className="muted small">Now {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
          <span className="spacer" />
          <button
            className="btn btn-icon"
            title="Zoom out"
            onClick={() => dispatch({ type: "prefs/set", fields: { zoom: Math.max(34, prefs.zoom - 20) } })}
          >
            <i className="ph ph-minus" />
          </button>
          <span className="zoom small muted">{Math.round((prefs.zoom / 68) * 100)}%</span>
          <button
            className="btn btn-icon"
            title="Zoom in"
            onClick={() => dispatch({ type: "prefs/set", fields: { zoom: Math.min(180, prefs.zoom + 20) } })}
          >
            <i className="ph ph-plus" />
          </button>
          <button className="btn btn-ghost small" onClick={scrollToNow}>
            <i className="ph ph-crosshair-simple" />
            Now
          </button>
        </header>

        <Timeline
          scrollRef={scrollRef}
          geo={geo}
          nowMin={nowMin}
          tasks={scheduled}
          lists={lists}
          draggingId={drag?.moved ? drag.id : null}
          onBlockGrab={(t, e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            begin("move", t, e, e.clientY - rect.top);
          }}
          onResize={(t, edge, e) => begin(edge === "top" ? "resize-top" : "resize-bottom", t, e, 0)}
        />
      </div>

      {ghostTask && (
        <div
          className="ghost"
          style={{
            left: pointer.x + 12,
            top: pointer.y - 14,
            borderLeftColor: listColor(lists, ghostTask.listId),
          }}
        >
          <div>{ghostTask.title}</div>
          <div className="muted small">
            {ghostTask.startMin === null
              ? "Release to unschedule"
              : formatRange(ghostTask.startMin, ghostTask.estMin)}
          </div>
        </div>
      )}
    </div>
  );
}
