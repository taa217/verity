// ---------------------------------------------------------------------------
// Environment configuration — single source of truth for env variables
// ---------------------------------------------------------------------------

export const env = {
  workos: {
    clientId: import.meta.env.VITE_WORKOS_CLIENT_ID as string,
    redirectUri: import.meta.env.VITE_WORKOS_REDIRECT_URI as string | undefined,
  },
  api: {
    baseUrl: (import.meta.env.VITE_API_URL as string) || "http://localhost:8000",
  },
} as const;
