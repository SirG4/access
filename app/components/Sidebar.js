"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { VidyalankarLogo } from "@/app/components/AuthHero";

export default function Sidebar({ session }) {
  const pathname = usePathname();
  const user = session?.user || {};
  const [isOpen, setIsOpen] = useState(false);

  const isActive = (path) => pathname === path;

  // Auto-close popout drawer on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Lock body scroll when mobile popout is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');

        :root {
          --bg: #f4f5f7;
          --surface: #ffffff;
          --surface-border: #dde1e7;
          --text-primary: #111827;
          --text-secondary: #374151;
          --text-muted: #6b7280;
          --accent: #1d4ed8;
          --accent-hover: #1e40af;
          --accent-light: rgba(29, 78, 216, 0.08);
          --navy: #07172f;
          --font-sans: 'IBM Plex Sans', system-ui, sans-serif;
        }

        body { font-family: var(--font-sans); -webkit-font-smoothing: antialiased; }

        /* Desktop Layout */
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
          z-index: 10;
        }

        .sidebar-scrollable-area {
          flex: 1;
          display: flex;
          flex-direction: column;
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
          color: #475569;
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
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
          font-weight: 600;
          border-left: 2px solid #60a5fa;
          padding-left: calc(0.85rem - 2px);
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
          flex-shrink: 0;
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
          background: #1d4ed8;
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
          padding: 0.6rem 0.85rem;
          border: 1px solid rgba(239, 68, 68, 0.35);
          border-radius: 8px;
          background: rgba(239, 68, 68, 0.1);
          color: #fca5a5;
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: all 0.15s ease;
          font-family: inherit;
        }

        .btn-signout:hover {
          background: #dc2626;
          color: #ffffff;
          border-color: #dc2626;
        }

        /* Mobile-only elements (hidden by default on desktop) */
        .mobile-topbar {
          display: none;
        }
        .sidebar-backdrop {
          display: none;
        }
        .sidebar-mobile-close-row {
          display: none;
        }

        /* ── RESPONSIVE MOBILE NAVIGATION (Phone Screens) ── */
        @media (max-width: 768px) {
          .dash-layout {
            flex-direction: column;
            min-height: 100vh;
            width: 100%;
          }

          /* Mobile Sticky Top Header Bar */
          .mobile-topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 58px;
            padding: 0 0.85rem;
            background: var(--navy);
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            position: sticky;
            top: 0;
            left: 0;
            right: 0;
            width: 100%;
            z-index: 990;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
            box-sizing: border-box;
          }

          .mobile-brand {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            min-width: 0;
          }

          .mobile-logo-img {
            height: 30px;
            width: auto;
            object-fit: contain;
            flex-shrink: 0;
          }

          .mobile-brand-title {
            font-size: 0.8125rem;
            font-weight: 600;
            color: #ffffff;
            letter-spacing: -0.01em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .mobile-topbar-actions {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            flex-shrink: 0;
          }

          /* Sign Out button directly visible on mobile topbar */
          .mobile-header-signout {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            padding: 0.38rem 0.65rem;
            background: rgba(239, 68, 68, 0.14);
            border: 1px solid rgba(239, 68, 68, 0.4);
            border-radius: 6px;
            color: #fca5a5;
            font-size: 0.75rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
            font-family: inherit;
          }

          .mobile-header-signout:hover,
          .mobile-header-signout:active {
            background: #dc2626;
            color: #ffffff;
            border-color: #dc2626;
          }

          /* Hamburger Icon Button */
          .hamburger-btn {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            width: 36px;
            height: 36px;
            padding: 9px 7px;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            box-sizing: border-box;
          }

          .hamburger-btn:hover,
          .hamburger-btn:focus-visible {
            background: rgba(255, 255, 255, 0.16);
            outline: none;
          }

          .hamburger-line {
            width: 100%;
            height: 2px;
            background-color: #ffffff;
            border-radius: 2px;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            transform-origin: center;
          }

          .hamburger-btn.is-active .hamburger-line:nth-child(1) {
            transform: translateY(6px) rotate(45deg);
          }

          .hamburger-btn.is-active .hamburger-line:nth-child(2) {
            opacity: 0;
            transform: scaleX(0);
          }

          .hamburger-btn.is-active .hamburger-line:nth-child(3) {
            transform: translateY(-6px) rotate(-45deg);
          }

          /* Backdrop Dim Overlay */
          .sidebar-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(7, 23, 47, 0.65);
            backdrop-filter: blur(2px);
            -webkit-backdrop-filter: blur(2px);
            z-index: 1040;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.25s ease;
          }

          .sidebar-backdrop.open {
            opacity: 1;
            pointer-events: auto;
          }

          /* Pop-Out Right Drawer Navigation */
          .sidebar {
            position: fixed;
            top: 0;
            right: 0;
            bottom: 0;
            left: auto;
            width: 290px;
            max-width: 86vw;
            height: 100vh;
            height: 100dvh;
            max-height: 100dvh;
            z-index: 1050;
            transform: translateX(100%);
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease;
            box-shadow: none;
            visibility: hidden;
            pointer-events: none;
            border-right: none;
            border-left: 1px solid rgba(255, 255, 255, 0.1);
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            padding: 1.25rem 1rem max(1rem, env(safe-area-inset-bottom));
          }

          .sidebar.mobile-open {
            transform: translateX(0);
            box-shadow: -8px 0 32px rgba(0, 0, 0, 0.5);
            visibility: visible;
            pointer-events: auto;
          }

          /* Pop-Out Header with Close Button */
          .sidebar-mobile-close-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 0.75rem;
            margin-bottom: 0.75rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            flex-shrink: 0;
          }

          .mobile-drawer-label {
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #94a3b8;
          }

          .sidebar-close-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #cbd5e1;
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .sidebar-close-btn:hover {
            background: rgba(255, 255, 255, 0.16);
            color: #ffffff;
          }

          .sidebar-scrollable-area {
            flex: 1;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            padding-right: 0.25rem;
            margin-bottom: 0.5rem;
          }

          /* Sticky pinned footer inside drawer */
          .sidebar-footer {
            flex-shrink: 0;
            position: sticky;
            bottom: 0;
            background: var(--navy);
            border-top: 1px solid rgba(255, 255, 255, 0.12);
            padding-top: 0.85rem;
            padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
            box-shadow: 0 -8px 16px rgba(7, 23, 47, 0.95);
          }
        }
      `}</style>

      {/* Mobile Top Header Bar with Hamburger Button and Visible Sign Out */}
      <header className="mobile-topbar">
        <div className="mobile-brand">
          <img
            src="/vidlogo.png"
            alt="Vidyalankar Logo"
            className="mobile-logo-img"
          />
          <span className="mobile-brand-title">Supercomputer Portal</span>
        </div>

        <div className="mobile-topbar-actions">
          <button
            id="mobile-header-signout-btn"
            className="mobile-header-signout"
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            title="Sign Out"
            type="button"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign Out</span>
          </button>

          <button
            className={`hamburger-btn ${isOpen ? "is-active" : ""}`}
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isOpen}
            type="button"
          >
            <span className="hamburger-line" />
            <span className="hamburger-line" />
            <span className="hamburger-line" />
          </button>
        </div>
      </header>

      {/* Pop-Out Backdrop Overlay */}
      <div
        className={`sidebar-backdrop ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Navigation Pop-Out Drawer (from the right on mobile) */}
      <aside className={`sidebar ${isOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-mobile-close-row">
          <span className="mobile-drawer-label">Navigation</span>
          <button
            className="sidebar-close-btn"
            onClick={() => setIsOpen(false)}
            aria-label="Close navigation"
            type="button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable Nav Area */}
        <div className="sidebar-scrollable-area">
          <div className="brand-header">
            <VidyalankarLogo />
            <span className="brand-sub">Supercomputer Portal</span>
          </div>

          <nav className="nav-menu">
            <Link
              href="/dashboard"
              className={`nav-link ${isActive("/dashboard") ? "active" : ""}`}
              onClick={() => setIsOpen(false)}
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
              onClick={() => setIsOpen(false)}
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
                  onClick={() => setIsOpen(false)}
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
                  onClick={() => setIsOpen(false)}
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
                  onClick={() => setIsOpen(false)}
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
                  onClick={() => setIsOpen(false)}
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
        </div>

        {/* Pinned Sticky Footer inside Popout Drawer */}
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
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
