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
      onRedirectCallback={({ state }) => {
        // After auth, navigate to the path stored in state (or home)
        const returnTo =
          (state as { returnTo?: string } | undefined)?.returnTo ?? "/";
        window.history.replaceState({}, "", returnTo);
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
