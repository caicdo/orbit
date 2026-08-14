import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Dispatch, ReactNode } from "react";
import { useAuth } from "./auth/AuthContext";
import { dataAdapter } from "./persistence";
import { reducer, type Action } from "./reducer";
import { PAGES } from "../pages/registry";
import { DEFAULT_FOLDER_ID, emptyData, type AppData, type NavFolder, type NavPref } from "./types";

interface StoreValue {
  data: AppData;
  dispatch: Dispatch<Action>;
  loaded: boolean;
  backend: string;
}

const StoreContext = createContext<StoreValue | null>(null);

/** Nav prefs are seeded from the page registry, so a newly added page shows up
 *  automatically for existing accounts too. Every unpinned channel must belong
 *  to a folder, so this also backfills folderId for prefs saved before folders
 *  existed and guarantees at least the default folder is present. */
function withRegistryPages(nav: NavPref[], folders: NavFolder[]): { nav: NavPref[]; navFolders: NavFolder[] } {
  const navFolders = folders.length
    ? folders
    : [{ id: DEFAULT_FOLDER_ID, name: "Channels", collapsed: false }];
  const fallbackFolder = navFolders[0].id;
  const knownFolders = new Set(navFolders.map((f) => f.id));

  const known = new Set(nav.map((n) => n.id));
  const additions: NavPref[] = PAGES.filter((p) => !known.has(p.id)).map((p) => ({
    id: p.id,
    pinned: p.defaultPinned,
    hidden: false,
    folderId: p.defaultPinned ? null : fallbackFolder,
  }));
  const valid = nav
    .filter((n) => PAGES.some((p) => p.id === n.id))
    .map((n) => ({
      ...n,
      folderId: n.pinned ? null : n.folderId && knownFolders.has(n.folderId) ? n.folderId : fallbackFolder,
    }));
  return { nav: [...valid, ...additions], navFolders };
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
      const { nav, navFolders } = withRegistryPages(base.nav, base.navFolders ?? []);
      dispatch({ type: "hydrate", data: { ...base, nav, navFolders } });
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
