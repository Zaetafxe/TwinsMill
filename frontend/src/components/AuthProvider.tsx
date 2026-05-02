"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { type SessionUser, logoutUser, validateSession } from "@/lib/auth";

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  setUser: (next: SessionUser | null) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const safetyTimeout = window.setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 10000);

    validateSession()
      .then((sessionUser) => {
        if (mounted) {
          setUser(sessionUser);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
        window.clearTimeout(safetyTimeout);
      });

    return () => {
      mounted = false;
      window.clearTimeout(safetyTimeout);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      setUser,
      logout: async () => {
        await logoutUser();
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
