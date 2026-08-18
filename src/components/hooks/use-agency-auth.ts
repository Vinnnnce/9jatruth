/**
 * useAgencyAuth Hook
 *
 * Manages agency account authentication state.
 * Checks for existing session on mount, provides login/register/logout.
 */

import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

export interface AgencyAuthState {
  account: {
    id: number;
    email: string;
    displayName: string;
    role: string;
  } | null;
  organization: {
    id: number;
    name: string;
    type: string;
    verified: number;
    contactEmail?: string;
    description?: string | null;
    region?: string | null;
    city?: string | null;
    website?: string | null;
    contactPhone?: string | null;
  } | null;
}

export function useAgencyAuth() {
  const [auth, setAuth] = useState<AgencyAuthState>({ account: null, organization: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkSession = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setAuth(data);
      } else {
        setAuth({ account: null, organization: null });
      }
    } catch {
      setAuth({ account: null, organization: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const res = await apiRequest("POST", "/api/auth/agency/login", { email, password });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "Login failed");
    }
    const data = await res.json();
    setAuth(data);
    return data;
  }, []);

  const register = useCallback(async (data: {
    orgName: string;
    orgType: string;
    description?: string;
    contactEmail: string;
    contactPhone?: string;
    website?: string;
    region?: string;
    city?: string;
    email: string;
    password: string;
    displayName: string;
  }) => {
    setError(null);
    const res = await apiRequest("POST", "/api/auth/agency/register", data);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Registration failed");
    }
    const result = await res.json();
    setAuth(result);
    return result;
  }, []);

  const logout = useCallback(async () => {
    await apiRequest("POST", "/api/auth/logout");
    setAuth({ account: null, organization: null });
  }, []);

  const updateSettings = useCallback(async (data: {
    displayName?: string;
    contactEmail?: string;
    contactPhone?: string;
    website?: string;
    description?: string;
    region?: string;
    city?: string;
    currentPassword?: string;
    newPassword?: string;
  }) => {
    setError(null);
    // Include the account email so the API can look up the account
    // even when the user authenticated via password-based agency auth (not Clerk)
    const payload = { ...data, email: auth.account?.email };
    const res = await apiRequest("PATCH", "/api/account/settings", payload);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Update failed");
    }
    const result = await res.json();
    setAuth(result);
    return result;
  }, []);

  return { auth, loading, error, login, register, logout, updateSettings, checkSession };
}
