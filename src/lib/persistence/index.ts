import { isSupabaseConfigured } from "../supabaseClient";
import { localAdapter } from "./localAdapter";
import { supabaseAdapter } from "./supabaseAdapter";
import type { DataAdapter } from "./types";

export type { DataAdapter };

/** Chosen once at startup from the environment — no code changes needed to switch. */
export const dataAdapter: DataAdapter = isSupabaseConfigured() ? supabaseAdapter : localAdapter;
