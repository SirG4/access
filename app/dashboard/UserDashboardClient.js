"use client";

import { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";

/* ─── Helper Functions ─────────────────────────────────────────── */

function fmtTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDuration(startStr, endStr) {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const diffMs = end - start;
  if (isNaN(diffMs) || diffMs <= 0) return "0m";
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatCountdown(ms) {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
}

const STATUS_CONFIG = {
  active: { label: "Active Access", badgeBg: "#111111", bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" },
  approved: { label: "Approved", badgeBg: "#27ae60", bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" },
  pending: { label: "Pending Review", badgeBg: "#f59e0b", bg: "#fffbea", border: "#fde68a", text: "#b45309" },
  completed: { label: "Completed", badgeBg: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb", text: "#4b5563" },
  rejected: { label: "Rejected", badgeBg: "#c0392b", bg: "#fdf3f2", border: "#f5c6c2", text: "#c0392b" },
  cancelled: { label: "Cancelled", badgeBg: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb", text: "#4b5563" },
};

export default function UserDashboardClient({ session }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null); // 'ssh' | 'pwd' | 'host' | 'user'
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/requests");
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch (e) {
      console.error("Failed to fetch requests", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      const res = await fetch(`/api/requests/${cancelTarget._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (res.ok) {
        setToast("Request cancelled successfully.");
        setCancelTarget(null);
        fetchRequests();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to cancel request");
      }
    } catch (e) {
      alert("Error cancelling request");
    } finally {
      setCancelLoading(false);
    }
  };

  // Find active session
  const activeRequest = requests.find((r) => {
    if (r.status !== "active") return false;
    const start = new Date(r.startTime).getTime();
    const end = new Date(r.endTime).getTime();
    return now >= start && now <= end;
  });

  // Calculate remaining time for active session
  let activeRemainingMs = 0;
  let activeTotalMs = 1;
  let activeElapsedMs = 0;
  let activePercent = 0;

  if (activeRequest) {
    const start = new Date(activeRequest.startTime).getTime();
    const end = new Date(activeRequest.endTime).getTime();
    activeTotalMs = end - start;
    activeElapsedMs = Math.max(0, now - start);
    activeRemainingMs = Math.max(0, end - now);
    activePercent = Math.min(100, Math.max(0, (activeElapsedMs / activeTotalMs) * 100));

    // When countdown hits 0, trigger automatic refresh
    if (activeRemainingMs === 0 && activeRequest.status === "active") {
      fetchRequests();
    }
  }

  const container = activeRequest?.containerDetails || {};
  const sshHost = container.sshHost || "(IP not assigned yet)";
  const sshPort = container.sshPort || "";
  const sshUser = container.sshUser || "";
  const sshPassword = container.sshPassword || "";
  const sshCommand = sshPort
    ? `ssh ${sshUser}@${sshHost} -p ${sshPort}`
    : sshUser
    ? `ssh ${sshUser}@${sshHost}`
    : "";

  return (
    <>
      <style>{css}</style>
      <div className="dash-layout">
        {/* ── Sidebar Nav ── */}
        <aside className="sidebar">
          <div className="brand-header">
            <span className="brand-logo">⚡ Access</span>
            <span className="brand-sub">Supercomputer Portal</span>
          </div>

          <nav className="nav-menu">
            <Link href="/dashboard" className="nav-link active">
              <span className="nav-icon">🖥️</span> Active Access
            </Link>
            <Link href="/dashboard/calendar" className="nav-link">
              <span className="nav-icon">📅</span> Calendar & Booking
            </Link>
            {session.user.role === "admin" && (
              <>
                <div className="nav-group-title">Admin Management</div>
                <Link href="/admin/requests" className="nav-link">
                  <span className="nav-icon">📋</span> Review Requests
                </Link>
                <Link href="/admin/containers" className="nav-link">
                  <span className="nav-icon">🐳</span> Containers & Storage
                </Link>
                <Link href="/admin/users" className="nav-link">
                  <span className="nav-icon">👥</span> User Management
                </Link>
              </>
            )}
          </nav>

          <div className="sidebar-footer">
            <div className="user-profile">
              <div className="user-avatar">{session.user.email?.[0]?.toUpperCase() || "U"}</div>
              <div className="user-info">
                <div className="user-email" title={session.user.email}>{session.user.email}</div>
                <div className="user-role-badge">{session.user.role || "User"}</div>
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

        {/* ── Main Content Area ── */}
        <main className="main-content">
          {/* Header Bar */}
          <header className="content-header">
            <div>
              <h1 className="header-title">Supercomputer Access Portal</h1>
              <p className="header-subtitle">Manage container sessions, view active SSH credentials & track time slots.</p>
            </div>
            <div className="header-actions">
              <button className="btn-refresh" onClick={fetchRequests} disabled={loading}>
                {loading ? "Refreshing..." : "⟳ Refresh Status"}
              </button>
              <Link href="/dashboard/calendar" className="btn-book">
                + Book New Slot
              </Link>
            </div>
          </header>

          {/* Toast Notification */}
          {toast && <div className="toast-banner">✓ {toast}</div>}

          {/* ── ACTIVE SESSION CARD (PRIMARY HIGHLIGHT) ── */}
          {activeRequest ? (
            <section className="active-card-hero">
              <div className="hero-badge-row">
                <div className="live-status-pill">
                  <span className="pulse-dot" />
                  <span>SESSION ACTIVE</span>
                </div>
                <span className="hero-time-range">
                  {fmtTime(activeRequest.startTime)} → {fmtTime(activeRequest.endTime)} ({fmtDate(activeRequest.startTime)})
                </span>
              </div>

              <div className="hero-title-row">
                <div>
                  <h2 className="hero-title">{activeRequest.title || "Allocated Compute Instance"}</h2>
                  <p className="hero-purpose">{activeRequest.purpose || "Supercomputer workload allocation"}</p>
                </div>
                <div className="timer-box">
                  <div className="timer-label">TIME REMAINING</div>
                  <div className="timer-countdown">{formatCountdown(activeRemainingMs)}</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="progress-container" title={`${Math.round(activePercent)}% elapsed`}>
                <div className="progress-bar" style={{ width: `${activePercent}%` }} />
              </div>

              {/* SSH Credentials Panel */}
              <div className="credentials-panel">
                <div className="panel-title">
                  <span>🔑 Live SSH Credentials & Connection</span>
                  <span className="anywhere-badge">🌐 SSH from anywhere</span>
                </div>

                {/* IP Hero Row — prominent credential display */}
                <div className="ip-hero-row">
                  <div className="ip-hero-item">
                    <span className="ip-hero-label">PUBLIC IP / HOST</span>
                    <div className="ip-hero-value-row">
                      <span className="ip-hero-val" id="ssh-host-display">{sshHost}</span>
                      <button className="btn-icon-copy ip-copy-btn" onClick={() => handleCopy(sshHost, "host")} title="Copy IP">
                        {copiedKey === "host" ? "✓" : "📋"}
                      </button>
                    </div>
                  </div>
                  <div className="ip-hero-divider" />
                  <div className="ip-hero-item">
                    <span className="ip-hero-label">PORT</span>
                    <div className="ip-hero-value-row">
                      <span className="ip-hero-val" id="ssh-port-display">{sshPort || "—"}</span>
                      {sshPort && (
                        <button className="btn-icon-copy ip-copy-btn" onClick={() => handleCopy(String(sshPort), "port")} title="Copy Port">
                          {copiedKey === "port" ? "✓" : "📋"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="ip-hero-divider" />
                  <div className="ip-hero-item">
                    <span className="ip-hero-label">USERNAME</span>
                    <div className="ip-hero-value-row">
                      <span className="ip-hero-val" id="ssh-user-display">{sshUser || "—"}</span>
                      {sshUser && (
                        <button className="btn-icon-copy ip-copy-btn" onClick={() => handleCopy(sshUser, "user")} title="Copy Username">
                          {copiedKey === "user" ? "✓" : "📋"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="ip-hero-divider" />
                  <div className="ip-hero-item">
                    <span className="ip-hero-label">PASSWORD</span>
                    <div className="ip-hero-value-row">
                      <span className={`ip-hero-val ${!showPassword ? "pwd-font" : ""}`} id="ssh-password-display">
                        {showPassword ? sshPassword : "••••••••••••"}
                      </span>
                      <div className="pwd-btn-group">
                        <button
                          className="btn-pwd-toggle-sm"
                          onClick={() => setShowPassword(!showPassword)}
                          id="toggle-pwd-btn"
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                        {showPassword && (
                          <button className="btn-icon-copy ip-copy-btn" onClick={() => handleCopy(sshPassword, "pwd")} title="Copy Password">
                            {copiedKey === "pwd" ? "✓" : "📋"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Full SSH Command Box */}
                {sshCommand && (
                  <div className="ssh-command-box">
                    <div className="ssh-label">FULL SSH COMMAND — paste into any terminal</div>
                    <div className="ssh-input-row">
                      <code className="ssh-command" id="ssh-command-display">{sshCommand}</code>
                      <button
                        className="btn-copy"
                        onClick={() => handleCopy(sshCommand, "ssh")}
                        id="copy-ssh-btn"
                      >
                        {copiedKey === "ssh" ? "✓ Copied!" : "Copy Command"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="system-notes">
                  <div className="note-row">
                    <span>💡 <strong>Persistent Storage:</strong> Work in <code>/workspace</code> — files saved here persist across all your sessions.</span>
                  </div>
                  <div className="note-row">
                    <span>⚠️ <strong>Auto-Shutdown:</strong> At session end, this container will stop automatically. Export unsaved output files before timer expires.</span>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            /* Check if there's an upcoming approved request */
            (() => {
              const upcoming = requests.find((r) => r.status === "approved" && new Date(r.startTime) > new Date(now));
              const recentlyConcluded = requests.find((r) => r.status === "completed" || (r.status === "active" && new Date(r.endTime) < new Date(now)));

              if (upcoming) {
                return (
                  <section className="upcoming-banner">
                    <div className="banner-icon">📅</div>
                    <div className="banner-content">
                      <span className="banner-badge">NEXT SCHEDULED SESSION</span>
                      <h3 className="banner-title">{upcoming.title || "Approved Access Slot"}</h3>
                      <p className="banner-desc">
                        Starts {fmtDate(upcoming.startTime)} at {fmtTime(upcoming.startTime)} → {fmtTime(upcoming.endTime)}. SSH credentials will automatically unlock when your slot begins.
                      </p>
                    </div>
                  </section>
                );
              }

              if (recentlyConcluded) {
                return (
                  <section className="concluded-banner">
                    <div className="banner-icon">✅</div>
                    <div className="banner-content">
                      <span className="banner-badge-completed">SESSION CONCLUDED</span>
                      <h3 className="banner-title">Your latest session has ended</h3>
                      <p className="banner-desc">
                        Your container state and <code>/workspace</code> directory have been securely saved. Book a new time slot to resume work.
                      </p>
                    </div>
                    <Link href="/dashboard/calendar" className="btn-book">
                      + Book Next Session
                    </Link>
                  </section>
                );
              }

              return (
                <section className="no-access-hero">
                  <div className="no-access-icon">🖥️</div>
                  <h2>No Active Container Session</h2>
                  <p>You currently do not have an active or scheduled supercomputer access slot. Book a time slot on the interactive calendar to get instant container access.</p>
                  <Link href="/dashboard/calendar" className="btn-book-large" id="hero-book-btn">
                    + Schedule Supercomputer Slot
                  </Link>
                </section>
              );
            })()
          )}

          {/* ── ALL REQUESTS HISTORY TABLE ── */}
          <section className="history-section">
            <div className="section-header">
              <h2 className="section-title">Access Request History</h2>
              <p className="section-sub">All your past, present, and scheduled compute access reservations.</p>
            </div>

            {loading ? (
              <div className="loading-state">Loading your reservations...</div>
            ) : requests.length === 0 ? (
              <div className="empty-state">
                <p>No access requests found.</p>
                <Link href="/dashboard/calendar" className="btn-book" style={{ marginTop: "1rem" }}>
                  Book Your First Slot
                </Link>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="req-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Title & Purpose</th>
                      <th>Scheduled Slot</th>
                      <th>Duration</th>
                      <th>Access / Notes</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((req) => {
                      const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                      const isThisActive = req.status === "active" && new Date(req.startTime).getTime() <= now && new Date(req.endTime).getTime() >= now;
                      const canCancel = req.status === "pending" || (req.status === "approved" && new Date(req.startTime) > new Date(now));

                      return (
                        <tr key={req._id} className={isThisActive ? "row-active" : ""}>
                          <td>
                            <span className="status-badge" style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>
                              {isThisActive && <span className="small-pulse-dot" />}
                              {cfg.label}
                            </span>
                          </td>
                          <td>
                            <div className="td-title">{req.title || "Untitled Slot"}</div>
                            {req.purpose && <div className="td-purpose">{req.purpose}</div>}
                          </td>
                          <td>
                            <div className="td-date">{fmtDate(req.startTime)}</div>
                            <div className="td-time">
                              {fmtTime(req.startTime)} → {fmtTime(req.endTime)}
                            </div>
                          </td>
                          <td>
                            <span className="duration-pill">{fmtDuration(req.startTime, req.endTime)}</span>
                          </td>
                          <td>
                            {isThisActive && req.containerDetails ? (
                              <span className="ssh-inline-tag">
                                SSH Port {req.containerDetails.sshPort} (Running)
                              </span>
                            ) : req.status === "completed" ? (
                              <span className="completed-tag">Container Stopped (Volume Saved)</span>
                            ) : req.status === "rejected" ? (
                              <span className="rejection-tag">Reason: {req.rejectionReason || "No reason given"}</span>
                            ) : (
                              <span className="td-muted">—</span>
                            )}
                          </td>
                          <td>
                            {canCancel ? (
                              <button
                                className="btn-cancel-req"
                                onClick={() => setCancelTarget(req)}
                                id={`cancel-req-${req._id}`}
                                title="Cancel this booking request"
                              >
                                Cancel
                              </button>
                            ) : (
                              <span className="td-muted">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Cancel Confirmation Modal */}
      {cancelTarget && (
        <div className="modal-overlay" onClick={() => setCancelTarget(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Cancel Access Request?</h3>
            <p className="modal-sub">
              Are you sure you want to cancel your reservation for <strong>{cancelTarget.title || "this slot"}</strong> on {fmtDate(cancelTarget.startTime)}?
            </p>
            <div className="modal-actions">
              <button
                className="btn-modal-back"
                onClick={() => setCancelTarget(null)}
                disabled={cancelLoading}
              >
                Keep Reservation
              </button>
              <button
                className="btn-modal-cancel-confirm"
                onClick={handleConfirmCancel}
                disabled={cancelLoading}
                id="confirm-cancel-btn"
              >
                {cancelLoading ? "Cancelling..." : "Yes, Cancel Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fira+Code:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #fafafa;
    --surface: #ffffff;
    --surface-elevated: #f5f5f7;
    --surface-border: #e5e5e5;
    --text-primary: #111111;
    --text-secondary: #555555;
    --text-muted: #888888;
    --accent: #111111;
    --accent-glow: rgba(0, 0, 0, 0.05);
    --font-sans: 'Inter', system-ui, sans-serif;
    --font-mono: 'Fira Code', monospace;
  }

  body {
    background-color: var(--bg);
    color: var(--text-primary);
    font-family: var(--font-sans);
    min-height: 100vh;
  }

  .dash-layout {
    display: flex;
    min-height: 100vh;
    background-color: var(--bg);
  }

  /* ── Sidebar ── */
  .sidebar {
    width: 260px;
    background: #ffffff;
    border-right: 1px solid var(--surface-border);
    display: flex;
    flex-direction: column;
    padding: 1.5rem 1rem;
    flex-shrink: 0;
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

  /* ── Main Content Area ── */
  .main-content {
    flex: 1;
    padding: 2rem;
    overflow-y: auto;
    background-color: var(--bg);
  }

  .content-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2rem;
    gap: 1rem;
  }

  .header-title {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .header-subtitle {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .btn-refresh {
    padding: 0.55rem 0.9rem;
    border-radius: 6px;
    background: #ffffff;
    border: 1px solid var(--surface-border);
    color: var(--text-primary);
    font-weight: 500;
    font-size: 0.8125rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-refresh:hover {
    background: #f5f5f5;
  }

  .btn-book {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.55rem 1.1rem;
    border-radius: 6px;
    background: #111111;
    color: #ffffff;
    font-weight: 600;
    font-size: 0.8125rem;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .btn-book:hover {
    background: #333333;
  }

  .btn-book-large {
    display: inline-flex;
    align-items: center;
    padding: 0.8rem 1.5rem;
    border-radius: 6px;
    background: #111111;
    color: #ffffff;
    font-weight: 600;
    font-size: 0.9375rem;
    text-decoration: none;
    margin-top: 1.25rem;
    transition: all 0.15s ease;
  }

  .btn-book-large:hover {
    background: #333333;
  }

  .toast-banner {
    padding: 0.75rem 1.25rem;
    background: #f2fbf5;
    border: 1px solid #c2ebd0;
    color: #27ae60;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 1.5rem;
  }

  /* ── HERO ACTIVE ACCESS CARD ── */
  .active-card-hero {
    background: #ffffff;
    border: 1px solid var(--surface-border);
    border-left: 4px solid #111111;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    border-radius: 12px;
    padding: 1.75rem;
    margin-bottom: 2rem;
  }

  .hero-badge-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .live-status-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.85rem;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #166534;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  .pulse-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
    animation: pulse-ring 1.8s infinite;
  }

  @keyframes pulse-ring {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
    70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
  }

  .hero-time-range {
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .hero-title-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1.5rem;
    margin-bottom: 1.25rem;
  }

  .hero-title {
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .hero-purpose {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-top: 0.35rem;
  }

  .timer-box {
    text-align: right;
    background: #f8f8fa;
    padding: 0.75rem 1.25rem;
    border-radius: 8px;
    border: 1px solid var(--surface-border);
    flex-shrink: 0;
  }

  .timer-label {
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.08em;
    margin-bottom: 0.25rem;
  }

  .timer-countdown {
    font-family: var(--font-mono);
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: 0.05em;
  }

  .progress-container {
    width: 100%;
    height: 6px;
    background: #e5e5e5;
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 1.5rem;
  }

  .progress-bar {
    height: 100%;
    background: #111111;
    border-radius: 3px;
    transition: width 1s linear;
  }

  /* Credentials Panel */
  .credentials-panel {
    background: #ffffff;
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    padding: 1.25rem;
  }

  .anywhere-badge {
    margin-left: auto;
    font-size: 0.6875rem;
    font-weight: 700;
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
    border-radius: 20px;
    padding: 0.25rem 0.75rem;
    letter-spacing: 0.04em;
  }

  /* IP Hero Row */
  .ip-hero-row {
    display: flex;
    align-items: stretch;
    gap: 0;
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 8px;
    margin-bottom: 1rem;
    overflow: hidden;
  }

  .ip-hero-item {
    flex: 1;
    padding: 0.875rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 0;
  }

  .ip-hero-divider {
    width: 1px;
    background: #bae6fd;
    flex-shrink: 0;
  }

  .ip-hero-label {
    font-size: 0.625rem;
    font-weight: 700;
    color: #0369a1;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .ip-hero-value-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .ip-hero-val {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    font-weight: 700;
    color: #0c4a6e;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .panel-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .ssh-command-box {
    background: #f8f8fa;
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    padding: 0.85rem 1rem;
    margin-bottom: 1rem;
  }

  .ssh-label {
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.08em;
    margin-bottom: 0.5rem;
  }

  .ssh-input-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .ssh-command {
    font-family: var(--font-mono);
    font-size: 0.9375rem;
    color: #111111;
    font-weight: 600;
    word-break: break-all;
  }

  .btn-copy {
    padding: 0.45rem 0.85rem;
    background: #ffffff;
    border: 1px solid var(--surface-border);
    color: var(--text-primary);
    border-radius: 6px;
    font-size: 0.78125rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .btn-copy:hover {
    background: #111111;
    color: #ffffff;
    border-color: #111111;
  }

  .cred-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  .cred-item {
    background: #f8f8fa;
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    padding: 0.75rem 1rem;
  }

  .cred-item-wide {
    grid-column: span 2;
  }

  .cred-label {
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.08em;
    display: block;
    margin-bottom: 0.35rem;
  }

  .cred-value-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .cred-val {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    color: var(--text-primary);
  }

  .pwd-font {
    letter-spacing: 0.15em;
  }

  .pwd-btn-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-pwd-toggle {
    padding: 0.45rem 0.75rem;
    background: #ffffff;
    border: 1px solid var(--surface-border);
    color: var(--text-secondary);
    border-radius: 6px;
    font-size: 0.78125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-pwd-toggle-sm {
    padding: 0.2rem 0.5rem;
    background: #ffffff;
    border: 1px solid var(--surface-border);
    color: var(--text-secondary);
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-pwd-toggle:hover, .btn-pwd-toggle-sm:hover {
    color: var(--text-primary);
    background: #f5f5f5;
  }

  .btn-icon-copy {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 0.875rem;
    cursor: pointer;
    padding: 0.25rem;
  }

  .btn-icon-copy:hover {
    color: var(--text-primary);
  }

  .ip-copy-btn {
    color: #0369a1;
  }
  
  .ip-copy-btn:hover {
    color: #0c4a6e;
    background: #e0f2fe;
    border-radius: 4px;
  }

  .system-notes {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--surface-border);
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .note-row {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .note-row code {
    font-family: var(--font-mono);
    color: #111111;
    background: #f0f0f4;
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
  }

  /* ── BANNERS (UPCOMING / CONCLUDED / NO ACCESS) ── */
  .upcoming-banner,
  .concluded-banner {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 1.5rem;
    border-radius: 12px;
    background: #ffffff;
    border: 1px solid var(--surface-border);
    margin-bottom: 2rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  }

  .upcoming-banner { border-left: 4px solid #10b981; }
  .concluded-banner { border-left: 4px solid #6b7280; }

  .banner-icon {
    font-size: 2rem;
  }

  .banner-content { flex: 1; }

  .banner-badge {
    display: inline-block;
    font-size: 0.6875rem;
    font-weight: 700;
    color: #065f46;
    letter-spacing: 0.08em;
    margin-bottom: 0.25rem;
  }

  .banner-badge-completed {
    display: inline-block;
    font-size: 0.6875rem;
    font-weight: 700;
    color: #4b5563;
    letter-spacing: 0.08em;
    margin-bottom: 0.25rem;
  }

  .banner-title {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .banner-desc {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-top: 0.35rem;
  }

  .no-access-hero {
    text-align: center;
    padding: 3.5rem 2rem;
    background: #ffffff;
    border: 1px dashed var(--surface-border);
    border-radius: 12px;
    margin-bottom: 2rem;
  }

  .no-access-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .no-access-hero h2 {
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }

  .no-access-hero p {
    font-size: 0.875rem;
    color: var(--text-secondary);
    max-width: 460px;
    margin: 0 auto;
  }

  /* ── REQUEST HISTORY TABLE ── */
  .history-section {
    background: #ffffff;
    border: 1px solid var(--surface-border);
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  }

  .section-header {
    margin-bottom: 1.25rem;
  }

  .section-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .section-sub {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin-top: 0.2rem;
  }

  .table-wrapper {
    overflow-x: auto;
  }

  .req-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .req-table th {
    text-align: left;
    padding: 0.75rem 1rem;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    border-bottom: 1px solid var(--surface-border);
    background: #fafafa;
  }

  .req-table td {
    padding: 1rem;
    border-bottom: 1px solid var(--surface-border);
    vertical-align: middle;
  }

  .req-table tr:last-child td {
    border-bottom: none;
  }

  .row-active {
    background: #f0fdf4;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.65rem;
    border-radius: 16px;
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .small-pulse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #22c55e;
  }

  .td-title {
    font-weight: 600;
    color: var(--text-primary);
  }

  .td-purpose {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin-top: 0.2rem;
  }

  .td-date {
    font-weight: 500;
    color: var(--text-primary);
  }

  .td-time {
    font-size: 0.78125rem;
    color: var(--text-secondary);
  }

  .duration-pill {
    font-size: 0.75rem;
    background: #f5f5f7;
    border: 1px solid var(--surface-border);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    color: var(--text-secondary);
  }

  .ssh-inline-tag {
    font-family: var(--font-mono);
    font-size: 0.78125rem;
    color: #065f46;
    background: #d1fae5;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-weight: 500;
  }

  .completed-tag {
    font-size: 0.78125rem;
    color: var(--text-secondary);
  }

  .rejection-tag {
    font-size: 0.78125rem;
    color: #991b1b;
  }

  .td-muted {
    color: var(--text-muted);
  }

  .loading-state,
  .empty-state {
    padding: 2.5rem;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .btn-cancel-req {
    background: transparent;
    border: 1px solid #fca5a5;
    color: #c0392b;
    padding: 0.25rem 0.65rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .btn-cancel-req:hover {
    background: #fdf3f2;
    border-color: #c0392b;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
    animation: fadeIn 0.15s ease;
  }

  .modal-box {
    background: #ffffff;
    border: 1px solid var(--surface-border);
    border-radius: 12px;
    padding: 2rem;
    max-width: 460px;
    width: 100%;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.1);
  }

  .modal-title {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }

  .modal-sub {
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.5;
    margin-bottom: 1.5rem;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .btn-modal-back {
    padding: 0.5rem 1rem;
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    background: #ffffff;
    color: var(--text-primary);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-modal-back:hover { background: #f5f5f5; }

  .btn-modal-cancel-confirm {
    padding: 0.5rem 1.1rem;
    border: none;
    border-radius: 6px;
    background: #c0392b;
    color: #ffffff;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-modal-cancel-confirm:hover:not(:disabled) { background: #b91c1c; }
  .btn-modal-cancel-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
`;
