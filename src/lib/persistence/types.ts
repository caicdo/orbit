import type { AppData } from "../types";

/** Everything the app needs from a storage backend.
 *  Implement this interface to move storage anywhere (Supabase, SQLite, a file). */
export interface DataAdapter {
  readonly name: string;
  load(userId: string): Promise<AppData | null>;
  save(userId: string, data: AppData): Promise<void>;
}
