import { useAuth } from "../lib/auth/AuthContext";

/** The whole strip is draggable so the window moves like a native one.
 *  macOS traffic lights are drawn by the system (titleBarStyle: Overlay). */
export default function Titlebar() {
  const { account } = useAuth();
  return (
    <div className="titlebar" data-tauri-drag-region>
      <span className="titlebar-title">{account ? `Orbit — ${account.name}` : "Orbit"}</span>
    </div>
  );
}
