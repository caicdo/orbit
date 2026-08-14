import type { Account } from "../types";

export interface AuthResult {
  account?: Account;
  error?: string;
}

/** Swap the whole auth story by implementing this once. */
export interface AuthProvider {
  readonly name: "local" | "supabase";
  /** Restore an existing session on launch. */
  current(): Promise<Account | null>;
  signIn(email: string, password: string): Promise<AuthResult>;
  signUp(name: string, email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  /** Used before destructive actions (Settings → Erase data). */
  verifyPassword(password: string): Promise<boolean>;
}
