import { useAuth } from "@workos-inc/authkit-react";
import SignInPage from "./SignInPage";

// ---------------------------------------------------------------------------
// ProtectedRoute — renders children only when authenticated
// ---------------------------------------------------------------------------
interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading__spinner" />
      </div>
    );
  }

  if (!user) {
    return <SignInPage />;
  }

  return <>{children}</>;
}
