/** Every domain type lives here. Add fields in one place and TypeScript will
 *  point at every screen that needs updating. */

export type Status = "todo" | "doing" | "done";

/** A specific calendar date, stored as the epoch ms of that day's local
 *  midnight (see lib/time.ts). null = no due date. */
export type Due = number | null;

export type Remind = "none" | "15m" | "1h" | "morning";
export type Repeat = "none" | "daily" | "weekdays" | "weekly";

export interface Step {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  /** null = not in any list */
  listId: string | null;
  status: Status;
  due: Due;
  important: boolean;
  /** planned length in minutes */
  estMin: number;
  /** minutes from midnight today; null = unscheduled. May exceed 1440 (tomorrow). */
  startMin: number | null;
  steps: Step[];
  notes: string;
  remind: Remind;
  repeat: Repeat;
  myDay: boolean;
  completedAt: number | null;
  createdAt: number;
}

export interface List {
  id: string;
  name: string;
  color: string;
}

export interface NavPref {
  /** matches a PageDef id in src/pages/registry.tsx */
  id: string;
  pinned: boolean;
  hidden: boolean;
}

export type TaskView = "board" | "list" | "cards";
export type BucketKey = "today" | "tomorrow" | "week";

export interface Prefs {
  view: TaskView;
  filterListId: string | null;
  showDone: boolean;
  buckets: Record<BucketKey, boolean>;
  /** timeline pixels per hour */
  zoom: number;
  /** collapsed state of the sidebar's "Lists" section */
  listsCollapsed: boolean;
}

export interface AppData {
  tasks: Task[];
  lists: List[];
  nav: NavPref[];
  prefs: Prefs;
}

export interface Account {
  id: string;
  name: string;
  email: string;
}

export const LIST_COLORS = [
  "#b5abfc",
  "#968ae0",
  "#7972a9",
  "#9397ab",
  "#d2cefd",
  "#5d5294",
];

/** Preset swatches offered in the list color popover — a wider spread than the
 *  round-robin default palette above, so picking one feels intentional. */
export const LIST_COLOR_PRESETS = [
  "#b5abfc",
  "#968ae0",
  "#7972a9",
  "#9397ab",
  "#d2cefd",
  "#5d5294",
  "#f6b6c6",
  "#f2a2a2",
  "#f3b787",
  "#f0d878",
  "#a9dba0",
  "#7fc9c4",
  "#7cb4e0",
  "#8fa3e8",
  "#c98fe0",
  "#e08fc0",
];

export const emptyData = (): AppData => ({
  tasks: [],
  lists: [],
  nav: [],
  prefs: {
    view: "board",
    filterListId: null,
    showDone: false,
    buckets: { today: true, tomorrow: false, week: false },
    zoom: 68,
    listsCollapsed: false,
  },
});
