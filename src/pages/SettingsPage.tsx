import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuth } from "../lib/auth/AuthContext";
import { useStore } from "../lib/store";
import { useUpdater } from "../components/UpdaterHost";
import { isTauri } from "../lib/platform";

type Wipe = "tasks" | "lists" | "all";

const COPY: Record<Wipe, { title: string; body: string; cta: string }> = {
  tasks: {
    title: "Delete all tasks?",
    body: "Every task, step and scheduled block will be removed. Your lists stay.",
    cta: "Delete tasks",
  },
  lists: {
    title: "Delete all lists?",
    body: "Every list will be removed. Tasks stay, but they lose their list.",
    cta: "Delete lists",
  },
  all: {
    title: "Delete everything?",
    body: "Every task and every list will be removed. This cannot be undone.",
    cta: "Delete everything",
  },
};

const UPDATE_COPY: Record<string, string> = {
  idle: "",
  checking: "Checking for updates…",
  "up-to-date": "You're on the latest version.",
  available: "An update is ready to install.",
  installing: "Downloading and installing…",
  error: "Couldn't check for updates.",
};

export default function SettingsPage() {
  const { data, dispatch, backend } = useStore();
  const { account, verifyPassword } = useAuth();
  const updater = useUpdater();
  const [wipe, setWipe] = useState<Wipe | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [appVersion, setAppVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    invoke<string>("app_version")
      .then(setAppVersion)
      .catch(() => setAppVersion(null));
  }, []);

  async function confirm() {
    if (!wipe) return;
    if (!password) return setError("Enter your password to confirm.");
    setBusy(true);
    const ok = await verifyPassword(password);
    setBusy(false);
    if (!ok) return setError("That password doesn't match.");
    dispatch({ type: "wipe", what: wipe });
    close();
  }

  const close = () => {
    setWipe(null);
    setPassword("");
    setError("");
  };

  return (
    <div className="scroll pad narrow">
      <h4>Account</h4>
      <p className="muted small">
        Signed in as {account?.email}. Auth and storage backend: <strong>{backend}</strong>.
      </p>

      {isTauri() && (
        <>
          <h4 className="mt">Updates</h4>
          <p className="muted small">
            {appVersion ? `Orbit v${appVersion}. ` : ""}
            Checks for a newer signed build on launch, or on demand here.
          </p>
          <div className="row gap">
            <button
              className="btn btn-secondary"
              disabled={updater.status === "checking" || updater.status === "installing"}
              onClick={() => void updater.checkForUpdate()}
            >
              <i className="ph ph-arrows-clockwise" />
              {updater.status === "checking" ? "Checking…" : "Check for updates"}
            </button>
            {updater.status === "available" && (
              <button className="btn btn-primary" onClick={() => void updater.installUpdate()}>
                <i className="ph ph-rocket-launch" />
                Install v{updater.version} &amp; restart
              </button>
            )}
            {UPDATE_COPY[updater.status] && updater.status !== "available" && (
              <span className="muted small">{UPDATE_COPY[updater.status]}</span>
            )}
          </div>
          {updater.status === "error" && updater.error && (
            <div className="notice mt-sm">{updater.error}</div>
          )}
        </>
      )}

      <h4 className="mt">Day timeline</h4>
      <p className="muted small">
        The window spans 4 hours behind and 20 hours ahead of now. New blocks default to 1 hour; drag a
        block's top or bottom edge to resize, drag it back to the task list to unschedule.
      </p>

      <h4 className="mt">Erase data</h4>
      <p className="muted small">
        Each of these asks for confirmation and your password. It cannot be undone.
      </p>
      <div className="danger-zone">
        <button className="btn btn-secondary wide" onClick={() => setWipe("tasks")}>
          <i className="ph ph-trash" />
          Delete all tasks
          <span className="spacer" />
          <span className="muted small">
            {data.tasks.length} {data.tasks.length === 1 ? "task" : "tasks"}
          </span>
        </button>
        <button className="btn btn-secondary wide" onClick={() => setWipe("lists")}>
          <i className="ph ph-trash" />
          Delete all lists
          <span className="spacer" />
          <span className="muted small">
            {data.lists.length} {data.lists.length === 1 ? "list" : "lists"}
          </span>
        </button>
        <button className="btn btn-primary wide" onClick={() => setWipe("all")}>
          <i className="ph ph-warning" />
          Delete everything
        </button>
      </div>

      {wipe && (
        <div className="modal-backdrop">
          <div className="modal narrow-modal">
            <h4>{COPY[wipe].title}</h4>
            <p className="muted small">{COPY[wipe].body}</p>
            <label className="field">
              <span>Confirm with your password</span>
              <input
                className="input"
                type="password"
                autoFocus
                value={password}
                placeholder="••••••••"
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && void confirm()}
              />
            </label>
            {error && <div className="notice">{error}</div>}
            <footer className="modal-foot">
              <span className="spacer" />
              <button className="btn btn-ghost" onClick={close}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={busy} onClick={() => void confirm()}>
                {busy ? "Checking…" : COPY[wipe].cta}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
