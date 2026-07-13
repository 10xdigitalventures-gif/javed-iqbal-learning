"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearToken } from "./api";
import type { User } from "./types";

type AuthState = {
  user: User | null;
  effectiveRole: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
  switchRole: (role: string) => void;
};

const AuthContext = createContext<AuthState>({} as AuthState);

function storedRole() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("activeRole");
}

function canUseRole(user: User, role: string) {
  if (user.role === role) return true;
  return Boolean(user.tenantRoles?.some((r) => r.role === role));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [effectiveRole, setEffectiveRole] = useState<string | null>(
    storedRole(),
  );
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  async function refresh() {
    try {
      const me = await api<User>("/auth/me");
      const active = storedRole();
      setUser(active ? { ...me, role: active as any } : me);
      setEffectiveRole(active || me.role);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function login(email: string, password: string) {
    const res = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    localStorage.removeItem("activeRole");
    setEffectiveRole(res.user.role);
    setUser(res.user);
    return res.user;
  }

  function logout() {
    api("/auth/logout", { method: "POST" }).catch(() => {});
    clearToken();
    localStorage.removeItem("activeRole");
    setEffectiveRole(null);
    setUser(null);
    router.push("/login");
  }

  function switchRole(role: string) {
    if (!user || !canUseRole(user, role)) return;
    localStorage.setItem("activeRole", role);
    const next = { ...user, role: role as any };
    setEffectiveRole(role);
    setUser(next);
    router.push(homeForRole(role));
  }

  const value: AuthState = {
    user,
    effectiveRole,
    loading,
    login,
    logout,
    refresh,
    switchRole,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

// Redirect helper for the post-login landing page based on role.
export function homeForRole(role?: string) {
  if (role === "ADMIN") return "/admin";
  if (role === "SUPPORT") return "/admin/support";
  if (role === "TENANT_ADMIN") return "/tenant-admin";
  if (role === "CONSULTANT") return "/consultant";
  return "/client";
}
