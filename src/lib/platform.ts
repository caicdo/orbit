/** True when running inside the Tauri desktop shell, false in a plain browser
 *  tab (e.g. `npm run dev` opened directly, or this app's own preview tooling).
 *  Update checks and other native-only features gate on this. */
export const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
