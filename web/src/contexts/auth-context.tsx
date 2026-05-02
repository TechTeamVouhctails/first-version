"use client";

import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import type { AppUser } from "@/lib/api/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";

type AuthContextValue = {
  session: Session | null;
  user: AppUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async (accessToken: string) => {
    const res = await apiFetch<{ user: AppUser }>("/users/me", { accessToken });
    setUser(res.user);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let client: SupabaseClient;
    try {
      client = createSupabaseBrowserClient();
    } catch {
      setLoading(false);
      return;
    }
    setSupabase(client);

    (async () => {
      try {
        const { data } = await client.auth.getSession();
        if (cancelled) return;
        const sess = data.session ?? null;
        setSession(sess);
        if (sess?.access_token) {
          await loadUser(sess.access_token);
        } else {
          setUser(null);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const { data: sub } = client.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess);
      if (!sess?.access_token) {
        setUser(null);
        return;
      }
      try {
        await loadUser(sess.access_token);
      } catch {
        setUser(null);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadUser]);

  const refreshUser = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const tok = data.session?.access_token;
    if (!tok) {
      setUser(null);
      return;
    }
    await loadUser(tok);
  }, [supabase, loadUser]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ session, user, loading, refreshUser, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
