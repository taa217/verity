import { useAuth } from "@workos-inc/authkit-react";
import LucidLogo from "../components/LucidLogo";

// ---------------------------------------------------------------------------
// SignInPage — shown when user is not authenticated
// ---------------------------------------------------------------------------
export default function SignInPage() {
  const { signIn, signUp } = useAuth();

  return (
    <div className="signin-page">
      <div className="signin-card">
        {/* Logo & brand */}
        <div className="signin-card__header">
          <LucidLogo size={48} className="signin-card__logo" />
          <h1 className="signin-card__title">Welcome to Lucid</h1>
          <p className="signin-card__subtitle">
            AI-powered visual learning that brings concepts to life
          </p>
        </div>

        {/* Actions */}
        <div className="signin-card__actions">
          <button
            className="signin-card__btn signin-card__btn--primary"
            onClick={() => signIn()}
          >
            Sign In
          </button>
          <button
            className="signin-card__btn signin-card__btn--secondary"
            onClick={() => signUp()}
          >
            Create Account
          </button>
        </div>

        {/* Footer */}
        <p className="signin-card__footer">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
