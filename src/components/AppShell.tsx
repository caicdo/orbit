import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import { useListEditor } from "./ListModalHost";
import { useTaskEditor } from "./TaskModalHost";
import { useStore } from "../lib/store";
import { NavProvider } from "../lib/navContext";
import { DEFAULT_PAGE, pageById } from "../pages/registry";
import ListDetailPage from "../pages/ListDetailPage";
import { dayLabel } from "../lib/time";
import type { TaskView } from "../lib/types";

/** A list's detail page isn't a registry page (it's not in the sidebar,
 *  reached only from a list card), so it rides the same opaque nav-id string
 *  every page already jumps around with — just prefixed instead of looked up. */
const LIST_PREFIX = "list:";

const OUT_MS = 130;

const VIEWS: { key: TaskView; label: string; icon: string }[] = [
  { key: "board", label: "Board", icon: "ph ph-kanban" },
  { key: "list", label: "List", icon: "ph ph-list-bullets" },
  { key: "cards", label: "Cards", icon: "ph ph-squares-four" },
];

export default function AppShell() {
  const { data, dispatch, loaded } = useStore();
  const { createTask } = useTaskEditor();
  const { createList } = useListEditor();
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [phase, setPhase] = useState<"in" | "out">("in");
  const timer = useRef<number | undefined>(undefined);

  const navigate = useCallback(
    (id: string) => {
      if (id === page) return;
      window.clearTimeout(timer.current);
      setPhase("out");
      timer.current = window.setTimeout(() => {
        setPage(id);
        setPhase("in");
      }, OUT_MS);
    },
    [page],
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const isListDetail = page.startsWith(LIST_PREFIX);
  const def = !isListDetail ? pageById(page) ?? pageById(DEFAULT_PAGE)! : null;
  const Page = def?.component ?? (() => null);
  const filterName = data.lists.find((l) => l.id === data.prefs.filterListId)?.name;

  return (
    <div className="shell">
      <Sidebar page={page} onNavigate={navigate} />

      <main className="main">
        {!isListDetail && (
          <header className="toolbar">
            <h3>{def!.label}</h3>
            <span className="muted small">{filterName ? `filtered · ${filterName}` : dayLabel()}</span>
            <span className="spacer" />

            {page === "tasks" && (
              <div className="seg">
                {VIEWS.map((v) => (
                  <button
                    key={v.key}
                    className={`seg-opt${data.prefs.view === v.key ? " is-on" : ""}`}
                    onClick={() => dispatch({ type: "prefs/set", fields: { view: v.key } })}
                  >
                    <i className={v.icon} />
                    {v.label}
                  </button>
                ))}
              </div>
            )}

            {def!.primaryAction !== "none" && (
              <button
                className="btn btn-primary"
                onClick={() => (def!.primaryAction === "new-list" ? createList() : createTask())}
              >
                <i className="ph ph-plus" />
                {def!.primaryAction === "new-list" ? "New list" : "New task"}
              </button>
            )}
          </header>
        )}

        <div className="page-viewport">
          <div className={`page ${phase === "out" ? "is-leaving" : "is-entering"}`}>
            {loaded ? (
              <NavProvider value={navigate}>
                {isListDetail ? <ListDetailPage listId={page.slice(LIST_PREFIX.length)} /> : <Page />}
              </NavProvider>
            ) : (
              <div className="boot">Loading…</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
