"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

const ACTION_CONFIG = {
  REQUEST_CREATED: { label: "Request Created", bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" },
  REQUEST_APPROVED: { label: "Request Approved", bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
  REQUEST_REJECTED: { label: "Request Rejected", bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
  REQUEST_CANCELLED: { label: "Request Cancelled", bg: "#f9fafb", color: "#4b5563", border: "#e5e7eb" },
  SESSION_ACTIVATED: { label: "Session Activated", bg: "#f0fdf4", color: "#166534", border: "#86efac" },
  SESSION_COMPLETED: { label: "Session Completed", bg: "#f5f3ff", color: "#5b21b6", border: "#ddd6fe" },
  SESSION_FORCE_TERMINATED: { label: "Force Terminated", bg: "#fef2f2", color: "#b91c1c", border: "#fca5a5" },
  CONTAINER_FORCE_STARTED: { label: "Container Started", bg: "#eff6ff", color: "#1e40af", border: "#93c5fd" },
  CONTAINER_FORCE_STOPPED: { label: "Container Stopped", bg: "#fffbea", color: "#b45309", border: "#fde68a" },
  CONTAINER_DELETED: { label: "Container & Vol Deleted", bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
  SYSTEM_SYNC_RECOVERY: { label: "Recovery Sync", bg: "#f0fdfa", color: "#0f766e", border: "#99f6e4" },
};

function ActionBadge({ action }) {
  const cfg = ACTION_CONFIG[action] || {
    label: action,
    bg: "#f3f4f6",
    color: "#374151",
    border: "#d1d5db",
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "0.2rem 0.55rem",
        borderRadius: "6px",
        fontSize: "0.72rem",
        fontWeight: 600,
        letterSpacing: "0.02em",
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {cfg.label}
    </span>
  );
}

export default function AdminAuditLogsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [page, setPage] = useState(1);

  // Auth guard
  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
    else if (status === "authenticated" && session?.user?.role !== "admin")
      router.push("/dashboard");
  }, [status, session, router]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = `/api/admin/audit-logs?page=${page}&limit=25${
        filterAction !== "all" ? `&action=${filterAction}` : ""
      }`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError("Failed to load audit logs: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filterAction]);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "admin") {
      fetchLogs();
    }
  }, [status, session, fetchLogs]);

  return (
    <>
      <style>{styles}</style>
      <div className="page">
        <div className="container">
          {/* Header */}
          <div className="page-header">
            <div>
              <p className="wordmark">Access</p>
              <h1>Audit & Security Logs</h1>
              <p className="sub">
                Immutable chronological log of administrative and system events
              </p>
            </div>
            <div className="header-nav">
              <Link href="/admin/requests" className="nav-link">
                Requests
              </Link>
              <Link href="/admin/containers" className="nav-link">
                Containers
              </Link>
              <Link href="/admin/audit-logs" className="nav-link nav-link-active">
                Audit Logs
              </Link>
              <Link href="/admin/users" className="nav-link">
                Users
              </Link>
              <Link href="/dashboard" className="nav-link">
                Dashboard
              </Link>
            </div>
          </div>

          {/* Filters & Actions */}
          <div className="filter-bar">
            <div className="filter-group">
              <label htmlFor="action-select">Filter Event:</label>
              <select
                id="action-select"
                value={filterAction}
                onChange={(e) => {
                  setFilterAction(e.target.value);
                  setPage(1);
                }}
                className="select-input"
              >
                <option value="all">All Events</option>
                <option value="REQUEST_CREATED">Request Created</option>
                <option value="REQUEST_APPROVED">Request Approved</option>
                <option value="REQUEST_REJECTED">Request Rejected</option>
                <option value="REQUEST_CANCELLED">Request Cancelled</option>
                <option value="SESSION_ACTIVATED">Session Activated</option>
                <option value="SESSION_COMPLETED">Session Completed</option>
                <option value="SESSION_FORCE_TERMINATED">Force Terminated</option>
                <option value="CONTAINER_FORCE_STARTED">Container Started</option>
                <option value="CONTAINER_FORCE_STOPPED">Container Stopped</option>
                <option value="CONTAINER_DELETED">Container & Volume Deleted</option>
                <option value="SYSTEM_SYNC_RECOVERY">Recovery Sync</option>
              </select>
            </div>

            <button
              onClick={fetchLogs}
              className="btn-refresh"
              type="button"
              id="refresh-logs-btn"
            >
              ↻ Refresh Logs
            </button>
          </div>

          {error && (
            <div className="error-banner">
              <span>⚠ {error}</span>
            </div>
          )}

          {/* Table */}
          <div className="table-card">
            {loading ? (
              <div className="empty-state">
                <p>Loading audit logs…</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="empty-state">
                <p className="empty-icon">📜</p>
                <p className="empty-title">No audit records found</p>
                <p className="empty-sub">
                  Events will appear here as users and admins perform actions.
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="audit-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Action</th>
                      <th>Performed By</th>
                      <th>Affected User</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log._id}>
                        <td className="time-cell">{formatDate(log.createdAt)}</td>
                        <td>
                          <ActionBadge action={log.action} />
                        </td>
                        <td className="actor-cell">
                          <code>{log.performedBy}</code>
                        </td>
                        <td>{log.userId?.email || "—"}</td>
                        <td className="details-cell">
                          <pre>{JSON.stringify(log.details, null, 1)}</pre>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="pagination-bar">
            <span>
              Showing {logs.length} of {total} total records
            </span>
            <div className="page-btns">
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => p - 1)}
                className="btn-page"
              >
                Previous
              </button>
              <span className="page-indicator">Page {page}</span>
              <button
                disabled={logs.length < 25 || loading}
                onClick={() => setPage((p) => p + 1)}
                className="btn-page"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #fafafa; }
  .page {
    min-height: 100vh;
    background: #fafafa;
    font-family: 'Inter', system-ui, sans-serif;
    padding: 2rem 1rem;
  }
  .container {
    max-width: 1050px;
    margin: 0 auto;
  }
  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 2rem;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .wordmark {
    font-size: 0.875rem;
    font-weight: 700;
    color: #111;
    margin-bottom: 0.35rem;
  }
  h1 {
    font-size: 1.65rem;
    font-weight: 700;
    color: #111;
    letter-spacing: -0.03em;
    margin-bottom: 0.25rem;
  }
  .sub {
    font-size: 0.875rem;
    color: #777;
  }
  .header-nav {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .nav-link {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #555;
    text-decoration: none;
    padding: 0.4rem 0.8rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: #fff;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }
  .nav-link:hover {
    background: #f5f5f5;
    border-color: #ccc;
    color: #111;
  }
  .nav-link-active {
    background: #111;
    color: #fff;
    border-color: #111;
  }
  .nav-link-active:hover {
    background: #333;
    color: #fff;
  }
  .filter-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.25rem;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .filter-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #444;
  }
  .select-input {
    padding: 0.4rem 0.75rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: #fff;
    font-family: inherit;
    font-size: 0.8125rem;
    color: #111;
    outline: none;
  }
  .btn-refresh {
    padding: 0.4rem 0.875rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: #fff;
    font-size: 0.8125rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    color: #444;
    transition: all 0.15s;
  }
  .btn-refresh:hover { background: #f0f0f0; color: #111; }
  .error-banner {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 10px;
    padding: 0.75rem 1rem;
    margin-bottom: 1.25rem;
    font-size: 0.875rem;
    color: #991b1b;
  }
  .table-card {
    background: #fff;
    border: 1px solid #e8e8e8;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0,0,0,0.03);
  }
  .table-responsive {
    overflow-x: auto;
  }
  .audit-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 0.8125rem;
  }
  .audit-table th {
    background: #fafafa;
    padding: 0.75rem 1rem;
    font-weight: 600;
    color: #666;
    border-bottom: 1px solid #eee;
    text-transform: uppercase;
    font-size: 0.7rem;
    letter-spacing: 0.05em;
  }
  .audit-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #f0f0f0;
    color: #333;
    vertical-align: top;
  }
  .audit-table tr:last-child td {
    border-bottom: none;
  }
  .audit-table tr:hover td {
    background: #fafafa;
  }
  .time-cell {
    white-space: nowrap;
    color: #666;
    font-feature-settings: "tnum";
  }
  .actor-cell code {
    background: #f1f1f5;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    font-size: 0.75rem;
    color: #333;
  }
  .details-cell pre {
    background: #f8f8fa;
    border: 1px solid #ececf1;
    border-radius: 6px;
    padding: 0.35rem 0.5rem;
    font-family: monospace;
    font-size: 0.7rem;
    color: #444;
    max-height: 90px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .empty-state {
    text-align: center;
    padding: 3rem 1.5rem;
  }
  .empty-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
  .empty-title { font-weight: 600; color: #111; margin-bottom: 0.25rem; }
  .empty-sub { font-size: 0.8125rem; color: #888; }
  .pagination-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1.25rem;
    font-size: 0.8125rem;
    color: #777;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .page-btns {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .btn-page {
    padding: 0.35rem 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: #fff;
    font-size: 0.8125rem;
    cursor: pointer;
  }
  .btn-page:disabled { opacity: 0.4; cursor: not-allowed; }
  .page-indicator { font-weight: 500; color: #333; }
`;
