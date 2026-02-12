import { useEffect, useRef } from "react";
import { useAuth } from "@workos-inc/authkit-react";

// ---------------------------------------------------------------------------
// ProtectedRoute — renders children only when authenticated.
// If the user is not signed in, they are redirected straight to WorkOS
// sign-in (no intermediate splash page).
// ---------------------------------------------------------------------------
interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading, signIn } = useAuth();
  const redirecting = useRef(false);

  useEffect(() => {
    if (!isLoading && !user && !redirecting.current) {
      redirecting.current = true;
      signIn();
    }
  }, [isLoading, user, signIn]);

  if (isLoading || !user) {
    return (
      <div className="auth-loading">
        <div className="auth-loading__spinner" />
      </div>
    );
  }

  return <>{children}</>;
}
