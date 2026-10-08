// Authentification centralisée (Supabase Auth du projet Resillia de production).
// Une seule source de vérité pour la session : ne pas dupliquer cette logique dans les pages.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/resillia/client";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  sessionExpired: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    let manualSignOut = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT") {
        if (!manualSignOut) setSessionExpired(true);
        manualSignOut = false;
      }
      if (event === "SIGNED_IN") setSessionExpired(false);
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    (window as any).__resilliaManualSignOut = () => { manualSignOut = true; };
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    (window as any).__resilliaManualSignOut?.();
    setSessionExpired(false);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, sessionExpired, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
