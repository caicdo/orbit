import { useRef, useState } from "react";
import { useAuth } from "../lib/auth/AuthContext";
import { useStore } from "../lib/store";
import { PAGES, pageById } from "../pages/registry";
import type { NavPref } from "../lib/types";

interface Props {
  page: string;
  onNavigate(id: string): void;
}

/** Pinned row + folders of channels, Discord-style: drag a channel onto another
 *  row to reorder, onto a folder to move it in, or onto the pinned zone to pin
 *  it. Every unpinned channel always belongs to exactly one folder. */
export default function Sidebar({ page, onNavigate }: Props) {
  const { data, dispatch } = useStore();
  const { account, signOut } = useAuth();
  const [customizing, setCustomizing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const moved = useRef(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  /** Arms on mousedown but does nothing else — no state, no listeners committed —
   *  until the pointer actually moves past a small threshold. A plain click on the
   *  row (the overwhelmingly common case) is then indistinguishable from clicking any
   *  other button: nothing intercepts it, so it can't race with mouseup/click on
   *  WebKit the way starting a drag on every mousedown could. Only once movement
   *  proves it's a real drag do we start tracking reorder state. */
  const beginPossibleDrag = (id: string) => (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let armed = false;

    const onMove = (ev: MouseEvent) => {
      if (!armed) {
        if (Math.abs(ev.clientX - startX) < 4 && Math.abs(ev.clientY - startY) < 4) return;
        armed = true;
        moved.current = true;
        setDragId(id);
      }

      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const row = el?.closest("[data-nav-id]") as HTMLElement | null;
      const overId = row?.dataset.navId;
      const nav = dataRef.current.nav.slice();
      const from = nav.findIndex((n) => n.id === id);
      if (from < 0) return;

      if (overId && overId !== id) {
        const pinned = row!.dataset.navPinned === "1";
        const folderId = pinned ? null : row!.dataset.navFolder || null;
        const item: NavPref = { ...nav[from], pinned, folderId };
        nav.splice(from, 1);
        const to = nav.findIndex((n) => n.id === overId);
        nav.splice(to < 0 ? nav.length : to, 0, item);
        dispatch({ type: "nav/set", nav });
        return;
      }

      // No specific row under the pointer — still let dropping into an empty
      // folder or the empty pinned zone work, landing at the end of that group.
      const pinnedZone = el?.closest("[data-pinned-zone]");
      const folderZone = el?.closest("[data-folder-id]") as HTMLElement | null;
      if (pinnedZone && !(nav[from].pinned && nav[from].folderId === null)) {
        const item: NavPref = { ...nav[from], pinned: true, folderId: null };
        nav.splice(from, 1);
        nav.push(item);
        dispatch({ type: "nav/set", nav });
      } else if (folderZone) {
        const fid = folderZone.dataset.folderId!;
        if (nav[from].pinned || nav[from].folderId !== fid) {
          const item: NavPref = { ...nav[from], pinned: false, folderId: fid };
          nav.splice(from, 1);
          nav.push(item);
          dispatch({ type: "nav/set", nav });
        }
      }
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (armed) setDragId(null);
      setTimeout(() => (moved.current = false), 60);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const openCount = data.tasks.filter((t) => t.status !== "done").length;
  const badges: Record<string, string> = {
    tasks: openCount ? String(openCount) : "",
    myday: (() => {
      const c = data.tasks.filter((t) => t.due === 0 && t.status !== "done").length;
      return c ? String(c) : "";
    })(),
    lists: data.lists.length ? String(data.lists.length) : "",
  };

  const setPref = (id: string, fields: Partial<NavPref>) =>
    dispatch({ type: "nav/set", nav: data.nav.map((n) => (n.id === id ? { ...n, ...fields } : n)) });

  const visible = (n: NavPref) => (customizing || !n.hidden) && pageById(n.id);
  const pinned = data.nav.filter((n) => n.pinned && visible(n)).map((n) => ({ pref: n, def: pageById(n.id)! }));
  const inFolder = (folderId: string) =>
    data.nav
      .filter((n) => !n.pinned && n.folderId === folderId && visible(n))
      .map((n) => ({ pref: n, def: pageById(n.id)! }));

  const NavRow = ({ pref, def }: { pref: NavPref; def: (typeof PAGES)[number] }) => (
    <div
      className={`nav-row${dragId === pref.id ? " is-dragging" : ""}`}
      data-nav-id={pref.id}
      data-nav-pinned={pref.pinned ? "1" : "0"}
      data-nav-folder={pref.folderId ?? ""}
      onMouseDown={beginPossibleDrag(pref.id)}
    >
      <button
        className={`nav-btn${page === pref.id ? " is-active" : ""}`}
        onClick={() => !moved.current && onNavigate(pref.id)}
      >
        <i className={def.icon} />
        <span>{def.label}</span>
        <span className="badge">{badges[pref.id] ?? ""}</span>
      </button>
      {customizing && (
        <>
          <button
            className={`btn btn-icon${pref.pinned ? " is-on" : ""}`}
            title={pref.pinned ? "Unpin" : "Pin"}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() =>
              setPref(pref.id, {
                pinned: !pref.pinned,
                folderId: pref.pinned ? data.navFolders[0]?.id ?? null : null,
              })
            }
          >
            <i className={pref.pinned ? "ph-fill ph-push-pin" : "ph ph-push-pin"} />
          </button>
          {!pref.pinned && (
            <button
              className="btn btn-icon"
              title={pref.hidden ? "Show" : "Hide"}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setPref(pref.id, { hidden: !pref.hidden })}
            >
              <i className={pref.hidden ? "ph ph-eye-slash" : "ph ph-eye"} />
            </button>
          )}
        </>
      )}
    </div>
  );

  return (
    <nav className="sidebar">
      <header className="sidebar-head">
        <span className="avatar">{account?.name.slice(0, 2).toUpperCase()}</span>
        <span className="sidebar-name">{account?.name}</span>
        <button
          className={`btn btn-icon${customizing ? " is-on" : ""}`}
          title="Customize menu"
          onClick={() => setCustomizing((v) => !v)}
        >
          <i className="ph ph-sliders-horizontal" />
        </button>
      </header>

      <div className="kicker">Pinned</div>
      <div className="pinned-zone" data-pinned-zone="1">
        {pinned.map((r) => (
          <NavRow key={r.pref.id} {...r} />
        ))}
        {pinned.length === 0 && <p className="hint">Drag a channel here to pin it.</p>}
      </div>

      <div className="kicker row">
        <span>Folders</span>
        <button className="btn btn-icon" title="New folder" onClick={() => dispatch({ type: "folder/add" })}>
          <i className="ph ph-plus" />
        </button>
      </div>
      {data.navFolders.map((folder) => {
        const rows = inFolder(folder.id);
        return (
          <div className="folder" key={folder.id} data-folder-id={folder.id}>
            <div className="folder-head">
              <button
                className="btn btn-icon folder-caret"
                title={folder.collapsed ? "Expand" : "Collapse"}
                onClick={() => dispatch({ type: "folder/toggle", id: folder.id, collapsed: !folder.collapsed })}
              >
                <i className={folder.collapsed ? "ph ph-caret-right" : "ph ph-caret-down"} />
              </button>
              <input
                className="input bare folder-name"
                value={folder.name}
                onChange={(e) => dispatch({ type: "folder/rename", id: folder.id, name: e.target.value })}
              />
              <span className="badge">{rows.length || ""}</span>
              {data.navFolders.length > 1 && (
                <button
                  className="btn btn-icon"
                  title="Delete folder"
                  onClick={() => dispatch({ type: "folder/remove", id: folder.id })}
                >
                  <i className="ph ph-trash" />
                </button>
              )}
            </div>
            {!folder.collapsed && (
              <div className="folder-body">
                {rows.map((r) => (
                  <NavRow key={r.pref.id} {...r} />
                ))}
                {rows.length === 0 && <p className="hint folder-empty">Drag a channel here.</p>}
              </div>
            )}
          </div>
        );
      })}
      {customizing && <p className="hint">Drag a channel to reorder it, pin it, or move it into a folder.</p>}

      <div className="spacer" />

      <div className="kicker row">
        <span>Lists</span>
        <button className="btn btn-icon" title="New list" onClick={() => dispatch({ type: "list/add" })}>
          <i className="ph ph-plus" />
        </button>
      </div>
      {data.lists.map((l) => (
        <button
          key={l.id}
          className={`list-btn${data.prefs.filterListId === l.id ? " is-active" : ""}`}
          onClick={() =>
            dispatch({
              type: "prefs/set",
              fields: { filterListId: data.prefs.filterListId === l.id ? null : l.id },
            })
          }
        >
          <span className="dot" style={{ background: l.color }} />
          <span className="list-name">{l.name}</span>
          <span className="badge">
            {data.tasks.filter((t) => t.listId === l.id && t.status !== "done").length || ""}
          </span>
        </button>
      ))}
      {data.lists.length === 0 && <p className="hint">No lists yet.</p>}

      <button className="btn btn-ghost sign-out" onClick={() => void signOut()}>
        <i className="ph ph-sign-out" />
        Sign out
      </button>
    </nav>
  );
}
