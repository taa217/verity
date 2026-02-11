import { useState } from "react";
import {
  Plus,
  FileText,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Clock,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNewSession: () => void;
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
export default function Sidebar({
  collapsed,
  onToggle,
  onNewSession,
}: SidebarProps) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [recentsOpen, setRecentsOpen] = useState(false);

  return (
    <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}>
      {collapsed ? (
        /* ---- Collapsed view ---- */
        <div className="sidebar__collapsed-content">
          <button
            className="sidebar__icon-btn"
            onClick={onToggle}
            aria-label="Expand sidebar"
          >
            <PanelLeft size={20} />
          </button>
          <button
            className="sidebar__icon-btn sidebar__icon-btn--accent"
            onClick={onNewSession}
            aria-label="New session"
          >
            <Plus size={20} />
          </button>
        </div>
      ) : (
        /* ---- Expanded view ---- */
        <>
          {/* Header */}
          <div className="sidebar__head">
            <div className="sidebar__brand">
              <div className="sidebar__logo">V</div>
              <span className="sidebar__name">Verity</span>
            </div>
            <button
              className="sidebar__icon-btn"
              onClick={onToggle}
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose size={18} />
            </button>
          </div>

          {/* New Session */}
          <button className="sidebar__new" onClick={onNewSession}>
            <Plus size={16} />
            New Session
          </button>

          {/* Navigation sections */}
          <nav className="sidebar__nav">
            <SidebarSection
              icon={<FileText size={15} />}
              label="LIBRARY"
              open={libraryOpen}
              onToggle={() => setLibraryOpen(!libraryOpen)}
              emptyText="No saved lessons yet"
            />
            <SidebarSection
              icon={<Clock size={15} />}
              label="RECENTS"
              open={recentsOpen}
              onToggle={() => setRecentsOpen(!recentsOpen)}
              emptyText="No recent sessions"
            />
          </nav>

          {/* Footer / User */}
          <div className="sidebar__foot">
            <div className="sidebar__user">
              <div className="sidebar__avatar">G</div>
              <div className="sidebar__user-detail">
                <span className="sidebar__user-name">Guest User</span>
                <span className="sidebar__user-email">
                  Sign in for more features
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Collapsible section sub-component
// ---------------------------------------------------------------------------
function SidebarSection({
  icon,
  label,
  open,
  onToggle,
  emptyText,
}: {
  icon: React.ReactNode;
  label: string;
  open: boolean;
  onToggle: () => void;
  emptyText: string;
}) {
  return (
    <div className="sidebar__section">
      <button className="sidebar__section-hd" onClick={onToggle}>
        {icon}
        <span>{label}</span>
        <ChevronRight
          size={14}
          className={`sidebar__chevron ${open ? "sidebar__chevron--open" : ""}`}
        />
      </button>
      {open && (
        <div className="sidebar__section-body">
          <p className="sidebar__empty">{emptyText}</p>
        </div>
      )}
    </div>
  );
}
