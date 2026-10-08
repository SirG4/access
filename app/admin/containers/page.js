"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/app/components/Sidebar";

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

/* ─── Real-Time SVG Sparkline / Usage Graph Component ─────────────────── */
function ResourceGraph({ title, usedGB, limitGB, percent, history = [], color = "#2563eb", unit = "GB", subtitle }) {
  const points = history.length > 0 ? history : [0];
  const width = 280;
  const height = 65;
  const padding = 6;

  const len = points.length;
  const pathD = points
    .map((val, idx) => {
      const x = padding + (idx / Math.max(1, len - 1)) * (width - padding * 2);
      const clampedVal = Math.min(100, Math.max(0, val));
      const y = height - padding - (clampedVal / 100) * (height - padding * 2);
      return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const areaD = `${pathD} L ${(width - padding).toFixed(1)} ${height} L ${padding} ${height} Z`;

  const lastVal = points[points.length - 1] || 0;
  const lastX = padding + ((points.length - 1) / Math.max(1, points.length - 1)) * (width - padding * 2);
  const lastY = height - padding - (Math.min(100, Math.max(0, lastVal)) / 100) * (height - padding * 2);

  const gradientId = `grad-${title.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div className="graph-card">
      <div className="graph-header">
        <div>
          <span className="graph-title">{title}</span>
          {subtitle && <span className="graph-sub">{subtitle}</span>}
        </div>
        <div className="graph-badge" style={{ color, borderColor: `${color}40`, backgroundColor: `${color}10` }}>
          {usedGB} / {limitGB} {unit} ({percent}%)
        </div>
      </div>
      <div className="graph-svg-container">
        <svg viewBox={`0 0 ${width} ${height}`} className="graph-svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={areaD} fill={`url(#${gradientId})`} />
          <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {len > 0 && (
            <circle cx={lastX} cy={lastY} r="3.5" fill={color} stroke="#ffffff" strokeWidth="1.5" />
          )}
        </svg>
      </div>
    </div>
  );
}

/* ─── Delete Confirmation Modal ─────────────────────────────────────────── */
function DeleteModal({ container, onConfirm, onClose, loading }) {
  if (!container) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          <span>Delete Container &amp; Cleanup Data</span>
        </div>
        <div className="modal-body">
          Are you sure you want to remove container <strong>{container.containerName}</strong> ({container.containerId?.slice(0, 12)})?
        </div>
        <div className="modal-warning">
          <strong>PERMANENT STORAGE DATA LOSS WARNING</strong>
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
  );
}

/* ─── Edit Resource Hard Limits Modal ───────────────────────────────────── */
function EditLimitsModal({ container, onSave, onClose, loading }) {
  if (!container) return null;

  const [ramGB, setRamGB] = useState(container.ramLimitGB || 8);
  const [gpuRamGB, setGpuRamGB] = useState(container.gpuRamLimitGB || 8);
  const [storageGB, setStorageGB] = useState(container.storageLimitGB || 100);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(container.id, {
      ramLimitGB: Number(ramGB),
      gpuRamLimitGB: Number(gpuRamGB),
      storageLimitGB: Number(storageGB),
    });
  };

  const applyPreset = (ram, gpu, storage) => {
    setRamGB(ram);
    setGpuRamGB(gpu);
    setStorageGB(storage);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title-blue">
          <span>Edit Container Resource Limits</span>
        </div>
        <div className="modal-body">
          Set custom hard limits for container <strong>{container.containerName}</strong> ({container.containerId?.slice(0, 12)}).
        </div>

        <form onSubmit={handleSubmit}>
          <div className="presets-row">
            <span className="preset-label">QUICK PRESETS:</span>
            <button
              type="button"
              className="btn-preset"
              onClick={() => applyPreset(8, 8, 100)}
            >
              Standard (8GB / 8GB / 100GB)
            </button>
            <button
              type="button"
              className="btn-preset"
              onClick={() => applyPreset(16, 16, 250)}
            >
              Pro (16GB / 16GB / 250GB)
            </button>
            <button
              type="button"
              className="btn-preset"
              onClick={() => applyPreset(32, 32, 500)}
            >
              Extreme (32GB / 32GB / 500GB)
            </button>
          </div>

          <div className="form-group">
            <label className="input-label">
              RAM HARD LIMIT (GB)
            </label>
            <input
              type="number"
              min="1"
              max="512"
              className="form-input"
              value={ramGB}
              onChange={(e) => setRamGB(e.target.value)}
              required
            />
            <span className="input-hint">Default is 8GB RAM per container</span>
          </div>

          <div className="form-group">
            <label className="input-label">
              GPU RAM HARD LIMIT (GB)
            </label>
            <input
              type="number"
              min="1"
              max="128"
              className="form-input"
              value={gpuRamGB}
              onChange={(e) => setGpuRamGB(e.target.value)}
              required
            />
            <span className="input-hint">Default is 8GB GPU RAM per container</span>
          </div>

          <div className="form-group">
            <label className="input-label">
              PERSISTENT STORAGE TARGET (GB)
            </label>
            <input
              type="number"
              min="1"
              max="10000"
              className="form-input"
              value={storageGB}
              onChange={(e) => setStorageGB(e.target.value)}
              required
            />
            <span className="input-hint">Usage is measured on the persistent volume; this target is not enforced as a volume quota.</span>
          </div>

          <div className="modal-actions" style={{ marginTop: "1.5rem" }}>
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary-confirm" disabled={loading}>
              {loading ? "Saving Limits..." : "Save Resource Limits"}
            </button>
          </div>
        </form>
      </div>
    </div>
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

  const [editLimitsTarget, setEditLimitsTarget] = useState(null);
  const [editLimitsLoading, setEditLimitsLoading] = useState(false);

  // Live stats state: { [containerId]: { ram, gpu, storage, timestamp } }
  const [liveStats, setLiveStats] = useState({});
  // History state: { [containerId]: { ram: number[], gpu: number[], storage: number[] } }
  const [statsHistory, setStatsHistory] = useState({});

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

  // Poll live stats for running containers
  const fetchLiveStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/containers/stats");
      if (res.ok) {
        const data = await res.json();
        setLiveStats(data);

        // Update sliding history (last 20 points)
        setStatsHistory((prevHistory) => {
          const nextHistory = { ...prevHistory };
          Object.keys(data).forEach((cId) => {
            const containerStat = data[cId];
            if (!containerStat) return;

            const existing = nextHistory[cId] || { ram: [], gpu: [], storage: [] };
            const nextRam = [...existing.ram, containerStat.ram?.usagePercent || 0].slice(-20);
            const nextGpu = [...existing.gpu, containerStat.gpu?.usagePercent || 0].slice(-20);
            const nextStorage = [...existing.storage, containerStat.storage?.usagePercent || 0].slice(-20);

            nextHistory[cId] = {
              ram: nextRam,
              gpu: nextGpu,
              storage: nextStorage,
            };
          });
          return nextHistory;
        });
      }
    } catch {
      // Silent error on background poll
    }
  }, []);

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

  // Set up 3-second live stats polling timer when running containers exist
  useEffect(() => {
    if (status !== "authenticated" || session?.user?.role !== "admin") return;

    fetchLiveStats();
    const interval = setInterval(() => {
      fetchLiveStats();
    }, 3500);

    return () => clearInterval(interval);
  }, [status, session, fetchLiveStats]);

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
        fetchLiveStats();
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

  const handleSaveLimits = async (containerId, limits) => {
    setEditLimitsLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/containers/${containerId}/limits`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(limits),
      });
      const data = await res.json();

      if (res.ok) {
        showToast(`Limits updated: RAM ${data.ramLimitGB}GB, GPU RAM ${data.gpuRamLimitGB}GB, Storage ${data.storageLimitGB}GB`);
        setContainers((prev) =>
          prev.map((c) =>
            c.id === containerId
              ? {
                  ...c,
                  ramLimitGB: data.ramLimitGB,
                  gpuRamLimitGB: data.gpuRamLimitGB,
                  storageLimitGB: data.storageLimitGB,
                }
              : c
          )
        );
        setEditLimitsTarget(null);
        fetchLiveStats();
      } else {
        setError(data.error || "Failed to update container resource limits");
      }
    } catch {
      setError("Error calling update limits API");
    } finally {
      setEditLimitsLoading(false);
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
            <p className="sub" style={{ marginTop: "1rem" }}>Loading Containers &amp; Storage dashboard…</p>
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

      {editLimitsTarget && (
        <EditLimitsModal
          container={editLimitsTarget}
          onSave={handleSaveLimits}
          onClose={() => setEditLimitsTarget(null)}
          loading={editLimitsLoading}
        />
      )}

      <div className="dash-layout">
        <Sidebar session={session} />
        <main className="main-content">
          {/* Header */}
          <header className="content-header">
            <div>
              <h1 className="header-title">Containers &amp; Live Usage Graphs</h1>
              <p className="header-subtitle">
                Monitor live RAM, GPU RAM, and persistent-volume usage, configure resource targets, and manage container volumes.
              </p>
            </div>
            <div className="header-actions">
              <button
                className="btn-refresh"
                onClick={() => { fetchContainers(); fetchLiveStats(); }}
                type="button"
                id="refresh-btn"
                disabled={loading}
              >
                {loading ? "Refreshing..." : "⟳ Refresh Live Status"}
              </button>
            </div>
          </header>

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
              <span className="stat-label">Storage Volumes (100GB Std)</span>
              <span className="stat-val text-purple">
                {containers.filter((c) => c.volumeName).length}
              </span>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
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
            </div>
          </div>

          {/* Container List Cards */}
          <div className="container-list">
            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                </div>
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

                const cId = item.containerId || item.id;
                const stat = liveStats[cId] || liveStats[cId?.slice(0, 12)] || null;
                const history = statsHistory[cId] || statsHistory[cId?.slice(0, 12)] || { ram: [], gpu: [], storage: [] };

                const ramLimitGB = item.ramLimitGB || 8;
                const gpuRamLimitGB = item.gpuRamLimitGB || 8;
                const storageLimitGB = item.storageLimitGB || 100;

                const ramUsedGB = stat?.ram?.usedGB !== undefined ? stat.ram.usedGB : 0;
                const ramPercent = stat?.ram?.usagePercent !== undefined ? stat.ram.usagePercent : 0;

                const gpuUsedGB = stat?.gpu?.usedGB !== undefined ? stat.gpu.usedGB : 0;
                const gpuPercent = stat?.gpu?.usagePercent !== undefined ? stat.gpu.usagePercent : 0;
                const gpuPresent = stat?.gpu?.gpuPresent ?? false;

                const storageUsedGB = stat?.storage?.usedGB !== undefined ? stat.storage.usedGB : 0;
                const storagePercent = stat?.storage?.usagePercent !== undefined ? stat.storage.usagePercent : 0;

                return (
                  <div key={item.id} className="container-card">
                    {/* Top Row */}
                    <div className="card-top">
                      <div className="card-title-group">
                        <span className="card-title">{item.containerName}</span>
                        <StatusBadge status={item.status} />
                      </div>
                      <div className="card-actions">
                        <button
                          className="btn-action btn-edit-limits"
                          onClick={() => setEditLimitsTarget(item)}
                        >
                          ✎ Change Limits
                        </button>
                        <button
                          className={`btn-action ${isRunning ? "btn-stop" : "btn-start"}`}
                          onClick={() => handleToggleState(item)}
                          disabled={isActionLoading}
                        >
                          {isActionLoading
                            ? "Processing..."
                            : isRunning
                            ? "Force Stop"
                            : "Force Start"}
                        </button>
                        <button
                          className="btn-action btn-delete"
                          onClick={() => setDeleteTarget(item)}
                          disabled={isActionLoading}
                        >
                          Delete &amp; Cleanup
                        </button>
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="meta-grid">
                      <div className="meta-item">
                        <span className="meta-label">ASSIGNED USER</span>
                        <span className="meta-val">
                          {item.user ? item.user.email : "Unassigned / Standalone"}
                        </span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">SSH HOST &amp; PORT</span>
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

                    {/* Configured Limits Summary Pills */}
                    <div className="limits-pills-row">
                      <div className="limit-pill">
                        <span className="pill-dot blue-dot" />
                        <span>RAM Limit: <strong>{ramLimitGB} GB</strong></span>
                      </div>
                      <div className="limit-pill">
                        <span className="pill-dot purple-dot" />
                        <span>GPU RAM Limit: <strong>{gpuRamLimitGB} GB</strong></span>
                      </div>
                      <div className="limit-pill">
                        <span className="pill-dot emerald-dot" />
                        <span>Storage Limit: <strong>{storageLimitGB} GB</strong></span>
                      </div>
                    </div>

                    {/* Live Usage Graphs Section */}
                    <div className="graphs-section">
                      <div className="graphs-section-title">
                        <span>LIVE USAGE GRAPHS</span>
                        {isRunning ? (
                          <span className="live-tag">
                            <span className="live-dot" /> REAL-TIME POLL (3s)
                          </span>
                        ) : (
                          <span className="stopped-tag">PAUSED (CONTAINER STOPPED)</span>
                        )}
                      </div>

                      {isRunning ? (
                        <div className="graphs-grid">
                          <ResourceGraph
                            title="RAM Usage"
                            usedGB={ramUsedGB}
                            limitGB={ramLimitGB}
                            percent={ramPercent}
                            history={history.ram}
                            color="#2563eb"
                          />
                          <ResourceGraph
                            title="GPU RAM Usage"
                            usedGB={gpuUsedGB}
                            limitGB={gpuRamLimitGB}
                            percent={gpuPercent}
                            history={history.gpu}
                            color="#8b5cf6"
                            subtitle={!gpuPresent ? "(No Host GPU)" : "(NVIDIA GPU)"}
                          />
                          <ResourceGraph
                            title="Storage Usage"
                            usedGB={storageUsedGB}
                            limitGB={storageLimitGB}
                            percent={storagePercent}
                            history={history.storage}
                            color="#10b981"
                            subtitle="Persistent volume; target is not enforced"
                          />
                        </div>
                      ) : (
                        <div className="graphs-offline-box">
                          Container is currently stopped. Start container to view real-time live usage graphs for RAM ({ramLimitGB}GB limit), GPU RAM ({gpuRamLimitGB}GB limit), and Storage ({storageLimitGB}GB limit).
                        </div>
                      )}
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
        </main>
      </div>
    </>
  );
}

/* ─── Page Styles ───────────────────────────────────────────────────────── */
const pageStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body { background: #fafafa; }

  .dash-layout {
    display: flex;
    min-height: 100vh;
    background-color: #fafafa;
    font-family: 'Inter', system-ui, sans-serif;
  }

  .main-content {
    flex: 1;
    padding: 2rem;
    overflow-y: auto;
    background-color: #fafafa;
  }

  .content-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.75rem;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .header-title {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #111111;
  }

  .header-subtitle {
    font-size: 0.875rem;
    color: #555555;
    margin-top: 0.25rem;
    max-width: 800px;
    line-height: 1.45;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
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
    font-size: 0.72rem;
    font-weight: 600;
    color: #777;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .stat-val {
    font-size: 1.4rem;
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
    min-width: 240px;
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
    gap: 1.25rem;
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
    font-size: 1.05rem;
    font-weight: 700;
    color: #111;
  }

  .card-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
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

  .btn-edit-limits {
    background: #eff6ff;
    color: #1d4ed8;
    border-color: #bfdbfe;
  }
  .btn-edit-limits:hover { background: #dbeafe; }

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
    margin-bottom: 1rem;
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

  /* Resource Limits Pills */
  .limits-pills-row {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 1.25rem;
  }

  .limit-pill {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 0.3rem 0.75rem;
    border-radius: 20px;
    font-size: 0.78125rem;
    color: #334155;
  }

  .pill-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .blue-dot { background: #2563eb; }
  .purple-dot { background: #8b5cf6; }
  .emerald-dot { background: #10b981; }

  /* Graphs Section */
  .graphs-section {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 1rem 1.15rem;
  }

  .graphs-section-title {
    font-size: 0.72rem;
    font-weight: 700;
    color: #475569;
    letter-spacing: 0.04em;
    margin-bottom: 0.85rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .live-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: #166534;
    background: #dcfce7;
    padding: 0.15rem 0.5rem;
    border-radius: 12px;
  }

  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 6px #22c55e;
  }

  .stopped-tag {
    font-size: 0.6875rem;
    font-weight: 600;
    color: #64748b;
    background: #f1f5f9;
    padding: 0.15rem 0.5rem;
    border-radius: 12px;
  }

  .graphs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1rem;
  }

  .graph-card {
    background: #f8fafc;
    border: 1px solid #f1f5f9;
    border-radius: 10px;
    padding: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .graph-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .graph-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #1e293b;
  }

  .graph-sub {
    font-size: 0.6875rem;
    color: #64748b;
    margin-left: 0.25rem;
  }

  .graph-badge {
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    border: 1px solid;
    white-space: nowrap;
  }

  .graph-svg-container {
    width: 100%;
    height: 65px;
  }

  .graph-svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .graphs-offline-box {
    background: #f8fafc;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
    padding: 1rem;
    font-size: 0.8125rem;
    color: #64748b;
    text-align: center;
  }

  /* Modals */
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
    padding: 1.75rem 2rem;
    max-width: 500px;
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
  }

  .modal-title-blue {
    font-size: 1.15rem;
    font-weight: 700;
    color: #1d4ed8;
    margin-bottom: 0.5rem;
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

  .presets-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin-bottom: 1.25rem;
    background: #f1f5f9;
    padding: 0.6rem;
    border-radius: 8px;
  }

  .preset-label {
    font-size: 0.6875rem;
    font-weight: 700;
    color: #475569;
    width: 100%;
    margin-bottom: 0.15rem;
  }

  .btn-preset {
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.25rem 0.55rem;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #334155;
    cursor: pointer;
  }
  .btn-preset:hover { background: #e2e8f0; }

  .form-group {
    margin-bottom: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .input-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: #334155;
    letter-spacing: 0.02em;
  }

  .form-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    font-size: 0.875rem;
    outline: none;
  }
  .form-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }

  .input-hint {
    font-size: 0.72rem;
    color: #64748b;
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

  .btn-primary-confirm {
    padding: 0.55rem 1.1rem;
    border-radius: 8px;
    border: none;
    background: #2563eb;
    color: #fff;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-primary-confirm:hover { background: #1d4ed8; }
  .btn-primary-confirm:disabled { opacity: 0.5; cursor: not-allowed; }

  .empty-state {
    text-align: center;
    padding: 3.5rem 1rem;
    background: #fff;
    border-radius: 14px;
    border: 1px dashed #ddd;
  }

  .empty-icon { display: flex; align-items: center; justify-content: center; margin-bottom: 0.5rem; }
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
  .toast-success { background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%); color: #fff; }
  .toast-error { background: #dc2626; color: #fff; }
`;
