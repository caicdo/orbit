import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth/AuthContext";
import { useStore } from "../lib/store";
import { dueBucket } from "../lib/time";
import { PAGES, pageById } from "../pages/registry";
import type { NavPref } from "../lib/types";

interface Props {
  page: string;
  onNavigate(id: string): void;
}

type DropTarget = { zone: "pinned" | "rest"; beforeId: string | null } | null;

/** Which zone and which row to drop before, purely from the pointer's height
 *  on screen — never its horizontal position. Sideways drift (the cursor
 *  straying right past the sidebar's edge, which happens constantly on a
 *  column this narrow) used to go through `elementFromPoint`, which returns
 *  nothing useful once the pointer leaves the sidebar and made the drag go
 *  dead. Comparing against each zone's and row's own rect instead means the
 *  drag keeps tracking no matter how far off to the side the pointer wanders,
 *  as long as it's at roughly the right height — the same leniency Discord,
 *  Trello, etc. give a drag. */
function resolveDropTarget(
  clientY: number,
  excludeId: string,
  pinnedEl: HTMLElement | null,
  restEl: HTMLElement | null,
): DropTarget {
  const zones = (
    [
      pinnedEl && { zone: "pinned" as const, el: pinnedEl },
      restEl && { zone: "rest" as const, el: restEl },
    ] as const
  ).filter((z): z is { zone: "pinned" | "rest"; el: HTMLElement } => Boolean(z));
  if (zones.length === 0) return null;

  // Two zones stacked vertically: whichever side of the midpoint between
  // them the pointer is on wins — above the first zone still counts as the
  // first, below the last still counts as the last.
  let target = zones[0];
  if (zones.length > 1) {
    const [a, b] = zones;
    const boundary = (a.el.getBoundingClientRect().bottom + b.el.getBoundingClientRect().top) / 2;
    target = clientY < boundary ? a : b;
  }

  const rows = Array.from(target.el.querySelectorAll<HTMLElement>("[data-nav-id]")).filter(
    (row) => row.dataset.navId !== excludeId,
  );
  for (const row of rows) {
    const r = row.getBoundingClientRect();
    if (clientY < r.top + r.height / 2) return { zone: target.zone, beforeId: row.dataset.navId! };
  }
  return { zone: target.zone, beforeId: null };
}

/** A pinned zone plus a plain flat list of the rest — drag a page onto
 *  another row to reorder it, or onto the pinned zone to pin it. The dragged
 *  row just dims in place — nothing reorders until you drop it on the
 *  insertion line that tracks the pointer. */
