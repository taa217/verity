import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import LucidLogo from "../components/LucidLogo";

// ---------------------------------------------------------------------------
// AuthCallback — handles the WorkOS redirect after sign-in/sign-up
// The AuthKitProvider automatically exchanges the authorization_code
// for tokens. This component just shows a spinner while that happens,
// then redirects to the app.
// ---------------------------------------------------------------------------
export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Give AuthKitProvider a moment to process the code exchange,
    // then redirect to the main app. The onRedirectCallback in the
    // provider handles the actual state restoration.
    const timer = setTimeout(() => navigate("/", { replace: true }), 1500);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="auth-callback">
      <LucidLogo size={48} className="auth-callback__logo" />
      <p className="auth-callback__text">Signing you in...</p>
      <div className="auth-callback__spinner" />
    </div>
  );
}
