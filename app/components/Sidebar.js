"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

export default function Sidebar({ session }) {
  const pathname = usePathname();
  const user = session?.user || {};

  const isActive = (path) => pathname === path;

  return (
    <>
      <style>{`
        :root {
          --bg: #fafafa;
          --surface: #ffffff;
          --surface-border: #e5e5e5;
          --text-primary: #111111;
          --text-secondary: #555555;
          --text-muted: #888888;
        }

        .dash-layout {
          display: flex;
          min-height: 100vh;
          background-color: var(--bg);
        }

        .sidebar {
          width: 260px;
          background: #ffffff;
          border-right: 1px solid var(--surface-border);
          display: flex;
          flex-direction: column;
          padding: 1.5rem 1rem;
          flex-shrink: 0;
          box-sizing: border-box;
          min-height: 100vh;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
        }

        .brand-header {
          display: flex;
          flex-direction: column;
          padding: 0 0.5rem 1.25rem;
          border-bottom: 1px solid var(--surface-border);
          margin-bottom: 1.25rem;
        }

        .brand-logo {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }

        .brand-sub {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-top: 0.2rem;
        }

        .nav-menu {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          flex: 1;
        }

        .nav-group-title {
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          margin: 1.25rem 0.5rem 0.5rem;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.65rem 0.85rem;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-secondary);
          text-decoration: none;
          transition: all 0.15s ease;
        }

        .nav-link:hover {
          background: #f5f5f5;
          color: var(--text-primary);
        }

        .nav-link.active {
          background: #111111;
          color: #ffffff;
          font-weight: 600;
        }

        .nav-icon {
          font-size: 1rem;
        }

        .sidebar-footer {
          padding-top: 1.25rem;
          border-top: 1px solid var(--surface-border);
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .user-profile {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #111111;
          color: #ffffff;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.875rem;
          flex-shrink: 0;
        }

        .user-info {
          overflow: hidden;
        }

        .user-email {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-role-badge {
          font-size: 0.6875rem;
          color: var(--text-muted);
          text-transform: capitalize;
          font-weight: 500;
        }

        .btn-signout {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid var(--surface-border);
          border-radius: 6px;
          background: transparent;
          color: var(--text-secondary);
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-signout:hover {
          background: #fdf3f2;
          color: #c0392b;
          border-color: #f5c6cb;
        }
      `}</style>

      <aside className="sidebar">
        <div className="brand-header">
          <span className="brand-logo">⚡ Access</span>
          <span className="brand-sub">Supercomputer Portal</span>
        </div>

        <nav className="nav-menu">
          <Link
            href="/dashboard"
            className={`nav-link ${isActive("/dashboard") ? "active" : ""}`}
          >
            <span className="nav-icon">🖥️</span> Active Access
          </Link>
          <Link
            href="/dashboard/calendar"
            className={`nav-link ${isActive("/dashboard/calendar") ? "active" : ""}`}
          >
            <span className="nav-icon">📅</span> Calendar & Booking
          </Link>
          {user.role === "admin" && (
            <>
              <div className="nav-group-title">Admin Management</div>
              <Link
                href="/admin/requests"
                className={`nav-link ${isActive("/admin/requests") ? "active" : ""}`}
              >
                <span className="nav-icon">📋</span> Review Requests
              </Link>
              <Link
                href="/admin/containers"
                className={`nav-link ${isActive("/admin/containers") ? "active" : ""}`}
              >
                <span className="nav-icon">🐳</span> Containers & Storage
              </Link>
              <Link
                href="/admin/audit-logs"
                className={`nav-link ${isActive("/admin/audit-logs") ? "active" : ""}`}
              >
                <span className="nav-icon">📜</span> Audit Logs
              </Link>
              <Link
                href="/admin/users"
                className={`nav-link ${isActive("/admin/users") ? "active" : ""}`}
              >
                <span className="nav-icon">👥</span> User Management
              </Link>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              {user.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="user-info">
              <div className="user-email" title={user.email}>
                {user.email || "User"}
              </div>
              <div className="user-role-badge">{user.role || "User"}</div>
            </div>
          </div>
          <button
            id="dash-signout-btn"
            className="btn-signout"
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          >
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
