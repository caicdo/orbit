/** Arms a drag only once the user proves they mean it — either by moving the
 *  pointer past a small threshold, or by simply holding the button down for a
 *  moment without releasing. A plain click (press, maybe a pixel of jitter,
 *  release) never crosses either bar, so it reaches onClick untouched instead
 *  of being swallowed as a drag. Used anywhere a row is both clickable (opens
 *  something) and draggable (reorders/moves it) — see Sidebar's own inline
 *  variant, which additionally needs to resolve a drop target on every move. */
export function armOnHold(
  e: React.MouseEvent,
  onArm: () => void,
  opts: { moveThreshold?: number; holdMs?: number } = {},
): void {
  if (e.button !== 0) return;
  const { moveThreshold = 6, holdMs = 350 } = opts;
  const startX = e.clientX;
  const startY = e.clientY;
  let armed = false;

  const arm = () => {
    if (armed) return;
    armed = true;
    window.clearTimeout(timer);
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    onArm();
  };

  const onMove = (ev: MouseEvent) => {
    if (Math.abs(ev.clientX - startX) > moveThreshold || Math.abs(ev.clientY - startY) > moveThreshold) arm();
  };

  const onUp = () => {
    window.clearTimeout(timer);
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };

  const timer = window.setTimeout(arm, holdMs);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}
