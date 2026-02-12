import { useState, useRef, useEffect } from "react";
import { useAuth } from "@workos-inc/authkit-react";
import { LogOut, Settings, ChevronUp } from "lucide-react";

// ---------------------------------------------------------------------------
// UserMenu — displays authenticated user info with a dropdown
// ---------------------------------------------------------------------------
export default function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) return null;

  const initials = getInitials(user.firstName, user.lastName, user.email);
  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        className="user-menu__trigger"
        onClick={() => setOpen(!open)}
        aria-label="User menu"
      >
        {user.profilePictureUrl ? (
          <img
            src={user.profilePictureUrl}
            alt=""
            className="user-menu__avatar-img"
          />
        ) : (
          <div className="user-menu__avatar">{initials}</div>
        )}
        <div className="user-menu__info">
          <span className="user-menu__name">{displayName}</span>
          <span className="user-menu__email">{user.email}</span>
        </div>
        <ChevronUp
          size={14}
          className={`user-menu__chevron ${open ? "user-menu__chevron--open" : ""}`}
        />
      </button>

      {open && (
        <div className="user-menu__dropdown">
          <button
            className="user-menu__item"
            onClick={() => {
              setOpen(false);
              // Future: navigate to settings
            }}
          >
            <Settings size={14} />
            <span>Settings</span>
          </button>
          <div className="user-menu__divider" />
          <button
            className="user-menu__item user-menu__item--danger"
            onClick={() => signOut()}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function getInitials(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null,
): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) return firstName[0].toUpperCase();
  if (email) return email[0].toUpperCase();
  return "U";
}
