import type { AppData } from "../types";
import type { DataAdapter } from "./types";
import { getSupabase } from "../supabaseClient";

/** Supabase storage.
 *
 *  Shape used here is deliberately simple: one row per user in a `workspaces`
 *  table holding the whole document as JSONB. It gets you syncing in minutes and
 *  is easy to split into real `tasks` / `lists` tables later (see README).
 *
 *  SQL to create it is in README.md → "Wiring Supabase".
 */
export const supabaseAdapter: DataAdapter = {
  name: "supabase",
  async load(userId) {
    const sb = await getSupabase();
    if (!sb) return null;
    const { data, error } = await sb
      .from("workspaces")
      .select("document")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("[supabase] load failed", error.message);
      return null;
    }
    return (data?.document as AppData) ?? null;
  },
  async save(userId, document) {
    const sb = await getSupabase();
    if (!sb) return;
    const { error } = await sb
      .from("workspaces")
      .upsert({ user_id: userId, document, updated_at: new Date().toISOString() });
    if (error) console.error("[supabase] save failed", error.message);
  },
};
