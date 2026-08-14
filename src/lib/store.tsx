import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Dispatch, ReactNode } from "react";
import { useAuth } from "./auth/AuthContext";
import { dataAdapter } from "./persistence";
import { reducer, type Action } from "./reducer";
import { addDays, today } from "./time";
import { PAGES } from "../pages/registry";
import { emptyData, type AppData, type NavPref, type Task } from "./types";

/** Pre-0.2 builds stored `due` as a small bucket enum (0/1/3/99). Real due
 *  dates are epoch ms of a day's midnight — enormous by comparison — so any
 *  small number left over from that format is unambiguous. */
function migrateDue(due: unknown): number | null {
  if (typeof due !== "number") return due === null ? null : today();
  if (due > 100_000) return due; // already a real timestamp
  if (due === 0) return today();
  if (due === 1) return addDays(today(), 1);
  if (due === 3) return addDays(today(), 3);
  return null; // legacy "no date" (99) or anything unrecognized
}

const migrateTasks = (tasks: Task[]): Task[] =>
  tasks.map((t) => ({ ...t, due: migrateDue((t as unknown as { due: unknown }).due) }));

interface StoreValue {
  data: AppData;
  dispatch: Dispatch<Action>;
  loaded: boolean;
  backend: string;
}

const StoreContext = createContext<StoreValue | null>(null);

/** Nav prefs are seeded from the page registry, so a newly added page shows up
 *  automatically for existing accounts too. */
function withRegistryPages(nav: NavPref[]): NavPref[] {
  const known = new Set(nav.map((n) => n.id));
  const additions: NavPref[] = PAGES.filter((p) => !known.has(p.id)).map((p) => ({
    id: p.id,
    pinned: p.defaultPinned,
    hidden: false,
  }));
  const valid = nav.filter((n) => PAGES.some((p) => p.id === n.id));
  return [...valid, ...additions];
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const [data, dispatch] = useReducer(reducer, emptyData());
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);

  // Load once per account.
  useEffect(() => {
    if (!account) {
      setLoaded(false);
      return;
    }
    let alive = true;
    setLoaded(false);
    dataAdapter.load(account.id).then((stored) => {
      if (!alive) return;
      const base = stored ?? emptyData();
      const nav = withRegistryPages(base.nav);
      const tasks = migrateTasks(base.tasks);
      const prefs = { ...emptyData().prefs, ...base.prefs };
      dispatch({ type: "hydrate", data: { ...base, tasks, nav, prefs } });
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [account]);

  // Save on change, debounced.
  useEffect(() => {
    if (!account || !loaded) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void dataAdapter.save(account.id, data);
    }, 250);
    return () => window.clearTimeout(saveTimer.current);
  }, [account, data, loaded]);

  const value = useMemo(
    () => ({ data, dispatch, loaded, backend: dataAdapter.name }),
    [data, dispatch, loaded],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
