"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { VidyalankarLogo } from "@/app/components/AuthHero";

export default function Sidebar({ session }) {
  const pathname = usePathname();
  const user = session?.user || {};

  const isActive = (path) => pathname === path;

  return (
    <>
      <style>{`
        :root {
          --bg: #f8fafc;
          --surface: #ffffff;
          --surface-border: #e2e8f0;
          --text-primary: #0f172a;
          --text-secondary: #475569;
          --text-muted: #94a3b8;
          --accent: #1d4ed8;
          --accent-hover: #2563eb;
          --accent-light: rgba(29, 78, 216, 0.08);
          --navy: #07172f;
        }

        .dash-layout {
          display: flex;
          min-height: 100vh;
          background-color: var(--bg);
        }

        .sidebar {
          width: 260px;
          background: var(--navy);
          border-right: 1px solid rgba(255,255,255,0.06);
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
          align-items: center;
          padding: 0.5rem 0.5rem 1.25rem;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          margin-bottom: 1.25rem;
        }

        .brand-sub {
          font-size: 0.7rem;
          color: #64748b;
          margin-top: 0.5rem;
          letter-spacing: 0.04em;
          text-align: center;
          font-weight: 500;
        }

        .nav-menu {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          flex: 1;
        }

        .nav-group-title {
          font-size: 0.6rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #334155;
          margin: 1.25rem 0.5rem 0.5rem;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.65rem 0.85rem;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          color: #94a3b8;
          text-decoration: none;
          transition: all 0.15s ease;
        }

        .nav-link:hover {
          background: rgba(255,255,255,0.07);
          color: #e2e8f0;
        }

        .nav-link.active {
          background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
          color: #ffffff;
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(29, 78, 216, 0.35);
        }

        .nav-icon {
          display: flex;
          align-items: center;
          flex-shrink: 0;
          opacity: 0.85;
        }

        .nav-link.active .nav-icon {
          opacity: 1;
        }

        .sidebar-footer {
          padding-top: 1.25rem;
          border-top: 1px solid rgba(255,255,255,0.08);
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
          background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
          color: #ffffff;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.875rem;
          flex-shrink: 0;
          border: 1px solid rgba(59,130,246,0.4);
        }

        .user-info {
          overflow: hidden;
        }

        .user-email {
          font-size: 0.8125rem;
          font-weight: 600;
          color: #e2e8f0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-role-badge {
          font-size: 0.6875rem;
          color: #64748b;
          text-transform: capitalize;
          font-weight: 500;
        }

        .btn-signout {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          background: transparent;
          color: #94a3b8;
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: inherit;
        }

        .btn-signout:hover {
          background: rgba(220, 38, 38, 0.12);
          color: #f87171;
          border-color: rgba(220, 38, 38, 0.3);
        }
      `}</style>

      <aside className="sidebar">
        <div className="brand-header">
          <VidyalankarLogo />
          <span className="brand-sub">Supercomputer Portal</span>
        </div>

        <nav className="nav-menu">
          <Link
            href="/dashboard"
            className={`nav-link ${isActive("/dashboard") ? "active" : ""}`}
          >
            <span className="nav-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
              </svg>
            </span>
            Active Access
          </Link>
          <Link
            href="/dashboard/calendar"
            className={`nav-link ${isActive("/dashboard/calendar") ? "active" : ""}`}
          >
            <span className="nav-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </span>
            Calendar &amp; Booking
          </Link>
          {user.role === "admin" && (
            <>
              <div className="nav-group-title">Admin Management</div>
              <Link
                href="/admin/requests"
                className={`nav-link ${isActive("/admin/requests") ? "active" : ""}`}
              >
                <span className="nav-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </span>
                Review Requests
              </Link>
              <Link
                href="/admin/containers"
                className={`nav-link ${isActive("/admin/containers") ? "active" : ""}`}
              >
                <span className="nav-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                    <line x1="12" y1="12" x2="12" y2="16" />
                    <line x1="10" y1="14" x2="14" y2="14" />
                  </svg>
                </span>
                Containers &amp; Storage
              </Link>
              <Link
                href="/admin/audit-logs"
                className={`nav-link ${isActive("/admin/audit-logs") ? "active" : ""}`}
              >
                <span className="nav-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </span>
                Audit Logs
              </Link>
              <Link
                href="/admin/users"
                className={`nav-link ${isActive("/admin/users") ? "active" : ""}`}
              >
                <span className="nav-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
                User Management
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
