import { useAuth } from "@workos-inc/authkit-react";
import { useCallback } from "react";
import { env } from "../config/env";

// ---------------------------------------------------------------------------
// useAuthenticatedFetch — wraps fetch with an Authorization header
//
// Handles token refresh failures gracefully:
//  1. getAccessToken() throws  → redirect to sign-in (silent, no error flash)
//  2. getAccessToken() returns null → redirect to sign-in
//  3. Backend returns 401      → retry ONCE with a fresh token, then sign-in
// ---------------------------------------------------------------------------

/**
 * Return a Promise that never resolves.  Used when we're redirecting to
 * sign-in — the page will navigate away so there's nothing useful to
 * return, and this prevents the caller from setting an error state and
 * flashing the error screen during the redirect.
 */
function hangForRedirect(): Promise<never> {
  return new Promise(() => {});
}

export function useAuthenticatedFetch() {
  const { getAccessToken, signIn } = useAuth();

  const authFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const url = path.startsWith("http")
        ? path
        : `${env.api.baseUrl}${path}`;

      // --- Obtain a valid token ---
      let token: string | undefined;
      try {
        token = await getAccessToken();
      } catch (err) {
        console.warn("[Auth] getAccessToken() threw — re-authenticating:", err);
        signIn();
        return hangForRedirect();
      }

      if (!token) {
        console.warn("[Auth] No access token returned — re-authenticating");
        signIn();
        return hangForRedirect();
      }

      // --- Make the request ---
      const buildHeaders = (t: string): HeadersInit => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`,
        ...options.headers,
      });

      const res = await fetch(url, { ...options, headers: buildHeaders(token) });

      // --- If 401, try ONE refresh then retry ---
      if (res.status === 401) {
        let freshToken: string | undefined;
        try {
          freshToken = await getAccessToken();
        } catch {
          signIn();
          return hangForRedirect();
        }

        if (!freshToken || freshToken === token) {
          signIn();
          return hangForRedirect();
        }

        return fetch(url, { ...options, headers: buildHeaders(freshToken) });
      }

      return res;
    },
    [getAccessToken, signIn],
  );

  return authFetch;
}
