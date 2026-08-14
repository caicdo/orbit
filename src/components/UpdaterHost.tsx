import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { isTauri } from "../lib/platform";

export type UpdateStatus = "idle" | "checking" | "up-to-date" | "available" | "installing" | "error";

interface UpdaterValue {
  status: UpdateStatus;
  version: string | null;
  error: string | null;
  checkForUpdate(): Promise<void>;
  installUpdate(): Promise<void>;
}

const Ctx = createContext<UpdaterValue | null>(null);

/** Checks GitHub Releases for a newer signed build. A quiet check runs itself
 *  shortly after launch; the Settings page's "Check for updates" button and
 *  the corner toast both read this same state, so whichever one finds an
 *  update, the other sees it too. */
export function UpdaterHost({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [version, setVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const updateRef = useRef<Update | null>(null);

  const runCheck = useCallback(async (silent: boolean) => {
    setStatus("checking");
    setDismissed(false);
    if (!silent) setError(null);
    try {
      const update = await check();
      if (update) {
        updateRef.current = update;
        setVersion(update.version);
        setStatus("available");
      } else {
        updateRef.current = null;
        setStatus("up-to-date");
      }
    } catch (e) {
      updateRef.current = null;
      if (silent) {
        // A background check failing (offline, DNS hiccup) shouldn't alarm
        // anyone — it just quietly tries again next launch.
        setStatus("idle");
      } else {
        setError(e instanceof Error ? e.message : "Couldn't reach the update server.");
        setStatus("error");
      }
    }
  }, []);

  const checkForUpdate = useCallback(() => runCheck(false), [runCheck]);

  const installUpdate = useCallback(async () => {
    if (!updateRef.current) return;
    setStatus("installing");
    setError(null);
    try {
      await updateRef.current.downloadAndInstall();
      await relaunch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The update failed to install.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    const id = window.setTimeout(() => void runCheck(true), 3000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Ctx.Provider value={{ status, version, error, checkForUpdate, installUpdate }}>
      {children}
      {status === "available" && !dismissed && (
        <div className="toast update-toast">
          <div className="toast-body">
            <i className="ph ph-rocket-launch" /> Orbit {version} is ready to install.
          </div>
          <div className="toast-actions">
            <button className="btn btn-ghost small" onClick={() => setDismissed(true)}>
              Later
            </button>
            <button className="btn btn-primary small" onClick={() => void installUpdate()}>
              Install &amp; restart
            </button>
          </div>
        </div>
      )}
      {status === "installing" && (
        <div className="toast update-toast">
          <div className="toast-body">Downloading the update…</div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useUpdater(): UpdaterValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUpdater must be used inside <UpdaterHost>");
  return ctx;
}
