import { uid } from "./id";
import {
  DEFAULT_FOLDER_ID,
  DUE,
  LIST_COLORS,
  emptyData,
  type AppData,
  type BucketKey,
  type List,
  type NavFolder,
  type Prefs,
  type Task,
} from "./types";

/** Every way the data can change. Add a case here and the reducer below —
 *  no component ever mutates state directly. */
export type Action =
  | { type: "hydrate"; data: AppData }
  | { type: "task/add"; task?: Partial<Task> }
  | { type: "task/update"; id: string; fields: Partial<Task> }
  | { type: "task/replace"; task: Task }
  | { type: "task/remove"; id: string }
  | { type: "task/move"; id: string; beforeId: string; adoptStatus: boolean }
  | { type: "list/add"; name?: string }
  | { type: "list/update"; id: string; fields: Partial<List> }
  | { type: "list/remove"; id: string }
  | { type: "nav/set"; nav: AppData["nav"] }
  | { type: "folder/add"; name?: string }
  | { type: "folder/rename"; id: string; name: string }
  | { type: "folder/remove"; id: string }
  | { type: "folder/toggle"; id: string; collapsed: boolean }
  | { type: "prefs/set"; fields: Partial<Prefs> }
  | { type: "prefs/bucket"; key: BucketKey; open: boolean }
  | { type: "wipe"; what: "tasks" | "lists" | "all" };

export const newTask = (over: Partial<Task> = {}): Task => ({
  id: uid(),
  title: "",
  listId: null,
  status: "todo",
  due: DUE.today,
  important: false,
  estMin: 60,
  startMin: null,
  steps: [],
  notes: "",
  remind: "none",
  repeat: "none",
  myDay: true,
  completedAt: null,
  createdAt: Date.now(),
  ...over,
});

export function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case "hydrate":
      return action.data;

    case "task/add":
      return { ...state, tasks: [...state.tasks, newTask(action.task)] };

    case "task/update":
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, ...action.fields } : t)),
      };

    case "task/replace":
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.task.id ? action.task : t)),
      };

    case "task/remove":
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };

    case "task/move": {
      const from = state.tasks.findIndex((t) => t.id === action.id);
      const to = state.tasks.findIndex((t) => t.id === action.beforeId);
      if (from < 0 || to < 0 || from === to) return state;
      const tasks = state.tasks.slice();
      const moved = action.adoptStatus
        ? { ...tasks[from], status: tasks[to].status }
        : tasks[from];
      tasks.splice(from, 1);
      tasks.splice(to, 0, moved);
      return { ...state, tasks };
    }

    case "list/add": {
      const list: List = {
        id: uid(),
        name: action.name ?? `New list${state.lists.length ? ` ${state.lists.length + 1}` : ""}`,
        color: LIST_COLORS[state.lists.length % LIST_COLORS.length],
      };
      return { ...state, lists: [...state.lists, list] };
    }

    case "list/update":
      return {
        ...state,
        lists: state.lists.map((l) => (l.id === action.id ? { ...l, ...action.fields } : l)),
      };

    case "list/remove":
      return {
        ...state,
        lists: state.lists.filter((l) => l.id !== action.id),
        tasks: state.tasks.map((t) => (t.listId === action.id ? { ...t, listId: null } : t)),
        prefs: {
          ...state.prefs,
          filterListId: state.prefs.filterListId === action.id ? null : state.prefs.filterListId,
        },
      };

    case "nav/set":
      return { ...state, nav: action.nav };

    case "folder/add": {
      const folder: NavFolder = {
        id: uid(),
        name:
          action.name ??
          `New folder${state.navFolders.length ? ` ${state.navFolders.length + 1}` : ""}`,
        collapsed: false,
      };
      return { ...state, navFolders: [...state.navFolders, folder] };
    }

    case "folder/rename":
      return {
        ...state,
        navFolders: state.navFolders.map((f) => (f.id === action.id ? { ...f, name: action.name } : f)),
      };

    case "folder/toggle":
      return {
        ...state,
        navFolders: state.navFolders.map((f) =>
          f.id === action.id ? { ...f, collapsed: action.collapsed } : f,
        ),
      };

    case "folder/remove": {
      // Every unpinned channel needs a folder — refuse to remove the last one.
      if (state.navFolders.length <= 1) return state;
      const remaining = state.navFolders.filter((f) => f.id !== action.id);
      const fallback = remaining.find((f) => f.id === DEFAULT_FOLDER_ID)?.id ?? remaining[0].id;
      return {
        ...state,
        navFolders: remaining,
        nav: state.nav.map((n) => (n.folderId === action.id ? { ...n, folderId: fallback } : n)),
      };
    }

    case "prefs/set":
      return { ...state, prefs: { ...state.prefs, ...action.fields } };

    case "prefs/bucket":
      return {
        ...state,
        prefs: { ...state.prefs, buckets: { ...state.prefs.buckets, [action.key]: action.open } },
      };

    case "wipe": {
      const base = emptyData();
      if (action.what === "all") return { ...base, nav: state.nav, navFolders: state.navFolders };
      if (action.what === "tasks")
        return { ...state, tasks: [], prefs: { ...state.prefs, filterListId: null } };
      return {
        ...state,
        lists: [],
        tasks: state.tasks.map((t) => ({ ...t, listId: null })),
        prefs: { ...state.prefs, filterListId: null },
      };
    }

    default:
      return state;
  }
}
