import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthKitProvider } from "@workos-inc/authkit-react";
import "./index.css";
import "./auth/auth.css";

import App from "./App";
import { AuthCallback, ProtectedRoute } from "./auth";
import { env } from "./config/env";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthKitProvider
      clientId={env.workos.clientId}
      redirectUri={env.workos.redirectUri}
      // Force localStorage token storage in all environments.
      //
      // By default, devMode is auto-enabled only on localhost. In production
      // the SDK stores the refresh token in an HttpOnly cookie on
      // api.workos.com.  Modern browsers block that cookie as third-party,
      // which causes the /user_management/authenticate refresh call to 400
      // and locks the user out after the short-lived access token expires.
      //
      // Enabling devMode stores tokens in localStorage instead, completely
      // bypassing the third-party cookie issue.
      //
      // Long-term fix: set up a custom auth domain (CNAME auth.lucid-ai.co
      // → WorkOS) so cookies are first-party, then remove devMode.
      devMode
      onRedirectCallback={(params) => {
        // After auth, navigate to the path stored in state (or home)
        const state = params.state as { returnTo?: string } | undefined;
        const returnTo = state?.returnTo ?? "/";
        window.history.replaceState({}, "", returnTo);
      }}
      onRefreshFailure={({ signIn }) => {
        // Safety net: if token refresh still fails for some reason,
        // redirect to sign-in instead of leaving the user stuck.
        console.warn("[Auth] Token refresh failed — re-authenticating");
        signIn();
      }}
    >
      <BrowserRouter>
        <Routes>
          {/* Auth callback route (public) */}
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Protected app routes */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <App />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthKitProvider>
  </StrictMode>,
);
