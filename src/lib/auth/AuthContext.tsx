import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { isSupabaseConfigured } from "../supabaseClient";
import type { Account } from "../types";
import { localAuth } from "./localAuth";
import { supabaseAuth } from "./supabaseAuth";
import type { AuthProvider } from "./types";

/** Backend chosen from the environment. Nothing else in the app knows which one. */
export const authProvider: AuthProvider = isSupabaseConfigured() ? supabaseAuth : localAuth;

interface AuthContextValue {
  account: Account | null;
  ready: boolean;
  backend: AuthProvider["name"];
  signIn(email: string, password: string): Promise<string | null>;
  signUp(name: string, email: string, password: string): Promise<string | null>;
  signOut(): Promise<void>;
  verifyPassword(password: string): Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProviderComponent({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    authProvider.current().then((a) => {
      if (!alive) return;
      setAccount(a);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { account: a, error } = await authProvider.signIn(email, password);
    if (a) setAccount(a);
    return error ?? null;
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { account: a, error } = await authProvider.signUp(name, email, password);
    if (a) setAccount(a);
    return error ?? null;
  }, []);

  const signOut = useCallback(async () => {
    await authProvider.signOut();
    setAccount(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      account,
      ready,
      backend: authProvider.name,
      signIn,
      signUp,
      signOut,
      verifyPassword: authProvider.verifyPassword,
    }),
    [account, ready, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProviderComponent>");
  return ctx;
}
