import { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { LIST_COLOR_PRESETS } from "../lib/types";

export default function ListsPage() {
  const { data, dispatch } = useStore();
  const { lists, tasks } = data;
  const [openId, setOpenId] = useState<string | null>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Close the popover on an outside click.
  useEffect(() => {
    if (!openId) return;
    const onDown = (e: MouseEvent) => {
      if (!popRef.current?.contains(e.target as Node)) setOpenId(null);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [openId]);

  const setColor = (id: string, color: string) => dispatch({ type: "list/update", id, fields: { color } });

  if (lists.length === 0)
    return (
      <div className="scroll pad">
        <div className="empty">
          <h4>No lists yet</h4>
          <p className="muted small">Lists group your tasks — a course, a client, a side project.</p>
          <button className="btn btn-primary" onClick={() => dispatch({ type: "list/add" })}>
            <i className="ph ph-plus" />
            New list
          </button>
        </div>
      </div>
    );

  return (
    <div className="scroll pad">
      <div className="card-grid wide">
        {lists.map((l) => {
          const all = tasks.filter((t) => t.listId === l.id);
          const done = all.filter((t) => t.status === "done").length;
          const pct = all.length ? Math.round((done / all.length) * 100) : 0;
          return (
            <div className="list-card" key={l.id}>
              <div className="row start gap">
                <div className="swatch-wrap">
                  <button
                    className="swatch"
                    title="Change color"
                    style={{ background: l.color }}
                    onClick={() => setOpenId(openId === l.id ? null : l.id)}
                  />
                  {openId === l.id && (
                    <div className="color-pop" ref={popRef}>
                      <div className="color-grid">
                        {LIST_COLOR_PRESETS.map((c) => (
                          <button
                            key={c}
                            className={`color-swatch${c === l.color ? " is-active" : ""}`}
                            style={{ background: c }}
                            title={c}
                            onClick={() => {
                              setColor(l.id, c);
                              setOpenId(null);
                            }}
                          />
                        ))}
                      </div>
                      <label className="btn btn-secondary custom-color-btn">
                        <i className="ph ph-eyedropper" />
                        Custom color
                        <input
                          type="color"
                          className="color-input"
                          value={l.color}
                          onChange={(e) => setColor(l.id, e.target.value)}
                        />
                      </label>
                    </div>
                  )}
                </div>
                <input
                  className="input bare grow"
                  value={l.name}
                  onChange={(e) => dispatch({ type: "list/update", id: l.id, fields: { name: e.target.value } })}
                />
                <button
                  className="btn btn-icon"
                  title="Delete list"
                  onClick={() => dispatch({ type: "list/remove", id: l.id })}
                >
                  <i className="ph ph-trash" />
                </button>
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
    </div>
  );
}
