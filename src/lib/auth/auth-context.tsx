import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { UserRole } from "@/types";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface DbStatus {
  connected: boolean;
  provider: string;
  details: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  dbStatus: DbStatus | null;
  login: (email: string, password: string) => Promise<{ success: boolean; user?: AuthUser; error?: string }>;
  register: (
    name: string,
    email: string,
    password: string,
    role?: UserRole
  ) => Promise<{ success: boolean; user?: AuthUser; error?: string }>;
  logout: () => Promise<void>;
  quickLoginAs: (role: UserRole) => Promise<void>;
  refreshDbStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// In-memory token fallback (never persisted to localStorage to prevent XSS token exfiltration)
let inMemorySessionToken: string | null = null;

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const modifiedInit: RequestInit = { ...init };
  if (!modifiedInit.credentials) {
    modifiedInit.credentials = "include";
  }
  if (inMemorySessionToken) {
    const headers = new Headers(modifiedInit.headers || {});
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${inMemorySessionToken}`);
    }
    modifiedInit.headers = headers;
  }
  return fetch(input, modifiedInit);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);

  const clearClientSessionState = () => {
    inMemorySessionToken = null;
    if (typeof window !== "undefined") {
      try {
        const legacyKey = ["tuklas", "session", "token"].join("_");
        window.localStorage.removeItem(legacyKey);
      } catch {
        // Ignore storage access errors in restricted contexts
      }
    }
  };

  const fetchCurrentUser = async () => {
    try {
      // Purge any legacy token previously stored in localStorage
      if (typeof window !== "undefined") {
        try {
          const legacyKey = ["tuklas", "session", "token"].join("_");
          window.localStorage.removeItem(legacyKey);
        } catch {
          // Ignore storage access errors
        }
      }
      const res = await authFetch("/api/auth/me");

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        clearClientSessionState();
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchDbStatus = async () => {
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data.database);
      }
    } catch (e) {
      console.warn("Could not retrieve DB health:", e);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchDbStatus();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await authFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Login failed" };
      }

      if (data.token) {
        inMemorySessionToken = data.token;
      }

      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error during login";
      return { success: false, error: message };
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    role?: UserRole
  ) => {
    try {
      const res = await authFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role: role || "STUDENT" }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Registration failed" };
      }

      if (data.token) {
        inMemorySessionToken = data.token;
      }

      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error during registration";
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      clearClientSessionState();
      await authFetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      setUser(null);
    }
  };

  const quickLoginAs = async (role: UserRole) => {
    // Quick login is strictly for local development and testing only; no credentials exist in client code.
    if (!import.meta.env.DEV) {
      return;
    }

    const res = await authFetch("/api/auth/dev-quick-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Development quick sign-in failed");
    }
    if (data.token) {
      inMemorySessionToken = data.token;
    }
    setUser(data.user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        dbStatus,
        login,
        register,
        logout,
        quickLoginAs,
        refreshDbStatus: fetchDbStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
