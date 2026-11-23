"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/app/components/Sidebar";

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null); // { userId, email }
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/admin/users");
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        } else if (res.status === 401) {
          router.push("/dashboard");
        } else {
          setError("Failed to load users");
        }
      } catch (err) {
        setError("An error occurred while loading users");
      } finally {
        setLoading(false);
      }
    }

    if (status === "unauthenticated") {
      router.push("/auth/signin");
    } else if (status === "authenticated") {
      if (session?.user?.role !== "admin") {
        router.push("/dashboard");
      } else {
        fetchUsers();
      }
    }
  }, [status, session, router]);

  async function handleRoleChange(userId, newRole) {
    if (userId === session?.user?.id) {
      setError("You cannot change your own role.");
      return;
    }

    setError("");
    setSuccess("");
    setActionLoading(userId);

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();

      if (res.ok) {
        setUsers(users.map((u) => (u._id === userId ? { ...u, role: newRole } : u)));
        setSuccess(`User role updated to ${newRole}.`);
      } else {
        setError(data.error || "Failed to update role");
      }
    } catch (err) {
      setError("An error occurred while updating the role");
    } finally {
      setActionLoading(null);
    }
  }

  function triggerDeleteModal(userId, email) {
    if (userId === session?.user?.id) {
      setError("You cannot delete your own account.");
      return;
    }
    setDeleteTarget({ userId, email });
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const { userId, email } = deleteTarget;
    setError("");
    setSuccess("");
    setDeleteLoading(true);

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok) {
        setUsers(users.filter((u) => u._id !== userId));
        setSuccess(`User ${email} deleted successfully.`);
        setDeleteTarget(null);
      } else {
        setError(data.error || "Failed to delete user");
      }
    } catch (err) {
      setError("An error occurred while deleting user");
    } finally {
      setDeleteLoading(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          .page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f4f5f7;
            font-family: 'IBM Plex Sans', system-ui, sans-serif;
          }
          .card {
            width: 100%;
            max-width: 480px;
            padding: 2.5rem 2rem;
            margin: 1rem;
          }
          .wordmark {
            font-size: 0.9375rem;
            font-weight: 600;
            color: #111827;
            letter-spacing: -0.01em;
            margin-bottom: 2.5rem;
          }
          .sub {
            font-size: 0.875rem;
            color: #6b7280;
          }
        `}</style>
        <div className="page">
          <div className="card">
            <p className="wordmark">Access</p>
            <p className="sub">Loading user management…</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');

        :root {
          --bg: #f4f5f7;
          --surface: #ffffff;
          --border: #dde1e7;
          --text: #111827;
          --text2: #374151;
          --muted: #6b7280;
          --accent: #1d4ed8;
          --font: 'IBM Plex Sans', system-ui, sans-serif;
          --font-mono: 'IBM Plex Mono', monospace;
        }

        body {
          background: var(--bg);
          color: var(--text);
          font-family: var(--font);
          -webkit-font-smoothing: antialiased;
        }

        .dash-layout {
          display: flex;
          min-height: 100vh;
          background-color: var(--bg);
          font-family: var(--font);
        }

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
          flex-wrap: wrap;
        }

        .header-title {
          font-size: 1.5rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--text);
        }

        .header-subtitle {
          font-size: 0.875rem;
          color: var(--text2);
          margin-top: 0.25rem;
        }

        .surface-card {
          width: 100%;
          padding: 1.5rem;
          background: #ffffff;
          border: 1px solid var(--border);
          border-radius: 8px;
        }

        h1 {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--text);
          letter-spacing: -0.02em;
          margin-bottom: 0.375rem;
        }

        .sub {
          font-size: 0.875rem;
          color: var(--muted);
          margin-bottom: 1.5rem;
        }

        .error-msg {
          font-size: 0.8125rem;
          color: #c0392b;
          padding: 0.5rem 0.625rem;
          background: #fdf3f2;
          border: 1px solid #f5c6c2;
          border-radius: 6px;
          margin-bottom: 1.25rem;
        }

        .success-msg {
          font-size: 0.8125rem;
          color: #166534;
          padding: 0.5rem 0.625rem;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 6px;
          margin-bottom: 1.25rem;
        }

        .table-container {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        th {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 0.75rem 0.75rem;
          border-bottom: 1px solid var(--border);
          background: #f8f9fa;
        }

        td {
          padding: 0.875rem 0.75rem;
          border-bottom: 1px solid var(--border);
          font-size: 0.875rem;
          color: var(--text);
          vertical-align: middle;
        }

        tr:last-child td {
          border-bottom: none;
        }

        .user-email-cell {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .badge-self {
          font-size: 0.6875rem;
          font-weight: 500;
          background: #f1f5f9;
          color: var(--text2);
          padding: 0.125rem 0.375rem;
          border-radius: 4px;
        }

        .badge-role {
          display: inline-block;
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
        }

        .badge-admin {
          background: #eff6ff;
          color: #1e40af;
          border: 1px solid #bfdbfe;
        }

        .badge-user {
          background: #f3f4f6;
          color: #4b5563;
          border: 1px solid #e5e7eb;
        }

        .provider-text {
          font-size: 0.8125rem;
          color: var(--muted);
          text-transform: capitalize;
        }

        .actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          justify-content: flex-end;
        }

        .btn-action {
          height: 2rem;
          padding: 0 0.75rem;
          border-radius: 6px;
          font-size: 0.8125rem;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s, color 0.15s;
          white-space: nowrap;
        }

        .btn-make-admin {
          background: #1d4ed8;
          color: #fff;
          border: none;
        }

        .btn-make-admin:hover:not(:disabled) {
          background: #1e40af;
        }

        .btn-demote {
          background: #fff;
          color: var(--text);
          border: 1px solid var(--border);
        }

        .btn-demote:hover:not(:disabled) {
          background: #f8f9fa;
          color: var(--text);
        }

        .btn-delete {
          background: #fff;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        .btn-delete:hover:not(:disabled) {
          background: #fef2f2;
          border-color: #fca5a5;
        }

        .btn-action:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .empty-row {
          text-align: center;
          color: var(--muted);
          padding: 2rem 0;
          font-size: 0.875rem;
        }

        .divider {
          height: 1px;
          background: var(--border);
          margin-top: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .footer-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .user-count {
          font-size: 0.8125rem;
          color: var(--muted);
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(7, 23, 47, 0.65);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 400;
          padding: 1.5rem;
        }

        .modal-box {
          background: #ffffff;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 1.5rem;
          max-width: 460px;
          width: 100%;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.16);
        }

        .modal-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--text);
          margin-bottom: 0.5rem;
        }

        .modal-sub {
          font-size: 0.875rem;
          color: var(--text2);
          line-height: 1.5;
          margin-bottom: 1.25rem;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
        }

        .btn-modal-back {
          padding: 0.55rem 1.1rem;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: #ffffff;
          color: var(--text);
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
        }
        .btn-modal-back:hover { background: #f8f9fa; }

        .btn-modal-delete-confirm {
          padding: 0.55rem 1.1rem;
          border: none;
          border-radius: 6px;
          background: #dc2626;
          color: #ffffff;
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.15s;
        }
        .btn-modal-delete-confirm:hover:not(:disabled) { background: #b91c1c; }
        .btn-modal-delete-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <div className="dash-layout">
        <Sidebar session={session} />
        <main className="main-content">
          <header className="content-header">
            <div>
              <h1 className="header-title">User Management</h1>
              <p className="header-subtitle">Manage user accounts, permissions, and roles</p>
            </div>
          </header>

          {error && (
            <p className="error-msg" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="success-msg" role="status">
              {success}
            </p>
          )}

          <div className="surface-card">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Provider</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = u._id === session?.user?.id;
                    const isCurrentAction = actionLoading === u._id;

                    return (
                      <tr key={u._id}>
                        <td>
                          <div className="user-email-cell">
                            <span>{u.email}</span>
                            {isSelf && <span className="badge-self">You</span>}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`badge-role ${
                              u.role === "admin" ? "badge-admin" : "badge-user"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td>
                          <span className="provider-text">{u.provider}</span>
                        </td>
                        <td>
                          <div className="actions">
                            {u.role === "user" ? (
                              <button
                                id={`promote-btn-${u._id}`}
                                className="btn-action btn-make-admin"
                                type="button"
                                onClick={() => handleRoleChange(u._id, "admin")}
                                disabled={isCurrentAction}
                              >
                                Make admin
                              </button>
                            ) : (
                              <button
                                id={`demote-btn-${u._id}`}
                                className="btn-action btn-demote"
                                type="button"
                                onClick={() => handleRoleChange(u._id, "user")}
                                disabled={isSelf || isCurrentAction}
                                title={isSelf ? "Cannot demote yourself" : "Demote to user"}
                              >
                                Demote
                              </button>
                            )}
                            <button
                              id={`delete-btn-${u._id}`}
                              className="btn-action btn-delete"
                              type="button"
                              onClick={() => triggerDeleteModal(u._id, u.email)}
                              disabled={isSelf || isCurrentAction}
                              title={isSelf ? "Cannot delete yourself" : "Delete user"}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {users.length === 0 && (
                    <tr>
                      <td colSpan="4" className="empty-row">
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="divider" />

            <div className="footer-row">
              <span className="user-count">
                {users.length} {users.length === 1 ? "user" : "users"} registered
              </span>
            </div>
          </div>
        </main>
      </div>

      {/* Delete User Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Delete User Account?</h3>
            <p className="modal-sub">
              Are you sure you want to delete account <strong>{deleteTarget.email}</strong>? All associated container permissions and data will be permanently removed.
            </p>
            <div className="modal-actions">
              <button
                className="btn-modal-back"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                className="btn-modal-delete-confirm"
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                id="confirm-delete-user-btn"
              >
                {deleteLoading ? "Deleting..." : "Yes, Delete User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
