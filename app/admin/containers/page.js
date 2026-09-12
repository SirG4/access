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
    hour12: true,
  });
}

function StatusBadge({ status }) {
  const isRunning = status === "running";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        padding: "0.2rem 0.65rem",
        borderRadius: 20,
        fontSize: "0.72rem",
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        background: isRunning ? "#f0fdf4" : "#f3f4f6",
        color: isRunning ? "#166534" : "#4b5563",
        border: `1px solid ${isRunning ? "#bbf7d0" : "#e5e7eb"}`,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: isRunning ? "#22c55e" : "#9ca3af",
          boxShadow: isRunning ? "0 0 6px #22c55e" : "none",
        }}
      />
      {status}
    </span>
  );
}

/* ─── Delete Confirmation Modal ─────────────────────────────────────────── */
function DeleteModal({ container, onConfirm, onClose, loading }) {
  if (!container) return null;

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
          animation: slideUp 0.2s ease;
        }
        @keyframes slideUp { from { transform: translateY(16px); opacity:0 } to { transform: translateY(0); opacity:1 } }
        .modal-title {
          font-size: 1.15rem;
          font-weight: 700;
          color: #991b1b;
          margin-bottom: 0.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .modal-body {
          font-size: 0.875rem;
          color: #444;
          line-height: 1.5;
          margin-bottom: 1.25rem;
        }
        .modal-warning {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 10px;
          padding: 0.85rem 1rem;
          font-size: 0.8125rem;
          color: #991b1b;
          margin-bottom: 1.5rem;
        }
        .modal-warning strong {
          display: block;
          margin-bottom: 0.2rem;
        }
        .modal-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
        }
        .btn-cancel {
          padding: 0.55rem 1.1rem;
          border-radius: 8px;
          border: 1px solid #ddd;
          background: #fff;
          color: #444;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
        }
        .btn-cancel:hover { background: #f5f5f5; }
        .btn-danger-confirm {
          padding: 0.55rem 1.1rem;
          border-radius: 8px;
          border: none;
          background: #dc2626;
          color: #fff;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-danger-confirm:hover { background: #b91c1c; }
        .btn-danger-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box" onClick={(e) => e.stopPropagation()}>
          <div className="modal-title">
            <span>🗑 Delete Container & Cleanup Data</span>
          </div>
          <div className="modal-body">
            Are you sure you want to remove container <strong>{container.containerName}</strong> ({container.containerId?.slice(0, 12)})?
          </div>
          <div className="modal-warning">
            <strong>⚠️ PERMANENT STORAGE DATA LOSS WARNING</strong>
            This action will permanently remove the Docker container and delete persistent volume <code>{container.volumeName || 'associated volume'}</code>. All stored user files will be unrecoverable.
          </div>
          <div className="modal-actions">
            <button className="btn-cancel" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button className="btn-danger-confirm" onClick={onConfirm} disabled={loading}>
              {loading ? "Deleting & Purging..." : "Delete & Purge Data"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AdminContainersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchContainers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/containers");
      if (res.ok) {
        const data = await res.json();
        setContainers(data);
      } else if (res.status === 401) {
        router.push("/dashboard");
      } else {
        setError("Failed to load containers list");
      }
    } catch {
      setError("An error occurred while loading containers");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    } else if (status === "authenticated") {
      if (session?.user?.role !== "admin") {
        router.push("/dashboard");
      } else {
        fetchContainers();
      }
    }
  }, [status, session, router, fetchContainers]);

  const handleToggleState = async (container) => {
    setActionLoadingId(container.id);
    setError("");

    try {
      const res = await fetch(`/api/admin/containers/${container.id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle" }),
      });
      const data = await res.json();

      if (res.ok) {
        showToast(`Container ${container.containerName} is now ${data.status}`);
        setContainers((prev) =>
          prev.map((c) => (c.id === container.id ? { ...c, status: data.status } : c))
        );
      } else {
        setError(data.error || "Failed to toggle container state");
      }
    } catch {
      setError("Failed to communicate with container toggle API");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/containers/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (res.ok) {
        showToast(`Container and storage volume permanently deleted`);
        setContainers((prev) => prev.filter((c) => c.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        setError(data.error || "Failed to delete container and volume");
      }
    } catch {
      setError("Error calling container cleanup API");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filter & Search Logic
  const runningCount = containers.filter((c) => c.status === "running").length;
  const stoppedCount = containers.filter((c) => c.status !== "running").length;

  const filtered = containers.filter((c) => {
    if (activeTab === "running" && c.status !== "running") return false;
    if (activeTab === "stopped" && c.status === "running") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.containerName?.toLowerCase().includes(q);
      const matchId = c.containerId?.toLowerCase().includes(q);
      const matchEmail = c.user?.email?.toLowerCase().includes(q);
      const matchVol = c.volumeName?.toLowerCase().includes(q);
      const matchPort = String(c.sshPort || "").includes(q);
      return matchName || matchId || matchEmail || matchVol || matchPort;
    }
    return true;
  });

  if (status === "loading" || (loading && containers.length === 0)) {
    return (
      <>
        <style>{pageStyles}</style>
        <div className="page">
          <div className="container" style={{ textAlign: "center", paddingTop: "5rem" }}>
            <p className="wordmark">Access</p>
            <p className="sub" style={{ marginTop: "1rem" }}>Loading Containers & Storage dashboard…</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{pageStyles}</style>

      {toast && (
        <div className={`toast toast-${toast.type}`} role="status">
          {toast.msg}
        </div>
      )}

      {deleteTarget && (
        <DeleteModal
          container={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}

      <div className="page">
        <div className="container">
          {/* Header */}
          <div className="page-header">
            <div>
              <p className="wordmark">Access</p>
              <h1>Containers & Storage</h1>
              <p className="sub">
                Manage host Docker containers, allocated SSH ports, and persistent storage volumes
              </p>
            </div>
            <div className="header-nav">
              <Link href="/admin/requests" className="nav-link">
                Requests
              </Link>
              <Link href="/admin/containers" className="nav-link nav-link-active">
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

          {/* Stats Row */}
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">Total Containers</span>
              <span className="stat-val">{containers.length}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Running Containers</span>
              <span className="stat-val text-green">{runningCount}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Stopped Containers</span>
              <span className="stat-val text-gray">{stoppedCount}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Storage Volumes</span>
              <span className="stat-val text-purple">
                {containers.filter((c) => c.volumeName).length}
              </span>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="error-banner" role="alert">
              <span>⚠ {error}</span>
              <button onClick={() => setError("")}>×</button>
            </div>
          )}

          {/* Filters & Search Toolbar */}
          <div className="toolbar">
            <div className="tabs" role="tablist">
              <button
                className={`tab-btn ${activeTab === "all" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("all")}
                type="button"
              >
                All <span className="tab-count">{containers.length}</span>
              </button>
              <button
                className={`tab-btn ${activeTab === "running" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("running")}
                type="button"
              >
                Running <span className="tab-count tab-count-running">{runningCount}</span>
              </button>
              <button
                className={`tab-btn ${activeTab === "stopped" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("stopped")}
                type="button"
              >
                Stopped <span className="tab-count">{stoppedCount}</span>
              </button>
            </div>

            <div className="toolbar-right">
              <input
                type="text"
                className="search-input"
                placeholder="Search container, user, volume, port…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                className="btn-refresh"
                onClick={fetchContainers}
                type="button"
                id="refresh-btn"
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {/* Container List Cards */}
          <div className="container-list">
            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🐳</div>
                <p className="empty-title">No containers found</p>
                <p className="empty-sub">
                  {containers.length === 0
                    ? "No provisioned containers exist on the Docker host."
                    : "No containers match your search filters."}
                </p>
              </div>
            ) : (
              filtered.map((item) => {
                const isRunning = item.status === "running";
                const isActionLoading = actionLoadingId === item.id;

                return (
                  <div key={item.id} className="container-card">
                    <div className="card-top">
                      <div className="card-title-group">
                        <span className="card-title">{item.containerName}</span>
                        <StatusBadge status={item.status} />
                      </div>
                      <div className="card-actions">
                        <button
                          className={`btn-action ${isRunning ? "btn-stop" : "btn-start"}`}
                          onClick={() => handleToggleState(item)}
                          disabled={isActionLoading}
                        >
                          {isActionLoading
                            ? "Processing..."
                            : isRunning
                            ? "⏹ Force Stop"
                            : "▶ Force Start"}
                        </button>
                        <button
                          className="btn-action btn-delete"
                          onClick={() => setDeleteTarget(item)}
                          disabled={isActionLoading}
                        >
                          🗑 Delete & Cleanup
                        </button>
                      </div>
                    </div>

                    <div className="meta-grid">
                      <div className="meta-item">
                        <span className="meta-label">ASSIGNED USER</span>
                        <span className="meta-val">
                          {item.user ? item.user.email : "Unassigned / Standalone"}
                        </span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">SSH HOST & PORT</span>
                        <span className="meta-val">
                          <code>{item.sshHost}:{item.sshPort || "N/A"}</code>
                        </span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">STORAGE VOLUME</span>
                        <span className="meta-val">
                          <code>{item.volumeName || "None"}</code>
                        </span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">CONTAINER ID</span>
                        <span className="meta-val">
                          <code>{item.containerId ? item.containerId.slice(0, 12) : "N/A"}</code>
                        </span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">SLOT REQUEST</span>
                        <span className="meta-val">
                          {item.slotTitle || "Standalone"} ({item.slotStatus || "N/A"})
                        </span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">CREATED AT</span>
                        <span className="meta-val">{formatDate(item.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="footer-row">
            <span className="footer-count">
              {filtered.length} {filtered.length === 1 ? "container" : "containers"} shown
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Page Styles ───────────────────────────────────────────────────────── */
const pageStyles = `
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
    max-width: 900px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 1.75rem;
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
    letter-spacing: -0.025em;
    margin-bottom: 0.25rem;
  }

  .sub {
    font-size: 0.875rem;
    color: #666;
  }

  .header-nav {
    display: flex;
    align-items: center;
    gap: 0.5rem;
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

  /* Stats grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    margin-bottom: 1.75rem;
  }

  .stat-card {
    background: #fff;
    border: 1px solid #e5e5e5;
    border-radius: 12px;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stat-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #777;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .stat-val {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111;
  }

  .text-green { color: #166534; }
  .text-gray { color: #6b7280; }
  .text-purple { color: #6b21a8; }

  /* Error banner */
  .error-banner {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #991b1b;
    padding: 0.75rem 1rem;
    border-radius: 10px;
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .error-banner button {
    background: none;
    border: none;
    font-size: 1.2rem;
    color: #991b1b;
    cursor: pointer;
  }

  /* Toolbar */
  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
  }

  .tabs {
    display: flex;
    gap: 0.35rem;
    background: #eaeaea;
    padding: 0.25rem;
    border-radius: 10px;
  }

  .tab-btn {
    padding: 0.4rem 0.85rem;
    border-radius: 8px;
    border: none;
    background: transparent;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #666;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    transition: all 0.15s;
  }

  .tab-btn:hover { color: #111; }

  .tab-active {
    background: #fff;
    color: #111;
    box-shadow: 0 2px 6px rgba(0,0,0,0.06);
  }

  .tab-count {
    background: #ddd;
    color: #444;
    font-size: 0.6875rem;
    padding: 0.1rem 0.4rem;
    border-radius: 99px;
  }

  .tab-count-running {
    background: #bbf7d0;
    color: #166534;
  }

  .toolbar-right {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .search-input {
    padding: 0.45rem 0.8rem;
    border-radius: 8px;
    border: 1px solid #ddd;
    font-size: 0.8125rem;
    min-width: 220px;
    outline: none;
  }

  .search-input:focus {
    border-color: #999;
  }

  .btn-refresh {
    padding: 0.45rem 0.8rem;
    border-radius: 8px;
    border: 1px solid #ddd;
    background: #fff;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #444;
    cursor: pointer;
  }

  .btn-refresh:hover { background: #f5f5f5; }

  /* Container list */
  .container-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .container-card {
    background: #fff;
    border: 1px solid #e5e5e5;
    border-radius: 14px;
    padding: 1.25rem 1.4rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.03);
    transition: box-shadow 0.15s;
  }

  .container-card:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.07);
  }

  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .card-title-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .card-title {
    font-size: 1rem;
    font-weight: 700;
    color: #111;
  }

  .card-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-action {
    padding: 0.4rem 0.8rem;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s;
  }

  .btn-start {
    background: #f0fdf4;
    color: #166534;
    border-color: #bbf7d0;
  }
  .btn-start:hover:not(:disabled) { background: #dcfce7; }

  .btn-stop {
    background: #fffbea;
    color: #b45309;
    border-color: #fde68a;
  }
  .btn-stop:hover:not(:disabled) { background: #fef3c7; }

  .btn-delete {
    background: #fef2f2;
    color: #991b1b;
    border-color: #fecaca;
  }
  .btn-delete:hover:not(:disabled) { background: #fee2e2; }

  .btn-action:disabled { opacity: 0.5; cursor: not-allowed; }

  .meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.75rem 1.25rem;
    background: #fafafa;
    border-radius: 10px;
    padding: 0.85rem 1rem;
    border: 1px solid #f0f0f0;
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .meta-label {
    font-size: 0.6875rem;
    font-weight: 600;
    color: #888;
    letter-spacing: 0.03em;
  }

  .meta-val {
    font-size: 0.8125rem;
    color: #222;
    font-weight: 500;
  }

  code {
    font-family: monospace;
    background: #f0f0f0;
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    font-size: 0.8125rem;
  }

  .empty-state {
    text-align: center;
    padding: 3.5rem 1rem;
    background: #fff;
    border-radius: 14px;
    border: 1px dashed #ddd;
  }

  .empty-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
  .empty-title { font-size: 1.1rem; font-weight: 700; color: #222; }
  .empty-sub { font-size: 0.875rem; color: #777; margin-top: 0.25rem; }

  .footer-row {
    margin-top: 1.5rem;
    font-size: 0.8125rem;
    color: #777;
    text-align: right;
  }

  /* Toast */
  .toast {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    padding: 0.75rem 1.25rem;
    border-radius: 10px;
    font-size: 0.875rem;
    font-weight: 600;
    box-shadow: 0 10px 30px rgba(0,0,0,0.15);
    z-index: 999;
    animation: fadeIn 0.2s ease;
  }
  .toast-success { background: #111; color: #fff; }
  .toast-error { background: #dc2626; color: #fff; }
`;
