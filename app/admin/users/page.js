"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          .page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fafafa;
            font-family: 'Inter', system-ui, sans-serif;
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
            color: #111;
            letter-spacing: -0.01em;
            margin-bottom: 2.5rem;
          }
          .sub {
            font-size: 0.875rem;
            color: #888;
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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fafafa;
          font-family: 'Inter', system-ui, sans-serif;
          padding: 2rem 1rem;
        }

        .card {
          width: 100%;
          max-width: 780px;
          padding: 2.5rem 2rem;
          margin: 1rem auto;
          background: #ffffff;
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.03);
        }

        .header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 2.5rem;
        }

        .wordmark {
          font-size: 0.9375rem;
          font-weight: 600;
          color: #111;
          letter-spacing: -0.01em;
        }

        .nav-link {
          font-size: 0.8125rem;
          font-weight: 500;
          color: #555;
          text-decoration: none;
          padding: 0.4rem 0.8rem;
          border-radius: 6px;
          background: #fff;
          border: 1px solid #ddd;
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
          font-weight: 600;
        }

        h1 {
          font-size: 1.375rem;
          font-weight: 600;
          color: #111;
          letter-spacing: -0.02em;
          margin-bottom: 0.375rem;
        }

        .sub {
          font-size: 0.875rem;
          color: #888;
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
          color: #27ae60;
          padding: 0.5rem 0.625rem;
          background: #f2fbf5;
          border: 1px solid #c2ebd0;
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
          font-size: 0.75rem;
          font-weight: 600;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 0.75rem 0.5rem;
          border-bottom: 1px solid #e5e5e5;
        }

        td {
          padding: 0.875rem 0.5rem;
          border-bottom: 1px solid #f0f0f0;
          font-size: 0.875rem;
          color: #111;
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
          background: #f0f0f0;
          color: #666;
          padding: 0.125rem 0.375rem;
          border-radius: 4px;
        }

        .badge-role {
          display: inline-block;
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          padding: 0.175rem 0.45rem;
          border-radius: 4px;
        }

        .badge-admin {
          background: #111;
          color: #fff;
        }

        .badge-user {
          background: #eee;
          color: #555;
        }

        .provider-text {
          font-size: 0.8125rem;
          color: #777;
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
          padding: 0 0.65rem;
          border-radius: 6px;
          font-size: 0.8125rem;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s, color 0.15s;
          white-space: nowrap;
        }

        .btn-make-admin {
          background: #111;
          color: #fff;
          border: none;
        }

        .btn-make-admin:hover:not(:disabled) {
          background: #333;
        }

        .btn-demote {
          background: #fff;
          color: #444;
          border: 1px solid #ddd;
        }

        .btn-demote:hover:not(:disabled) {
          background: #f5f5f5;
          border-color: #ccc;
          color: #111;
        }

        .btn-delete {
          background: #fff;
          color: #c0392b;
          border: 1px solid #f5c6c2;
        }

        .btn-delete:hover:not(:disabled) {
          background: #fdf3f2;
          border-color: #e59993;
        }

        .btn-action:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .empty-row {
          text-align: center;
          color: #888;
          padding: 2rem 0;
          font-size: 0.875rem;
        }

        .divider {
          height: 1px;
          background: #e5e5e5;
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
          color: #888;
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
        }

        .modal-box {
          background: #ffffff;
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          padding: 2rem;
          max-width: 460px;
          width: 100%;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.1);
        }

        .modal-title {
          font-size: 1.15rem;
          font-weight: 700;
          color: #111;
          margin-bottom: 0.5rem;
        }

        .modal-sub {
          font-size: 0.875rem;
          color: #666;
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
          border: 1px solid #e5e5e5;
          border-radius: 6px;
          background: #ffffff;
          color: #111;
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-modal-back:hover { background: #f5f5f5; }

        .btn-modal-delete-confirm {
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
        .btn-modal-delete-confirm:hover:not(:disabled) { background: #a93226; }
        .btn-modal-delete-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <div className="page">
        <div className="card">
          <div className="header-row">
            <p className="wordmark">Access</p>
            <div className="header-nav" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Link href="/admin/requests" className="nav-link">
                Requests
              </Link>
              <Link href="/admin/containers" className="nav-link">
                Containers
              </Link>
              <Link href="/admin/audit-logs" className="nav-link">
                Audit Logs
              </Link>
              <Link href="/admin/users" className="nav-link nav-link-active">
                Users
              </Link>
              <Link href="/dashboard" className="nav-link">
                Dashboard
              </Link>
            </div>
          </div>

          <h1>User management</h1>
          <p className="sub">Manage user accounts, permissions, and roles</p>

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
            <Link href="/dashboard" className="nav-link">
              Back to dashboard
            </Link>
          </div>
        </div>
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
