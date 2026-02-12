import { useAuth } from "@workos-inc/authkit-react";
import { useCallback } from "react";
import { env } from "../config/env";

// ---------------------------------------------------------------------------
// useAuthenticatedFetch — wraps fetch with an Authorization header
// ---------------------------------------------------------------------------
export function useAuthenticatedFetch() {
  const { getAccessToken } = useAuth();

  const authFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const token = await getAccessToken();

      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      };

      const url = path.startsWith("http")
        ? path
        : `${env.api.baseUrl}${path}`;

      return fetch(url, { ...options, headers });
    },
    [getAccessToken],
  );

  return authFetch;
}
