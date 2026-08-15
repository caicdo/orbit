import { dueBucket } from "./time";
import type { AppData, BucketKey, Doc, List, Status, Task } from "./types";

export const listById = (lists: List[], id: string | null): List | undefined =>
  id ? lists.find((l) => l.id === id) : undefined;

export const listName = (lists: List[], id: string | null): string =>
  listById(lists, id)?.name ?? "No list";

export const listColor = (lists: List[], id: string | null): string =>
  listById(lists, id)?.color ?? "#75798c";

export interface ListStats {
  total: number;
  open: number;
  done: number;
  important: number;
  pct: number;
}

/** Task counts for a single list's detail page. */
export function listStats(tasks: Task[], listId: string): ListStats {
  const all = tasks.filter((t) => t.listId === listId);
  const done = all.filter((t) => t.status === "done").length;
  const important = all.filter((t) => t.important && t.status !== "done").length;
  return { total: all.length, open: all.length - done, done, important, pct: all.length ? Math.round((done / all.length) * 100) : 0 };
}

/** A list's tasks, open ones first (grouped, then newest created), done last. */
export function tasksForList(tasks: Task[], listId: string): Task[] {
  return tasks
    .filter((t) => t.listId === listId)
    .sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || b.createdAt - a.createdAt);
}

/** A list's documents, most recently edited first. */
export function docsForList(documents: Doc[], listId: string): Doc[] {
  return documents.filter((d) => d.listId === listId).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Tasks after the sidebar list filter. */
export const visibleTasks = (data: AppData): Task[] =>
  data.prefs.filterListId
    ? data.tasks.filter((t) => t.listId === data.prefs.filterListId)
    : data.tasks;

export const newestFirst = (tasks: Task[]): Task[] =>
  tasks.slice().sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

export const STATUS_COLUMNS: { key: Status; title: string; dot: string }[] = [
  { key: "todo", title: "To do", dot: "#75798c" },
  { key: "doing", title: "In progress", dot: "#968ae0" },
  { key: "done", title: "Done", dot: "#5d5294" },
];

/** Finished tasks collapse to the most recent one unless `showDone`. */
export function collapseDone(tasks: Task[], showDone: boolean) {
  const sorted = newestFirst(tasks);
  return {
    visible: showDone ? sorted : sorted.slice(0, 1),
    total: sorted.length,
    hidden: Math.max(0, sorted.length - 1),
  };
}

export const BUCKETS: { key: BucketKey; title: string; match: (t: Task) => boolean }[] = [
  { key: "today", title: "For today", match: (t) => dueBucket(t.due) === "today" },
  { key: "tomorrow", title: "For tomorrow", match: (t) => dueBucket(t.due) === "tomorrow" },
  { key: "week", title: "For this week", match: (t) => dueBucket(t.due) === "week" },
];

/** Unscheduled, unfinished tasks for a My-day bucket. */
export const bucketTasks = (tasks: Task[], key: BucketKey): Task[] => {
  const def = BUCKETS.find((b) => b.key === key)!;
  return tasks.filter((t) => t.startMin === null && t.status !== "done" && def.match(t));
};

export const scheduledTasks = (tasks: Task[]): Task[] =>
  tasks.filter((t) => t.startMin !== null);

const dateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export interface HeatmapDay {
  date: Date;
  count: number;
  /** 0 = no tasks completed, 4 = busiest tier. */
  level: 0 | 1 | 2 | 3 | 4;
  inFuture: boolean;
}

const levelFor = (count: number): HeatmapDay["level"] =>
  count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count <= 4 ? 3 : 4;

/** Completed-task counts per day, grouped into Sun–Sat weeks (columns) for a
 *  GitHub-style contribution grid. Ends on the current week; starts `weeks` back. */
export function completionHeatmap(tasks: Task[], weeks = 14): HeatmapDay[][] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (t.status === "done" && t.completedAt) {
      const key = dateKey(new Date(t.completedAt));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const start = new Date(today);
  start.setDate(start.getDate() - (weeks * 7 - 1) - start.getDay());
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - today.getDay()));

  const days: HeatmapDay[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const count = counts.get(dateKey(cursor)) ?? 0;
    days.push({ date: new Date(cursor), count, level: levelFor(count), inFuture: cursor > today });
  }

  const columns: HeatmapDay[][] = [];
  for (let i = 0; i < days.length; i += 7) columns.push(days.slice(i, i + 7));
  return columns;
}

/** Lays overlapping timeline blocks into side-by-side lanes. */
export function laneLayout(tasks: Task[]): Map<string, { lane: number; lanes: number }> {
  const out = new Map<string, { lane: number; lanes: number }>();
  const sorted = tasks
    .slice()
    .sort((a, b) => a.startMin! - b.startMin! || a.createdAt - b.createdAt);
  let group: Task[] = [];
  let groupEnd = -Infinity;

  const flush = () => {
    if (!group.length) return;
    const lanes = Math.max(...group.map((t) => out.get(t.id)!.lane)) + 1;
    group.forEach((t) => out.set(t.id, { lane: out.get(t.id)!.lane, lanes }));
    group = [];
    groupEnd = -Infinity;
  };

  for (const t of sorted) {
    if (group.length && t.startMin! >= groupEnd) flush();
    const taken = group
      .filter((x) => x.startMin! + x.estMin > t.startMin!)
      .map((x) => out.get(x.id)!.lane);
    let lane = 0;
    while (taken.includes(lane)) lane++;
    out.set(t.id, { lane, lanes: 1 });
    group.push(t);
    groupEnd = Math.max(groupEnd, t.startMin! + t.estMin);
  }
  flush();
  return out;
}
