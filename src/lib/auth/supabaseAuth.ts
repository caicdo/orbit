import { getSupabase } from "../supabaseClient";
import type { Account } from "../types";
import type { AuthProvider, AuthResult } from "./types";

const toAccount = (user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }): Account => ({
  id: user.id,
  email: user.email ?? "",
  name: (user.user_metadata?.name as string) || (user.email ?? "").split("@")[0],
});

export const supabaseAuth: AuthProvider = {
  name: "supabase",

  async current() {
    const sb = await getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session?.user ? toAccount(data.session.user) : null;
  },

  async signIn(email, password): Promise<AuthResult> {
    const sb = await getSupabase();
    if (!sb) return { error: "Supabase is not configured." };
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { account: toAccount(data.user!) };
  },

  async signUp(name, email, password): Promise<AuthResult> {
    const sb = await getSupabase();
    if (!sb) return { error: "Supabase is not configured." };
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) return { error: error.message };
    if (!data.session)
      return { error: "Check your inbox to confirm the address, then sign in." };
    return { account: toAccount(data.user!) };
  },

  async signOut() {
    const sb = await getSupabase();
    await sb?.auth.signOut();
  },

  /** Re-authenticates with the current email — Supabase has no "check password" call. */
  async verifyPassword(password) {
    const sb = await getSupabase();
    if (!sb) return false;
    const { data } = await sb.auth.getUser();
    const email = data.user?.email;
    if (!email) return false;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return !error;
  },
};
