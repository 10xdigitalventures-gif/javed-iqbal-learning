import React, { createContext, useContext, useEffect, useState } from "react";
import { api, clearToken, loadToken, setToken } from "./api";
import { clearPush, registerForPush } from "./push";

export type User = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "CONSULTANT" | "CLIENT";
  title?: string;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (body: any) => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function bootstrap() {
    const t = await loadToken();
    if (!t) {
      setLoading(false);
      return;
    }
    try {
      const me = await api<User>("/auth/me");
      setUser(me);
      registerForPush();
    } catch {
      await clearToken();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
  }, []);

  async function login(email: string, password: string) {
    const res = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    await setToken(res.token);
    setUser(res.user);
    registerForPush();
    return res.user;
  }

  async function register(body: any) {
    const res = await api<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body,
    });
    await setToken(res.token);
    setUser(res.user);
    registerForPush();
    return res.user;
  }

  async function logout() {
    await clearPush();
    await clearToken();
    setUser(null);
  }

  const value: AuthState = { user, loading, login, register, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
