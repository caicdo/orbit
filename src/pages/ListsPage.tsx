import { useEffect, useRef, useState } from "react";
import ConfirmModal from "../components/ConfirmModal";
import { useListEditor } from "../components/ListModalHost";
import { useNav } from "../lib/navContext";
import { useStore } from "../lib/store";

export default function ListsPage() {
  const { data, dispatch } = useStore();
  const { lists, tasks } = data;
  const { createList, editList } = useListEditor();
  const goTo = useNav();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuFor) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuFor(null);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuFor]);

  if (lists.length === 0)
    return (
      <div className="scroll pad">
        <div className="empty">
          <h4>No lists yet</h4>
          <p className="muted small">Lists group your tasks — a course, a client, a side project.</p>
          <button className="btn btn-primary" onClick={createList}>
            <i className="ph ph-plus" />
            New list
          </button>
        </div>
      </div>
    );

  const deleteTarget = deleteId ? lists.find((l) => l.id === deleteId) : undefined;

  return (
    <div className="scroll pad">
      <div className="card-grid wide">
        {lists.map((l) => {
          const all = tasks.filter((t) => t.listId === l.id);
          const done = all.filter((t) => t.status === "done").length;
          const pct = all.length ? Math.round((done / all.length) * 100) : 0;
          return (
            <div className="list-card is-clickable" key={l.id} onClick={() => goTo(`list:${l.id}`)}>
              <div className="row start gap">
                <span className="dot" style={{ background: l.color }} />
                <span className="grow list-card-name">{l.name}</span>
                <div className="card-menu-wrap" ref={menuFor === l.id ? menuRef : undefined}>
                  <button
                    className={`btn btn-icon card-menu-btn${menuFor === l.id ? " is-open" : ""}`}
                    title="List settings"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuFor(menuFor === l.id ? null : l.id);
                    }}
                  >
                    <i className="ph ph-dots-three-vertical" />
                  </button>
                  {menuFor === l.id && (
                    <div className="card-menu" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="card-menu-opt"
                        onClick={() => {
                          setMenuFor(null);
                          editList(l.id);
                        }}
                      >
                        <i className="ph ph-pencil-simple" />
                        Rename
                      </button>
                      <button
                        className="card-menu-opt is-danger"
                        onClick={() => {
                          setMenuFor(null);
                          setDeleteId(l.id);
                        }}
                      >
                        <i className="ph ph-trash" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="muted small mt-sm">
                {done}/{all.length} done
              </div>
              <div className="track">
                <div className="fill" style={{ width: `${pct}%`, background: l.color }} />
              </div>
            </div>
          );
        })}
      </div>

      {deleteTarget && (
        <ConfirmModal
          title="Delete this list?"
          body={`This can't be undone — every document in "${deleteTarget.name}" goes too. Tasks stay, but they lose their list.`}
          onCancel={() => setDeleteId(null)}
          onConfirm={() => {
            dispatch({ type: "list/remove", id: deleteTarget.id });
            setDeleteId(null);
          }}
        />
      )}
    </div>
  );
}