export default function Sidebar({ page, onNavigate }: Props) {
  const { data, dispatch } = useStore();
  const { account } = useAuth();
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<DropTarget>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const moved = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pinnedZoneRef = useRef<HTMLDivElement>(null);
  const restZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuFor) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuFor(null);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuFor]);

  /** Arms on mousedown but does nothing else — no state, no listeners committed —
   *  until the pointer actually moves past a small threshold. A plain click on the
   *  row (the overwhelmingly common case) is then indistinguishable from clicking any
   *  other button: nothing intercepts it, so it can't race with mouseup/click on
   *  WebKit the way starting a drag on every mousedown could. Only once movement
   *  proves it's a real drag do we track a drop target, and only mouseup commits it. */
  const beginPossibleDrag = (id: string) => (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let armed = false;
    let last: DropTarget = null;
    let raf = 0;

    const onMove = (ev: MouseEvent) => {
      if (!armed) {
        if (Math.abs(ev.clientX - startX) < 4 && Math.abs(ev.clientY - startY) < 4) return;
        armed = true;
        moved.current = true;
        setDragId(id);
      }

      // Coalesced to one lookup + render per frame, however fast the mouse
      // events arrive, so the line tracks the pointer without stutter.
      if (raf) return;
      const clientY = ev.clientY;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const next = resolveDropTarget(clientY, id, pinnedZoneRef.current, restZoneRef.current);
        last = next;
        setDrop(next);
      });
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (raf) cancelAnimationFrame(raf);
      if (armed && last) {
        dispatch({ type: "nav/move", id, pinned: last.zone === "pinned", beforeId: last.beforeId });
      }
      setDragId(null);
      setDrop(null);
      setTimeout(() => (moved.current = false), 60);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const openCount = data.tasks.filter((t) => t.status !== "done").length;
  const badges: Record<string, string> = {
    tasks: openCount ? String(openCount) : "",
    myday: (() => {
      const c = data.tasks.filter((t) => dueBucket(t.due) === "today" && t.status !== "done").length;
      return c ? String(c) : "";
    })(),
    lists: data.lists.length ? String(data.lists.length) : "",
  };

  const setPref = (id: string, fields: Partial<Pick<NavPref, "pinned" | "hidden">>) => {
    dispatch({ type: "nav/setPref", id, fields });
    setMenuFor(null);
  };

  // The Settings page gets its own fixed spot at the bottom of the sidebar
  // (see footer below) instead of living in the draggable page list.
  const visible = (n: NavPref) => n.id !== "settings" && !n.hidden && pageById(n.id);
  const pinned = data.nav.filter((n) => n.pinned && visible(n)).map((n) => ({ pref: n, def: pageById(n.id)! }));
  const rest = data.nav.filter((n) => !n.pinned && visible(n)).map((n) => ({ pref: n, def: pageById(n.id)! }));

  const NavRow = ({ pref, def }: { pref: NavPref; def: (typeof PAGES)[number] }) => (
    <div
      className={`nav-row${dragId === pref.id ? " is-dragging" : ""}`}
      data-nav-id={pref.id}
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
      <div className="nav-row-menu-wrap" ref={menuFor === pref.id ? menuRef : undefined}>
        <button
          className={`btn btn-icon nav-row-menu-btn${menuFor === pref.id ? " is-open" : ""}`}
          title="Page settings"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setMenuFor(menuFor === pref.id ? null : pref.id)}
        >
          <i className="ph ph-dots-three-vertical" />
        </button>
        {menuFor === pref.id && (
          <div className="nav-row-menu">
            <button className="nav-row-menu-opt" onClick={() => setPref(pref.id, { pinned: !pref.pinned })}>
              <i className={pref.pinned ? "ph-fill ph-push-pin" : "ph ph-push-pin"} />
              {pref.pinned ? "Unpin" : "Pin"}
            </button>
            {!pref.pinned && (
              <button className="nav-row-menu-opt" onClick={() => setPref(pref.id, { hidden: true })}>
                <i className="ph ph-eye-slash" />
                Hide
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <nav className="sidebar">
      <header className="sidebar-head">
        <span className="avatar">{account?.name.slice(0, 2).toUpperCase()}</span>
        <span className="sidebar-name">{account?.name}</span>
      </header>

      <div className="kicker">Pinned</div>
      <div className="pinned-zone" ref={pinnedZoneRef}>
        {pinned.map((r) => (
          <div key={r.pref.id}>
            {drop?.zone === "pinned" && drop.beforeId === r.pref.id && <div className="drop-line" />}
            <NavRow {...r} />
          </div>
        ))}
        {drop?.zone === "pinned" && drop.beforeId === null && dragId && <div className="drop-line" />}
        {pinned.length === 0 && <p className="hint">Drag a page here to pin it.</p>}
      </div>

      <div className="kicker">Pages</div>
      <div className="nav-list" ref={restZoneRef}>
        {rest.map((r) => (
          <div key={r.pref.id}>
            {drop?.zone === "rest" && drop.beforeId === r.pref.id && <div className="drop-line" />}
            <NavRow {...r} />
          </div>
        ))}
        {drop?.zone === "rest" && drop.beforeId === null && dragId && <div className="drop-line" />}
        {rest.length === 0 && <p className="hint">Nothing here.</p>}
      </div>

      <div className="spacer" />

      <div className="kicker row">
        <button
          className="btn btn-icon lists-caret"
          title={data.prefs.listsCollapsed ? "Expand" : "Collapse"}
          onClick={() =>
            dispatch({ type: "prefs/set", fields: { listsCollapsed: !data.prefs.listsCollapsed } })
          }
        >
          <i className={data.prefs.listsCollapsed ? "ph ph-caret-right" : "ph ph-caret-down"} />
        </button>
        <span>Lists</span>
        <button className="btn btn-icon" title="New list" onClick={() => dispatch({ type: "list/add" })}>
          <i className="ph ph-plus" />
        </button>
      </div>
      {!data.prefs.listsCollapsed && (
        <>
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
        </>
      )}

      <button
        className={`btn btn-ghost nav-footer-btn${page === "settings" ? " is-active" : ""}`}
        onClick={() => onNavigate("settings")}
      >
        <i className="ph ph-gear-six" />
        Settings
      </button>
    </nav>
  );
}
