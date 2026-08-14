import type { RefObject } from "react";
import TaskCheckbox from "./TaskCheckbox";
import { formatRange, formatTime, type Geometry } from "../lib/time";
import { laneLayout, listColor } from "../lib/selectors";
import type { List, Task } from "../lib/types";

export interface TimelineProps {
  scrollRef: RefObject<HTMLDivElement>;
  geo: Geometry;
  nowMin: number;
  tasks: Task[];
  lists: List[];
  draggingId: string | null;
  onBlockGrab(task: Task, e: React.MouseEvent): void;
  onResize(task: Task, edge: "top" | "bottom", e: React.MouseEvent): void;
}

/** Presentational: vertical day timeline. All drag state lives in MyDayPage. */
export default function Timeline({
  scrollRef,
  geo,
  nowMin,
  tasks,
  lists,
  draggingId,
  onBlockGrab,
  onResize,
}: TimelineProps) {
  const nowTop = geo.topFor(nowMin);
  const firstHour = Math.ceil(geo.windowStart / 60);
  const hours: { top: number; label: string; major: boolean }[] = [];
  for (let h = firstHour; h <= firstHour + 24; h++) {
    const top = geo.topFor(h * 60);
    if (top < -1 || top > geo.height) continue;
    if (Math.abs(top - nowTop) < 16) continue; // don't collide with the now line
    const hh = ((h % 24) + 24) % 24;
    hours.push({ top, label: formatTime(hh * 60), major: hh % 6 === 0 });
  }

  const lanes = laneLayout(tasks);

  return (
    <div className="timeline" ref={scrollRef}>
      <div className="timeline-inner" style={{ height: geo.height }}>
        {hours.map((h) => (
          <div key={h.top} className={`hour${h.major ? " is-major" : ""}`} style={{ top: h.top }}>
            <span>{h.label}</span>
          </div>
        ))}

        {tasks.map((t) => {
          const { lane, lanes: n } = lanes.get(t.id) ?? { lane: 0, lanes: 1 };
          const col = `((100% - 70px) / ${n})`;
          return (
            <div
              key={t.id}
              className={`tl-block${draggingId === t.id ? " is-dragging" : ""}`}
              style={{
                top: geo.topFor(t.startMin!),
                height: Math.max(22, t.estMin * geo.pxPerMin - 3),
                left: `calc(56px + ${lane} * ${col})`,
                width: `calc(${col} - 4px)`,
                zIndex: 3 + lane,
                borderLeftColor: listColor(lists, t.listId),
              }}
              onMouseDown={(e) => onBlockGrab(t, e)}
            >
              <div className="tl-handle top" onMouseDown={(e) => onResize(t, "top", e)} />
              <div className="row start tl-row">
                <TaskCheckbox task={t} confirmOnComplete />
                <div className="tl-body">
                  <div className="tl-title">{t.title}</div>
                  <div className="tl-time">{formatRange(t.startMin!, t.estMin)}</div>
                </div>
              </div>
              <div className="tl-handle bottom" onMouseDown={(e) => onResize(t, "bottom", e)} />
            </div>
          );
        })}

        <div className="now-line" style={{ top: nowTop }}>
          <span className="now-dot" />
          <span className="now-label">{formatTime(nowMin)}</span>
        </div>
      </div>
    </div>
  );
}
