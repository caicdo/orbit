import { useEffect, useRef, useState } from "react";
import ConfirmModal from "../components/ConfirmModal";
import DocEditor from "../components/DocEditor";
import DueBadge from "../components/DueBadge";
import TaskCheckbox from "../components/TaskCheckbox";
import { useListEditor } from "../components/ListModalHost";
import { useTaskEditor } from "../components/TaskModalHost";
import { useNav } from "../lib/navContext";
import { newDoc } from "../lib/reducer";
import { docsForList, listStats, tasksForList } from "../lib/selectors";
import { useStore } from "../lib/store";

/** The "project page" for a single list — not in the sidebar, reached only
 *  by clicking a list card. A task panel and a stats summary side by side,
 *  and below both, a small Docs-lite: a document per idea, each a plain
 *  contentEditable surface with a handful of formatting commands. */
export default function ListDetailPage({ listId }: { listId: string }) {
  const { data, dispatch } = useStore();
  const { openTask, createTask } = useTaskEditor();
  const { editList } = useListEditor();
  const goTo = useNav();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const list = data.lists.find((l) => l.id === listId);
  const docs = list ? docsForList(data.documents, list.id) : [];

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  // Keep a valid selection: default to the most recently edited document,
  // and re-pick automatically if the active one is deleted or the list
  // changes. Content edits re-sort `docs` (they bump updatedAt) without
  // changing its length, so this deliberately doesn't depend on the array
  // itself — only switches, additions and removals should move the selection.
  useEffect(() => {
    if (!list) return;
    if (activeDocId && docs.some((d) => d.id === activeDocId)) return;
    setActiveDocId(docs[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list?.id, docs.length]);

  if (!list) {
    return (
      <div className="scroll pad">
        <button className="btn btn-ghost" onClick={() => goTo("lists")}>
          <i className="ph ph-arrow-left" />
          Back to lists
        </button>
        <div className="empty">
          <h4>List not found</h4>
          <p className="muted small">It may have been deleted.</p>
        </div>
      </div>
    );
  }

  const stats = listStats(data.tasks, list.id);
  const tasks = tasksForList(data.tasks, list.id);
  const activeDoc = docs.find((d) => d.id === activeDocId) ?? null;

  const addDoc = () => {
    const doc = newDoc({ listId: list.id });
    dispatch({ type: "doc/add", doc });
    setActiveDocId(doc.id);
  };

  const removeDoc = (id: string) => dispatch({ type: "doc/remove", id });

  return (
    <div className="scroll pad list-detail">
      <header className="list-detail-head">
        <button className="btn btn-icon" title="Back to lists" onClick={() => goTo("lists")}>
          <i className="ph ph-arrow-left" />
        </button>
        <span className="dot lg" style={{ background: list.color }} />
        <h3 className="grow">{list.name}</h3>
        <div className="card-menu-wrap" ref={menuRef}>
          <button
            className={`btn btn-icon${menuOpen ? " is-on" : ""}`}
            title="List settings"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <i className="ph ph-dots-three-vertical" />
          </button>
          {menuOpen && (
            <div className="card-menu">
              <button
                className="card-menu-opt"
                onClick={() => {
                  setMenuOpen(false);
                  editList(list.id);
                }}
              >
                <i className="ph ph-pencil-simple" />
                Rename
              </button>
              <button
                className="card-menu-opt is-danger"
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmDelete(true);
                }}
              >
                <i className="ph ph-trash" />
                Delete
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="list-detail-grid">
        <section className="list-detail-tasks">
          <div className="panel-head">
            <h4>Tasks</h4>
            <button className="btn btn-ghost small" onClick={() => createTask({ listId: list.id })}>
              <i className="ph ph-plus" />
              New task
            </button>
          </div>
          <div className="list-detail-task-rows">
            {tasks.map((t) => (
              <div key={t.id} className="flat-row raised" onClick={() => openTask(t.id)}>
                <TaskCheckbox task={t} />
                <span className={`grow${t.status === "done" ? " is-struck" : ""}`}>{t.title}</span>
                <span className="small">
                  <DueBadge due={t.due} />
                </span>
              </div>
            ))}
            {tasks.length === 0 && <p className="hint">No tasks in this list yet.</p>}
          </div>
        </section>

        <section className="list-detail-stats">
          <h4>Overview</h4>
          <div className="panel-stats stats-2col">
            <div className="stat-tile static">
              <div className="kicker">Total</div>
              <div className="stat-value">{stats.total}</div>
            </div>
            <div className="stat-tile static">
              <div className="kicker">Open</div>
              <div className="stat-value">{stats.open}</div>
            </div>
            <div className="stat-tile static">
              <div className="kicker">Done</div>
              <div className="stat-value">{stats.done}</div>
            </div>
            <div className="stat-tile static">
              <div className="kicker">Completion</div>
              <div className="stat-value">{stats.pct}%</div>
            </div>
          </div>
          <div className="track">
            <div className="fill" style={{ width: `${stats.pct}%`, background: list.color }} />
          </div>
          {stats.important > 0 && (
            <p className="muted small mt-sm">
              <i className="ph-fill ph-star" style={{ color: list.color }} /> {stats.important} important still
              open
            </p>
          )}
        </section>
      </div>

      <section className="list-detail-docs">
        <div className="panel-head">
          <h4>Documents</h4>
        </div>

        {docs.length === 0 ? (
          <div className="empty">
            <h4>No documents yet</h4>
            <p className="muted small">Create a new document for this list to start writing.</p>
            <button className="btn btn-primary" onClick={addDoc}>
              <i className="ph ph-plus" />
              New document
            </button>
          </div>
        ) : (
          <div className="docs-layout">
            <aside className="docs-list">
              <button className="btn btn-ghost add" onClick={addDoc}>
                <i className="ph ph-plus" />
                New document
              </button>
              {docs.map((d) => (
                <div
                  key={d.id}
                  className={`doc-row${activeDocId === d.id ? " is-active" : ""}`}
                  onClick={() => setActiveDocId(d.id)}
                >
                  <div className="grow">
                    <div className="doc-row-title">{d.title || "Untitled document"}</div>
                    <div className="muted small">
                      {new Date(d.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                  </div>
                  <button
                    className="btn btn-icon doc-row-delete"
                    title="Delete document"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeDoc(d.id);
                    }}
                  >
                    <i className="ph ph-trash" />
                  </button>
                </div>
              ))}
            </aside>
            <div className="doc-pane">
              {activeDoc && (
                <DocEditor
                  key={activeDoc.id}
                  doc={activeDoc}
                  onUpdate={(fields) => dispatch({ type: "doc/update", id: activeDoc.id, fields })}
                />
              )}
            </div>
          </div>
        )}
      </section>

      {confirmDelete && (
        <ConfirmModal
          title="Delete this list?"
          body="This can't be undone — every document in it goes too. Tasks stay, but they lose their list."
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            dispatch({ type: "list/remove", id: list.id });
            goTo("lists");
          }}
        />
      )}
    </div>
  );
}
