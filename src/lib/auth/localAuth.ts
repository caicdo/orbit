import { uid } from "../id";
import type { Account } from "../types";
import type { AuthProvider, AuthResult } from "./types";

/** Offline account, stored on this Mac only.
 *  NOT secure — it exists so the app is usable before a backend is wired up.
 *  With Supabase configured this file is never used. */

interface StoredAccount extends Account {
  secret: string;
}

const ACCOUNTS = "orbit:accounts";
const SESSION = "orbit:session";

const read = (): StoredAccount[] => {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS) ?? "[]") as StoredAccount[];
  } catch {
    return [];
  }
};
const write = (all: StoredAccount[]) => localStorage.setItem(ACCOUNTS, JSON.stringify(all));
const obscure = (s: string) => btoa(unescape(encodeURIComponent(`orbit:${s}`)));
const strip = ({ id, name, email }: StoredAccount): Account => ({ id, name, email });

export const localAuth: AuthProvider = {
  name: "local",

  async current() {
    const id = localStorage.getItem(SESSION);
    const found = id ? read().find((a) => a.id === id) : undefined;
    return found ? strip(found) : null;
  },

  async signIn(email, password): Promise<AuthResult> {
    const found = read().find((a) => a.email.toLowerCase() === email.toLowerCase());
    if (!found) return { error: "No account with that email on this Mac." };
    if (found.secret !== obscure(password)) return { error: "Wrong password." };
    localStorage.setItem(SESSION, found.id);
    return { account: strip(found) };
  },

  async signUp(name, email, password): Promise<AuthResult> {
    const all = read();
    if (all.some((a) => a.email.toLowerCase() === email.toLowerCase()))
      return { error: "That email already has an account here." };
    const account: StoredAccount = {
      id: uid(),
      name: name.trim() || email.split("@")[0],
      email,
      secret: obscure(password),
    };
    write([...all, account]);
    localStorage.setItem(SESSION, account.id);
    return { account: strip(account) };
  },

  async signOut() {
    localStorage.removeItem(SESSION);
  },

  async verifyPassword(password) {
    const id = localStorage.getItem(SESSION);
    const found = id ? read().find((a) => a.id === id) : undefined;
    return Boolean(found && found.secret === obscure(password));
  },
};
