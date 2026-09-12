"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/* ─── helpers ─────────────────────────────────────────────────────────── */
function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function calcDuration(start, end) {
  if (!start || !end) return "—";
  const mins = Math.round((new Date(end) - new Date(start)) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const STATUS_COLORS = {
  pending: { bg: "#fffbea", color: "#b45309", border: "#fde68a" },
  approved: { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
  rejected: { bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
  active: { bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" },
  completed: { bg: "#f5f3ff", color: "#5b21b6", border: "#ddd6fe" },
  cancelled: { bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" },
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "0.2rem 0.6rem",
        borderRadius: 20,
        fontSize: "0.72rem",
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

/* ─── Reject Modal ──────────────────────────────────────────────────────── */
function RejectModal({ request, onConfirm, onClose, loading }) {
  const [reason, setReason] = useState("");

  if (!request) return null;

  return (
    <>
      <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
          animation: fadeIn 0.15s ease;
        }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        .modal-box {
          background: #fff;
          border-radius: 16px;
          padding: 2rem;
          max-width: 460px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0,0,0,0.18);
          animation: slideUp 0.2s ease;
        }
        @keyframes slideUp { from { transform: translateY(16px); opacity:0 } to { transform: translateY(0); opacity:1 } }
        .modal-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #111;
          margin-bottom: 0.4rem;
        }
        .modal-meta {
          font-size: 0.8125rem;
          color: #666;
          margin-bottom: 1.25rem;
          line-height: 1.5;
        }
        .modal-label {
          font-size: 0.8125rem;
          font-weight: 600;
          color: #444;
          margin-bottom: 0.35rem;
          display: block;
        }
        .modal-textarea {
          width: 100%;
          min-height: 90px;
          padding: 0.6rem 0.75rem;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 0.875rem;
          font-family: inherit;
          resize: vertical;
          color: #111;
          transition: border-color 0.15s;
          outline: none;
        }
        .modal-textarea:focus {
          border-color: #111;
          box-shadow: 0 0 0 3px rgba(0,0,0,0.06);
        }
        .modal-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 1.25rem;
          justify-content: flex-end;
        }
        .modal-btn-cancel {
          padding: 0.5rem 1.1rem;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: #fff;
          font-size: 0.875rem;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          color: #444;
          transition: background 0.15s;
        }
        .modal-btn-cancel:hover { background: #f5f5f5; }
        .modal-btn-reject {
          padding: 0.5rem 1.25rem;
          border: none;
          border-radius: 8px;
          background: #dc2626;
          color: #fff;
          font-size: 0.875rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: background 0.15s;
        }
        .modal-btn-reject:hover:not(:disabled) { background: #b91c1c; }
        .modal-btn-reject:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box" onClick={(e) => e.stopPropagation()}>
          <p className="modal-title">Reject Request</p>
          <p className="modal-meta">
            <strong>{request.title || request.purpose || "Untitled Request"}</strong>
            <br />
            {request.userId?.email || "Unknown user"} &middot;{" "}
            {formatDate(request.startTime)} → {formatDate(request.endTime)}
          </p>
          <label className="modal-label" htmlFor="reject-reason">
            Rejection Reason <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <textarea
            id="reject-reason"
            className="modal-textarea"
            placeholder="e.g. Maintenance window, resource unavailable…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
          <div className="modal-actions">
            <button className="modal-btn-cancel" onClick={onClose} type="button">
              Cancel
            </button>
            <button
              id="modal-confirm-reject-btn"
              className="modal-btn-reject"
              type="button"
              disabled={!reason.trim() || loading}
              onClick={() => onConfirm(reason)}
            >
              {loading ? "Rejecting…" : "Confirm Reject"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Terminate Modal ───────────────────────────────────────────────────── */
function TerminateModal({ request, onConfirm, onClose, loading }) {
  const [reason, setReason] = useState("");

  if (!request) return null;

  return (
    <>
      <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
          animation: fadeIn 0.15s ease;
        }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        .modal-box {
          background: #fff;
          border-radius: 16px;
          padding: 2rem;
          max-width: 480px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        }
        .modal-title-danger {
          font-size: 1.15rem;
          font-weight: 700;
          color: #b91c1c;
          margin-bottom: 0.4rem;
        }
      `}</style>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box" onClick={(e) => e.stopPropagation()}>
          <p className="modal-title-danger">⚡ Force Terminate Active Session</p>
          <p className="modal-meta">
            <strong>{request.title || request.purpose || "Active Session"}</strong>
            <br />
            {request.userId?.email || "Unknown user"} &middot;{" "}
            SSH Port: {request.containerDetails?.sshPort || "—"}
          </p>
          <p style={{ fontSize: "0.8125rem", color: "#666", marginBottom: "1rem" }}>
            This will immediately stop the running Docker container and mark the session completed. User storage volume will remain safely preserved.
          </p>
          <label className="modal-label" htmlFor="terminate-reason">
            Termination Reason / Notes (Optional)
          </label>
          <textarea
            id="terminate-reason"
            className="modal-textarea"
            placeholder="e.g. Maintenance emergency, resource abuse, manual admin stop…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
          <div className="modal-actions">
            <button className="modal-btn-cancel" onClick={onClose} type="button">
              Cancel
            </button>
            <button
              id="modal-confirm-terminate-btn"
              className="modal-btn-reject"
              type="button"
              disabled={loading}
              onClick={() => onConfirm(reason)}
            >
              {loading ? "Terminating…" : "Force Terminate"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Request Card ──────────────────────────────────────────────────────── */
function RequestCard({ request, onApprove, onReject, onTerminate, actionLoading }) {
  const isLoading = actionLoading === request._id;
  const canAct = request.status === "pending";
  const isActive = request.status === "active";

  return (
    <div className="req-card">
      <div className="req-header">
        <div className="req-title-row">
          <span className="req-title">
            {request.title || request.purpose || "Untitled Request"}
          </span>
          <StatusBadge status={request.status} />
        </div>
        {request.purpose && request.title && request.title !== request.purpose && (
          <p className="req-purpose">{request.purpose}</p>
        )}
      </div>

      <div className="req-meta-grid">
        <div className="req-meta-item">
          <span className="req-meta-label">Requested by</span>
          <span className="req-meta-val">
            {request.userId?.email || "Unknown"}
          </span>
        </div>
        <div className="req-meta-item">
          <span className="req-meta-label">Duration</span>
          <span className="req-meta-val">
            {calcDuration(request.startTime, request.endTime)}
          </span>
        </div>
        <div className="req-meta-item">
          <span className="req-meta-label">Start</span>
          <span className="req-meta-val">{formatDate(request.startTime)}</span>
        </div>
        <div className="req-meta-item">
          <span className="req-meta-label">End</span>
          <span className="req-meta-val">{formatDate(request.endTime)}</span>
        </div>
        <div className="req-meta-item">
          <span className="req-meta-label">Submitted</span>
          <span className="req-meta-val">{formatDate(request.createdAt)}</span>
        </div>
        {request.containerDetails?.sshPort && (
          <div className="req-meta-item">
            <span className="req-meta-label">SSH Port</span>
            <span className="req-meta-val">{request.containerDetails.sshPort}</span>
          </div>
        )}
      </div>

      {request.rejectionReason && (
        <div className="req-rejection-note">
          <span className="req-meta-label">Rejection reason:</span>{" "}
          {request.rejectionReason}
        </div>
      )}

      {request.adminNotes && (
        <div className="req-admin-note">
          <span className="req-meta-label">Admin notes:</span>{" "}
          {request.adminNotes}
        </div>
      )}

      {canAct && (
        <div className="req-actions">
          <button
            id={`approve-btn-${request._id}`}
            className="btn-approve"
            type="button"
            disabled={isLoading}
            onClick={() => onApprove(request._id)}
          >
            {isLoading ? "…" : "✓ Approve"}
          </button>
          <button
            id={`reject-btn-${request._id}`}
            className="btn-reject"
            type="button"
            disabled={isLoading}
            onClick={() => onReject(request)}
          >
            Reject
          </button>
        </div>
      )}

      {isActive && (
        <div className="req-actions">
          <button
            id={`terminate-btn-${request._id}`}
            className="btn-reject"
            type="button"
            disabled={isLoading}
            onClick={() => onTerminate(request)}
          >
            ⚡ Force Terminate Session
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
const TABS = ["all", "pending", "active", "approved", "rejected"];

export default function AdminRequestsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [activeTab, setActiveTab] = useState("pending");
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [terminateTarget, setTerminateTarget] = useState(null);
  const [terminateLoading, setTerminateLoading] = useState(false);

  /* ── auth guard ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
    else if (status === "authenticated" && session?.user?.role !== "admin")
      router.push("/dashboard");
  }, [status, session, router]);

  /* ── fetch ──────────────────────────────────────────────────────── */
  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/requests");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRequests(data);
    } catch (err) {
      setError("Failed to load requests. " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "admin") {
      fetchRequests();
    }
  }, [status, session, fetchRequests]);

  /* ── toast helper ───────────────────────────────────────────────── */
  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  /* ── approve ────────────────────────────────────────────────────── */
  async function handleApprove(id) {
    setError("");
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve");
      setRequests((prev) =>
        prev.map((r) => (r._id === id ? { ...r, status: "approved" } : r))
      );
      showToast("Request approved successfully.", "success");
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  /* ── reject ─────────────────────────────────────────────────────── */
  async function handleRejectConfirm(reason) {
    if (!rejectTarget) return;
    const id = rejectTarget._id;
    setRejectLoading(true);
    try {
      const res = await fetch(`/api/admin/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected", rejectionReason: reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject");
      setRequests((prev) =>
        prev.map((r) =>
          r._id === id
            ? { ...r, status: "rejected", rejectionReason: reason }
            : r
        )
      );
      setRejectTarget(null);
      showToast("Request rejected.", "info");
    } catch (err) {
      setError(err.message);
      setRejectTarget(null);
    } finally {
      setRejectLoading(false);
    }
  }

  /* ── force terminate active session ──────────────────────────────── */
  async function handleTerminateConfirm(reason) {
    if (!terminateTarget) return;
    const id = terminateTarget._id;
    setTerminateLoading(true);
    try {
      const res = await fetch(`/api/admin/requests/${id}/terminate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to terminate session");
      setRequests((prev) =>
        prev.map((r) => (r._id === id ? { ...r, status: "completed" } : r))
      );
      setTerminateTarget(null);
      showToast("Session force-terminated and container stopped.", "info");
    } catch (err) {
      setError(err.message);
      setTerminateTarget(null);
    } finally {
      setTerminateLoading(false);
    }
  }

  /* ── filtered list ──────────────────────────────────────────────── */
  const filtered =
    activeTab === "all"
      ? requests
      : requests.filter((r) => r.status === activeTab);

  const counts = TABS.reduce((acc, tab) => {
    acc[tab] =
      tab === "all"
        ? requests.length
        : requests.filter((r) => r.status === tab).length;
    return acc;
  }, {});

  /* ── loading / unauthenticated ──────────────────────────────────── */
  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <>
        <style>{pageStyles}</style>
        <div className="page">
          <div style={{ textAlign: "center" }}>
            <p className="wordmark">Access</p>
            <p style={{ color: "#888", fontSize: "0.875rem" }}>
              Loading requests…
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{pageStyles}</style>

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`} role="status">
          {toast.msg}
        </div>
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <RejectModal
          request={rejectTarget}
          onConfirm={handleRejectConfirm}
          onClose={() => setRejectTarget(null)}
          loading={rejectLoading}
        />
      )}

      {/* Terminate Modal */}
      {terminateTarget && (
        <TerminateModal
          request={terminateTarget}
          onConfirm={handleTerminateConfirm}
          onClose={() => setTerminateTarget(null)}
          loading={terminateLoading}
        />
      )}

      <div className="page">
        <div className="container">
          {/* Header */}
          <div className="page-header">
            <div>
              <p className="wordmark">Access</p>
              <h1>Request Review</h1>
              <p className="sub">
                Approve or reject supercomputer slot requests
              </p>
            </div>
            <div className="header-nav">
              <Link href="/admin/requests" className="nav-link nav-link-active">
                Requests
              </Link>
              <Link href="/admin/containers" className="nav-link">
                Containers
              </Link>
              <Link href="/admin/audit-logs" className="nav-link">
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

          {/* Error banner */}
          {error && (
            <div className="error-banner" role="alert">
              <span>⚠ {error}</span>
              <button onClick={() => setError("")}>×</button>
            </div>
          )}

          {/* Tabs */}
          <div className="tabs" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab}
                id={`tab-${tab}`}
                role="tab"
                aria-selected={activeTab === tab}
                className={`tab-btn ${activeTab === tab ? "tab-active" : ""}`}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                <span className={`tab-count ${tab === "pending" && counts[tab] > 0 ? "tab-count-pending" : ""}`}>
                  {counts[tab]}
                </span>
              </button>
            ))}
          </div>

          {/* Request list */}
          <div className="req-list">
            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <p className="empty-title">No {activeTab === "all" ? "" : activeTab} requests</p>
                <p className="empty-sub">
                  {activeTab === "pending"
                    ? "All caught up — no pending requests to review."
                    : `No requests with status "${activeTab}" found.`}
                </p>
              </div>
            ) : (
              filtered.map((req) => (
                <RequestCard
                  key={req._id}
                  request={req}
                  onApprove={handleApprove}
                  onReject={(r) => setRejectTarget(r)}
                  onTerminate={(r) => setTerminateTarget(r)}
                  actionLoading={actionLoading}
                />
              ))
            )}
          </div>

          <div className="footer-row">
            <span className="footer-count">
              {filtered.length} {filtered.length === 1 ? "request" : "requests"} shown
            </span>
            <button
              className="btn-refresh"
              onClick={fetchRequests}
              type="button"
              id="refresh-btn"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const pageStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body { background: #f5f5f7; }

  .page {
    min-height: 100vh;
    background: #f5f5f7;
    font-family: 'Inter', system-ui, sans-serif;
    padding: 2rem 1rem;
  }

  .container {
    max-width: 780px;
    margin: 0 auto;
  }

  /* ── header ─────────── */
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
    letter-spacing: -0.01em;
    margin-bottom: 0.5rem;
  }

  h1 {
    font-size: 1.65rem;
    font-weight: 700;
    color: #111;
    letter-spacing: -0.03em;
    line-height: 1.2;
    margin-bottom: 0.25rem;
  }

  .sub {
    font-size: 0.875rem;
    color: #888;
  }

  .header-nav {
    display: flex;
    gap: 1rem;
    align-items: center;
    padding-top: 0.25rem;
    flex-shrink: 0;
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

  /* ── error banner ───── */
  .error-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 10px;
    padding: 0.75rem 1rem;
    margin-bottom: 1.25rem;
    font-size: 0.875rem;
    color: #991b1b;
  }
  .error-banner button {
    background: none;
    border: none;
    font-size: 1.1rem;
    cursor: pointer;
    color: #991b1b;
    line-height: 1;
    padding: 0;
    margin-left: 0.5rem;
  }

  /* ── tabs ───────────── */
  .tabs {
    display: flex;
    gap: 0.25rem;
    background: #eee;
    border-radius: 10px;
    padding: 0.25rem;
    margin-bottom: 1.5rem;
    width: fit-content;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.85rem;
    border: none;
    border-radius: 8px;
    background: transparent;
    font-size: 0.8125rem;
    font-weight: 500;
    font-family: inherit;
    color: #666;
    cursor: pointer;
    transition: all 0.15s;
    text-transform: capitalize;
    white-space: nowrap;
  }

  .tab-btn:hover { color: #111; }

  .tab-active {
    background: #fff;
    color: #111;
    font-weight: 600;
    box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  }

  .tab-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    border-radius: 99px;
    font-size: 0.6875rem;
    font-weight: 700;
    background: #ddd;
    color: #555;
    padding: 0 4px;
  }

  .tab-count-pending {
    background: #fde68a;
    color: #92400e;
  }

  /* ── request list ───── */
  .req-list {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  /* ── request card ───── */
  .req-card {
    background: #fff;
    border: 1px solid #e8e8e8;
    border-radius: 14px;
    padding: 1.25rem 1.35rem;
    transition: box-shadow 0.15s;
  }

  .req-card:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.07);
  }

  .req-header {
    margin-bottom: 1rem;
  }

  .req-title-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex-wrap: wrap;
    margin-bottom: 0.25rem;
  }

  .req-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #111;
  }

  .req-purpose {
    font-size: 0.8125rem;
    color: #666;
    line-height: 1.4;
  }

  .req-meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.625rem 1rem;
    margin-bottom: 0.875rem;
  }

  .req-meta-item {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .req-meta-label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #aaa;
  }

  .req-meta-val {
    font-size: 0.8125rem;
    color: #333;
    font-weight: 500;
  }

  .req-rejection-note {
    font-size: 0.8125rem;
    color: #991b1b;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.875rem;
  }

  .req-admin-note {
    font-size: 0.8125rem;
    color: #444;
    background: #f8f8f8;
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.875rem;
  }

  .req-actions {
    display: flex;
    gap: 0.625rem;
    margin-top: 0.75rem;
    padding-top: 0.875rem;
    border-top: 1px solid #f0f0f0;
  }

  .btn-approve {
    padding: 0.45rem 1.1rem;
    border: none;
    border-radius: 8px;
    background: #111;
    color: #fff;
    font-size: 0.875rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s;
    letter-spacing: -0.01em;
  }

  .btn-approve:hover:not(:disabled) { background: #333; }
  .btn-approve:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-reject {
    padding: 0.45rem 1.1rem;
    border: 1px solid #fecaca;
    border-radius: 8px;
    background: #fff;
    color: #dc2626;
    font-size: 0.875rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-reject:hover:not(:disabled) { background: #fef2f2; border-color: #f87171; }
  .btn-reject:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── empty state ─────── */
  .empty-state {
    text-align: center;
    padding: 3.5rem 1.5rem;
    background: #fff;
    border: 1px solid #e8e8e8;
    border-radius: 14px;
  }

  .empty-icon {
    font-size: 2.5rem;
    margin-bottom: 0.875rem;
  }

  .empty-title {
    font-size: 1rem;
    font-weight: 600;
    color: #111;
    margin-bottom: 0.375rem;
    text-transform: capitalize;
  }

  .empty-sub {
    font-size: 0.875rem;
    color: #888;
  }

  /* ── footer ─────────── */
  .footer-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid #e8e8e8;
  }

  .footer-count {
    font-size: 0.8125rem;
    color: #888;
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
  .btn-refresh:hover { background: #f5f5f5; color: #111; }

  /* ── toast ───────────── */
  .toast {
    position: fixed;
    bottom: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
    padding: 0.65rem 1.25rem;
    border-radius: 99px;
    font-size: 0.875rem;
    font-weight: 500;
    font-family: 'Inter', system-ui, sans-serif;
    z-index: 2000;
    box-shadow: 0 4px 20px rgba(0,0,0,0.14);
    animation: toastIn 0.2s ease;
    white-space: nowrap;
  }
  @keyframes toastIn { from { opacity:0; transform: translateX(-50%) translateY(10px) } to { opacity:1; transform: translateX(-50%) translateY(0) } }
  .toast-success { background: #111; color: #fff; }
  .toast-info { background: #1e40af; color: #fff; }
  .toast-error { background: #dc2626; color: #fff; }
`;
