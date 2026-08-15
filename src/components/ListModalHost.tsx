import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "../lib/store";
import { LIST_COLORS, LIST_COLOR_PRESETS } from "../lib/types";

/** Creating or renaming a list both go through the same small card: a name
 *  (required) and an optional color. Nothing is written to the store until
 *  Save — unlike tasks, a list has no useful "blank" state worth creating
 *  eagerly, so there's no orphan to clean up if the user cancels. */
interface ListEditorValue {
  createList(): void;
  editList(id: string): void;
}

const Ctx = createContext<ListEditorValue | null>(null);

type EditState = { mode: "create" | "edit"; id: string | null; name: string; color: string };

export function ListModalHost({ children }: { children: ReactNode }) {
  const { data, dispatch } = useStore();
  const [state, setState] = useState<EditState | null>(null);

  const createList = useCallback(() => {
    setState({ mode: "create", id: null, name: "", color: LIST_COLORS[data.lists.length % LIST_COLORS.length] });
  }, [data.lists.length]);

  const editList = useCallback(
    (id: string) => {
      const list = data.lists.find((l) => l.id === id);
      if (!list) return;
      setState({ mode: "edit", id, name: list.name, color: list.color });
    },
    [data.lists],
  );

  const close = () => setState(null);

  const save = () => {
    if (!state || !state.name.trim()) return;
    if (state.mode === "create") {
      dispatch({ type: "list/add", name: state.name.trim(), color: state.color });
    } else {
      dispatch({ type: "list/update", id: state.id!, fields: { name: state.name.trim(), color: state.color } });
    }
    close();
  };

  const valid = Boolean(state?.name.trim());

  return (
    <Ctx.Provider value={{ createList, editList }}>
      {children}
      {state && (
        <div className="modal-backdrop" onMouseDown={close}>
          <div className="modal narrow-modal" onMouseDown={(e) => e.stopPropagation()}>
            <header className="modal-head">
              <span className="kicker">{state.mode === "create" ? "New list" : "Rename list"}</span>
              <button className="btn btn-icon" title="Close" onClick={close}>
                <i className="ph ph-x" />
              </button>
            </header>

            <input
              className={`input modal-title${valid ? "" : " needs"}`}
              autoFocus
              value={state.name}
              placeholder="List name"
              onChange={(e) => setState({ ...state, name: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && valid && save()}
            />
            <div className={`modal-hint${valid ? "" : " needs"}`}>{valid ? "" : "A name is required."}</div>

            <div className="field mt">
              <span>Color</span>
              <div className="color-grid">
                {LIST_COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    className={`color-swatch${c === state.color ? " is-active" : ""}`}
                    style={{ background: c }}
                    title={c}
                    onClick={() => setState({ ...state, color: c })}
                  />
                ))}
              </div>
              <label className="btn btn-secondary custom-color-btn">
                <i className="ph ph-eyedropper" />
                Custom color
                <input
                  type="color"
                  className="color-input"
                  value={state.color}
                  onChange={(e) => setState({ ...state, color: e.target.value })}
                />
              </label>
            </div>

            <footer className="modal-foot">
              <span className="spacer" />
              <button className="btn btn-ghost" onClick={close}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={!valid} onClick={save}>
                {state.mode === "create" ? "Create list" : "Save"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useListEditor(): ListEditorValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useListEditor must be used inside <ListModalHost>");
  return ctx;
}
