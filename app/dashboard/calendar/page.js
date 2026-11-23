"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";

/* ─── helpers ─────────────────────────────────────────────── */

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmtDate(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDay(date) {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function fmtTime(date) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtDuration(start, end) {
  const ms = new Date(end) - new Date(start);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function isoLocal(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_COLORS = {
  pending: { bg: "#fef3c7", border: "#f59e0b", text: "#92400e", badge: "#f59e0b" },
  approved: { bg: "#d1fae5", border: "#10b981", text: "#065f46", badge: "#10b981" },
  active: { bg: "#dbeafe", border: "#3b82f6", text: "#1e3a8a", badge: "#3b82f6" },
  completed: { bg: "#f3f4f6", border: "#9ca3af", text: "#374151", badge: "#9ca3af" },
  rejected: { bg: "#fee2e2", border: "#ef4444", text: "#7f1d1d", badge: "#ef4444" },
  cancelled: { bg: "#f3f4f6", border: "#d1d5db", text: "#6b7280", badge: "#d1d5db" },
};

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0-23

/* ─── collision check (client-side) ───────────────────────── */
function hasCollision(slots, start, end, excludeId = null) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return slots.some((slot) => {
    if (excludeId && slot._id === excludeId) return false;
    if (!["pending", "approved", "active"].includes(slot.status)) return false;
    const ss = new Date(slot.startTime).getTime();
    const se = new Date(slot.endTime).getTime();
    return ss < e && se > s;
  });
}

/* ─── main page ───────────────────────────────────────────── */
export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // redirect if not authed
  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  /* ── state ── */
  const [view, setView] = useState("week"); // week | day | month
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [slots, setSlots] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [loadingMy, setLoadingMy] = useState(true);
  const [modal, setModal] = useState(null); // null | { startTime, endTime }
  const [form, setForm] = useState({ title: "", purpose: "", startTime: "", endTime: "" });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const calRef = useRef(null);

  /* ── derived dates ── */
  const weekStart = startOfWeek(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  /* ── fetch slots ── */
  const fetchSlots = useCallback(async () => {
    setLoadingSlots(true);
    try {
      let start, end;
      if (view === "week") {
        start = weekDays[0].toISOString();
        end = addDays(weekDays[6], 1).toISOString();
      } else if (view === "day") {
        start = new Date(currentDate).toISOString();
        end = addDays(currentDate, 1).toISOString();
      } else {
        // month
        const ms = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const me = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        start = ms.toISOString();
        end = me.toISOString();
      }
      const res = await fetch(`/api/requests/slots?start=${start}&end=${end}`);
      if (res.ok) {
        const data = await res.json();
        setSlots(data);
      }
    } finally {
      setLoadingSlots(false);
    }
  }, [view, currentDate]); // eslint-disable-line

  const fetchMyRequests = useCallback(async () => {
    setLoadingMy(true);
    try {
      const res = await fetch("/api/requests");
      if (res.ok) {
        const data = await res.json();
        setMyRequests(data.requests || []);
      }
    } finally {
      setLoadingMy(false);
    }
  }, []);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);
  useEffect(() => { fetchMyRequests(); }, [fetchMyRequests]);
  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => { fetchSlots(); fetchMyRequests(); }, 30000);
    return () => clearInterval(id);
  }, [fetchSlots, fetchMyRequests]);

  /* ── toast ── */
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  /* ── nav ── */
  function navPrev() {
    if (view === "week") setCurrentDate(addDays(currentDate, -7));
    else if (view === "day") setCurrentDate(addDays(currentDate, -1));
    else {
      const d = new Date(currentDate);
      d.setMonth(d.getMonth() - 1);
      setCurrentDate(d);
    }
  }
  function navNext() {
    if (view === "week") setCurrentDate(addDays(currentDate, 7));
    else if (view === "day") setCurrentDate(addDays(currentDate, 1));
    else {
      const d = new Date(currentDate);
      d.setMonth(d.getMonth() + 1);
      setCurrentDate(d);
    }
  }
  function navToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setCurrentDate(d);
  }

  /* ── open modal from cell click ── */
  function openModal(dayDate, hour) {
    const start = new Date(dayDate);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(hour + 1, 0, 0, 0);
    setForm({
      title: "",
      purpose: "",
      startTime: isoLocal(start),
      endTime: isoLocal(end),
    });
    setFormError("");
    setModal(true);
  }

  function openModalEmpty() {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    const end = new Date(now);
    end.setHours(end.getHours() + 1);
    setForm({
      title: "",
      purpose: "",
      startTime: isoLocal(now),
      endTime: isoLocal(end),
    });
    setFormError("");
    setModal(true);
  }

  /* ── submit booking ── */
  async function submitBooking(e) {
    e.preventDefault();
    setFormError("");

    const start = new Date(form.startTime);
    const end = new Date(form.endTime);

    if (isNaN(start) || isNaN(end)) {
      setFormError("Please enter valid start and end times.");
      return;
    }
    if (start >= end) {
      setFormError("End time must be after start time.");
      return;
    }
    if (start < new Date()) {
      setFormError("Start time must be in the future.");
      return;
    }
    if (hasCollision(slots, start, end)) {
      setFormError(
        "⚠ This time overlaps with an existing booking. Please choose a different slot."
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title || form.purpose || "Supercomputer Access",
          purpose: form.purpose,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setFormError(
            "⚠ Conflict: " + (data.error || "Time slot overlaps with an existing booking.")
          );
        } else {
          setFormError(data.error || "Failed to submit request.");
        }
        return;
      }
      setModal(null);
      showToast("Booking request submitted! Status: Pending", "success");
      fetchSlots();
      fetchMyRequests();
    } finally {
      setSubmitting(false);
    }
  }

  /* ── slot positioning for week/day grid ── */
  function getSlotsForDay(day) {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = addDays(dayStart, 1);
    return slots.filter((s) => {
      const ss = new Date(s.startTime);
      const se = new Date(s.endTime);
      return ss < dayEnd && se > dayStart;
    });
  }

  function slotTop(slot, dayDate) {
    const dayStart = new Date(dayDate);
    dayStart.setHours(0, 0, 0, 0);
    const ss = new Date(slot.startTime);
    const clampedStart = ss < dayStart ? dayStart : ss;
    return ((clampedStart - dayStart) / (24 * 3600000)) * 100;
  }

  function slotHeight(slot, dayDate) {
    const dayStart = new Date(dayDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = addDays(dayStart, 1);
    const ss = Math.max(new Date(slot.startTime), dayStart);
    const se = Math.min(new Date(slot.endTime), dayEnd);
    const pct = ((se - ss) / (24 * 3600000)) * 100;
    return Math.max(pct, 1.5); // min 1.5% visible
  }

  /* ── render ── */
  if (status === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0a0f", color: "#fff" }}>
        Loading…
      </div>
    );
  }

  const headerLabel =
    view === "week"
      ? `${fmtDate(weekDays[0])} – ${fmtDate(weekDays[6])}, ${weekDays[0].getFullYear()}`
      : view === "day"
      ? `${currentDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`
      : `${currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;

  return (
    <>
      <style>{css}</style>

      {/* ── Toast ── */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === "success" ? "✓" : "✗"} {toast.msg}
        </div>
      )}

      {/* ── Modal ── */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Book a Slot</span>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>

            <form onSubmit={submitBooking} className="modal-form">
              <div className="form-group">
                <label className="field-label" htmlFor="slot-title">
                  <span>Title</span>
                </label>
                <input
                  id="slot-title"
                  className="field-input"
                  type="text"
                  placeholder="e.g. Deep Learning Training"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="field-label" htmlFor="slot-purpose">
                  <span>Purpose</span> <span className="required">*</span>
                </label>
                <textarea
                  id="slot-purpose"
                  className="field-textarea"
                  rows={3}
                  placeholder="Describe your use case…"
                  value={form.purpose}
                  onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                  required
                />
              </div>

              <div className="field-row">
                <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                  <label className="field-label" htmlFor="slot-start-time">
                    <span>Start Time</span> <span className="required">*</span>
                  </label>
                  <input
                    id="slot-start-time"
                    className="field-input"
                    type="datetime-local"
                    value={form.startTime}
                    onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                  <label className="field-label" htmlFor="slot-end-time">
                    <span>End Time</span> <span className="required">*</span>
                  </label>
                  <input
                    id="slot-end-time"
                    className="field-input"
                    type="datetime-local"
                    value={form.endTime}
                    onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {form.startTime && form.endTime && new Date(form.startTime) < new Date(form.endTime) && (
                <div className="duration-hint">
                  <span>Duration: <strong>{fmtDuration(new Date(form.startTime), new Date(form.endTime))}</strong></span>
                  {hasCollision(slots, new Date(form.startTime), new Date(form.endTime)) && (
                    <span className="collision-pill"> ⚠ Conflict detected</span>
                  )}
                </div>
              )}

              {formError && <div className="form-error">{formError}</div>}

              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setModal(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting || (form.startTime && form.endTime && hasCollision(slots, new Date(form.startTime), new Date(form.endTime)))}
                >
                  {submitting ? "Submitting…" : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Page ── */}
      <div className="dash-layout">
        {/* ── Sidebar ── */}
        <Sidebar session={session} />

        {/* ── Main ── */}
        <main className="main-content">
          <header className="content-header">
            <div>
              <h1 className="header-title">Calendar & Booking</h1>
              <p className="header-subtitle">Reserve supercomputer compute slots and view scheduled allocations.</p>
            </div>
            <div className="header-actions">
              <button className="btn-book" onClick={openModalEmpty}>
                + Book Slot
              </button>
            </div>
          </header>

          {/* ── Toolbar ── */}
          <div className="toolbar">
            <div className="toolbar-left">
              <button className="tb-btn" onClick={navToday}>Today</button>
              <button className="tb-btn tb-icon" onClick={navPrev}>‹</button>
              <button className="tb-btn tb-icon" onClick={navNext}>›</button>
              <span className="toolbar-label">{headerLabel}</span>
            </div>
            <div className="toolbar-right">
              <div className="view-toggle">
                {["day", "week", "month"].map((v) => (
                  <button
                    key={v}
                    className={`vt-btn${view === v ? " vt-active" : ""}`}
                    onClick={() => setView(v)}
                  >
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Calendar Grid ── */}
          <div className="cal-container" ref={calRef}>
            {(view === "week" || view === "day") && (
              <WeekDayGrid
                days={view === "week" ? weekDays : [currentDate]}
                slots={slots}
                getSlotsForDay={getSlotsForDay}
                slotTop={slotTop}
                slotHeight={slotHeight}
                openModal={openModal}
                STATUS_COLORS={STATUS_COLORS}
                fmtTime={fmtTime}
              />
            )}
            {view === "month" && (
              <MonthGrid
                currentDate={currentDate}
                slots={slots}
                openModal={openModal}
                STATUS_COLORS={STATUS_COLORS}
                fmtTime={fmtTime}
                setCurrentDate={setCurrentDate}
                setView={setView}
              />
            )}
          </div>

          {/* ── Legend ── */}
          <div className="legend">
            {Object.entries(STATUS_COLORS).map(([s, c]) => (
              <span key={s} className="legend-item">
                <span className="legend-dot" style={{ background: c.badge }} />
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
            ))}
          </div>

          {/* ── My Booking Requests ── */}
          <section className="my-requests">
            <div className="section-header">
              <h2 className="section-title">My Booking Requests</h2>
              <button className="tb-btn" onClick={fetchMyRequests} disabled={loadingMy}>
                {loadingMy ? "…" : "⟳ Refresh"}
              </button>
            </div>

            {loadingMy ? (
              <div className="empty-state">Loading requests…</div>
            ) : myRequests.length === 0 ? (
              <div className="empty-state">
                No requests yet. Click an empty slot or &quot;Book Slot&quot; to get started.
              </div>
            ) : (
              <div className="req-list">
                {myRequests.map((r) => {
                  const c = STATUS_COLORS[r.status] || STATUS_COLORS.pending;
                  return (
                    <div key={r._id} className="req-card">
                      <div className="req-card-left">
                        <span className="req-badge" style={{ background: c.badge }}>
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </span>
                        <div className="req-title">{r.title || r.purpose || "Untitled"}</div>
                        {r.purpose && r.title !== r.purpose && (
                          <div className="req-purpose">{r.purpose}</div>
                        )}
                      </div>
                      <div className="req-card-right">
                        <div className="req-time">
                          {new Date(r.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                          {fmtTime(new Date(r.startTime))} → {fmtTime(new Date(r.endTime))}
                        </div>
                        <div className="req-duration">
                          {fmtDuration(r.startTime, r.endTime)} duration
                        </div>
                        {r.rejectionReason && (
                          <div className="req-reason">Reason: {r.rejectionReason}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    </>
  );
}

/* ─── Week/Day Grid ───────────────────────────────────────── */
function WeekDayGrid({ days, slots, getSlotsForDay, slotTop, slotHeight, openModal, STATUS_COLORS, fmtTime }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nowPct = (() => {
    const n = new Date();
    return ((n.getHours() * 60 + n.getMinutes()) / (24 * 60)) * 100;
  })();

  return (
    <div className="week-grid">
      {/* Header row */}
      <div className="wg-header">
        <div className="wg-time-gutter" />
        {days.map((d, i) => {
          const isToday = d.getTime() === today.getTime();
          return (
            <div key={i} className={`wg-day-header${isToday ? " wg-today-header" : ""}`}>
              <span className="wg-weekday">{fmtDay(d)}</span>
              <span className={`wg-date-num${isToday ? " wg-today-num" : ""}`}>{d.getDate()}</span>
            </div>
          );
        })}
      </div>

      {/* Scrollable body */}
      <div className="wg-body-scroll">
        <div className="wg-body">
          {/* Time gutter */}
          <div className="wg-time-gutter wg-time-col">
            {HOURS.map((h) => (
              <div key={h} className="wg-hour-label">
                {h === 0 ? "" : `${h % 12 || 12}${h < 12 ? "am" : "pm"}`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((d, di) => {
            const daySlots = getSlotsForDay(d);
            const isToday = d.getTime() === today.getTime();
            return (
              <div key={di} className={`wg-day-col${isToday ? " wg-today-col" : ""}`}>
                {/* Hour cells */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="wg-hour-cell"
                    onClick={() => {
                      const now = new Date();
                      const clickedTime = new Date(d);
                      clickedTime.setHours(h, 0, 0, 0);
                      if (clickedTime > now) openModal(d, h);
                    }}
                  />
                ))}

                {/* Current time indicator */}
                {isToday && (
                  <div className="now-line" style={{ top: `${nowPct}%` }}>
                    <span className="now-dot" />
                  </div>
                )}

                {/* Slot blocks */}
                {daySlots.map((s) => {
                  const c = STATUS_COLORS[s.status] || STATUS_COLORS.pending;
                  const top = slotTop(s, d);
                  const height = slotHeight(s, d);
                  return (
                    <div
                      key={s._id + di}
                      className="slot-block"
                      title={`${s.title || s.purpose} • ${fmtTime(new Date(s.startTime))} - ${fmtTime(new Date(s.endTime))}`}
                      style={{
                        top: `${top}%`,
                        height: `${height}%`,
                        background: c.bg,
                        borderLeft: `3px solid ${c.border}`,
                        color: c.text,
                      }}
                    >
                      <div className="slot-block-title">{s.title || s.purpose || "Slot"}</div>
                      {height > 3 && (
                        <div className="slot-block-time">
                          {fmtTime(new Date(s.startTime))}–{fmtTime(new Date(s.endTime))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Month Grid ──────────────────────────────────────────── */
function MonthGrid({ currentDate, slots, openModal, STATUS_COLORS, fmtTime, setCurrentDate, setView }) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Build 6-row grid
  const cells = [];
  const startCell = startOfWeek(firstDay);
  for (let i = 0; i < 42; i++) {
    cells.push(addDays(startCell, i));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function getSlotsForMonth(day) {
    const ds = new Date(day);
    ds.setHours(0, 0, 0, 0);
    const de = addDays(ds, 1);
    return slots.filter((s) => {
      const ss = new Date(s.startTime);
      const se = new Date(s.endTime);
      return ss < de && se > ds;
    });
  }

  return (
    <div className="month-grid">
      <div className="month-header-row">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="month-day-name">{d}</div>
        ))}
      </div>
      <div className="month-body">
        {cells.map((cell, i) => {
          const isCurrentMonth = cell.getMonth() === month;
          const isToday = cell.getTime() === today.getTime();
          const cellSlots = getSlotsForMonth(cell);
          const isPast = cell < today;
          return (
            <div
              key={i}
              className={`month-cell${isCurrentMonth ? "" : " month-cell-other"}${isToday ? " month-cell-today" : ""}${isPast ? " month-cell-past" : ""}`}
              onClick={() => {
                if (!isPast) {
                  setCurrentDate(cell);
                  setView("day");
                }
              }}
            >
              <span className={`month-num${isToday ? " month-num-today" : ""}`}>{cell.getDate()}</span>
              {cellSlots.slice(0, 3).map((s) => {
                const c = STATUS_COLORS[s.status] || STATUS_COLORS.pending;
                return (
                  <div
                    key={s._id}
                    className="month-slot-pill"
                    style={{ background: c.bg, borderLeft: `2px solid ${c.border}`, color: c.text }}
                    title={`${s.title || s.purpose} • ${fmtTime(new Date(s.startTime))}`}
                  >
                    {s.title || s.purpose || "Slot"}
                  </div>
                );
              })}
              {cellSlots.length > 3 && (
                <div className="month-more">+{cellSlots.length - 3} more</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── CSS ─────────────────────────────────────────────────── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #f4f5f7;
    --surface: #ffffff;
    --surface2: #f8f9fa;
    --surface3: #f4f5f7;
    --border: #dde1e7;
    --text: #111827;
    --text2: #374151;
    --accent: #1d4ed8;
    --accent-glow: rgba(29, 78, 216, 0.08);
    --radius: 6px;
    --font: 'IBM Plex Sans', system-ui, sans-serif;
    --font-mono: 'IBM Plex Mono', monospace;
  }

  /* ── Layout ── */
  .dash-layout {
    display: flex;
    min-height: 100vh;
    background: var(--bg);
    font-family: var(--font);
    color: var(--text);
    -webkit-font-smoothing: antialiased;
  }

  .main-content {
    flex: 1;
    padding: 2rem;
    overflow-y: auto;
    background-color: var(--bg);
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .content-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
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

  /* ── Toolbar ── */
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 1.25rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    flex-shrink: 0;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .toolbar-left, .toolbar-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .toolbar-label {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text);
    margin-left: 0.25rem;
  }
  .tb-btn {
    background: #ffffff;
    border: 1px solid var(--border);
    color: var(--text);
    font-family: var(--font);
    font-size: 0.8125rem;
    padding: 0.35rem 0.7rem;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .tb-btn:hover:not(:disabled) { background: #f5f5f5; color: var(--text); }
  .tb-btn:disabled { opacity: 0.4; cursor: default; }
  .tb-icon { font-size: 1rem; padding: 0.25rem 0.6rem; }
  .view-toggle {
    display: flex;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
    background: #ffffff;
  }
  .vt-btn {
    background: transparent;
    border: none;
    color: var(--text2);
    font-family: var(--font);
    font-size: 0.8125rem;
    padding: 0.35rem 0.75rem;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .vt-btn:hover { background: #f5f5f5; color: var(--text); }
  .vt-active { background: #1d4ed8 !important; color: #ffffff !important; font-weight: 500; }
  .btn-book {
    background: #1d4ed8;
    border: none;
    color: #ffffff;
    font-family: var(--font);
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.45rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
    letter-spacing: -0.01em;
  }
  .btn-book:hover { background: #1e40af; }

  /* ── Calendar container ── */
  .cal-container {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* ── Week/Day grid ── */
  .week-grid {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
  .wg-header {
    display: flex;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    flex-shrink: 0;
  }
  .wg-time-gutter {
    width: 56px;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
  }
  .wg-day-header {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.5rem 0;
    border-right: 1px solid var(--border);
  }
  .wg-day-header:last-child { border-right: none; }
  .wg-today-header { background: rgba(0,0,0,0.025); }
  .wg-weekday { font-size: 0.7rem; font-weight: 500; color: var(--text2); text-transform: uppercase; letter-spacing: 0.06em; }
  .wg-date-num { font-size: 1.125rem; font-weight: 600; color: var(--text); line-height: 1.3; }
  .wg-today-num {
    width: 2rem; height: 2rem;
    background: #1d4ed8;
    color: #ffffff;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.875rem;
  }

  .wg-body-scroll { flex: 1; overflow-y: auto; }
  .wg-body { display: flex; min-height: 1440px; /* 60px per hour × 24 */ position: relative; }

  .wg-time-col { position: relative; }
  .wg-hour-label {
    height: 60px;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    padding: 2px 8px 0 0;
    font-size: 0.6875rem;
    color: var(--text2);
    border-right: 1px solid var(--border);
  }

  .wg-day-col {
    flex: 1;
    position: relative;
    border-right: 1px solid var(--border);
    cursor: pointer;
  }
  .wg-day-col:last-child { border-right: none; }
  .wg-today-col { background: rgba(0,0,0,0.025); }

  .wg-hour-cell {
    height: 60px;
    border-bottom: 1px solid var(--border);
    position: relative;
    transition: background 0.1s;
  }
  .wg-hour-cell:hover { background: rgba(0,0,0,0.04); }

  /* Now line */
  .now-line {
    position: absolute;
    left: 0; right: 0;
    height: 2px;
    background: #1d4ed8;
    z-index: 5;
    pointer-events: none;
  }
  .now-dot {
    position: absolute;
    left: -4px;
    top: -4px;
    width: 10px; height: 10px;
    background: #1d4ed8;
    border-radius: 50%;
  }

  /* Slot blocks */
  .slot-block {
    position: absolute;
    left: 3px; right: 3px;
    border-radius: 5px;
    padding: 3px 5px;
    overflow: hidden;
    z-index: 2;
    font-size: 0.72rem;
    cursor: default;
    transition: filter 0.15s;
  }
  .slot-block:hover { filter: brightness(0.95); }
  .slot-block-title { font-weight: 600; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .slot-block-time { font-size: 0.65rem; opacity: 0.8; }

  /* ── Month grid ── */
  .month-grid {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
  .month-header-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .month-day-name {
    padding: 0.5rem;
    text-align: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text2);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .month-body {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    grid-template-rows: repeat(6, 1fr);
    flex: 1;
    overflow: hidden;
  }
  .month-cell {
    border-right: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    padding: 0.35rem 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 2px;
    cursor: pointer;
    transition: background 0.1s;
    min-height: 0;
    overflow: hidden;
    background: #ffffff;
  }
  .month-cell:hover { background: #f5f5f5; }
  .month-cell-other { opacity: 0.4; background: #fafafa; }
  .month-cell-past { cursor: default; }
  .month-cell-today { background: rgba(0,0,0,0.025); }
  .month-num { font-size: 0.8125rem; font-weight: 500; color: var(--text); }
  .month-num-today {
    width: 1.5rem; height: 1.5rem;
    background: #1d4ed8;
    color: #ffffff;
    border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 0.75rem;
  }
  .month-slot-pill {
    font-size: 0.65rem;
    font-weight: 500;
    padding: 1px 4px;
    border-radius: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .month-more { font-size: 0.65rem; color: var(--text2); }

  /* ── Legend ── */
  .legend {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 0.5rem 1.25rem;
    background: var(--surface);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }
  .legend-item { display: flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; color: var(--text2); }
  .legend-dot { width: 8px; height: 8px; border-radius: 50%; }

  /* ── My Requests ── */
  .my-requests {
    background: var(--surface);
    border-top: 1px solid var(--border);
    max-height: 35vh;
    overflow-y: auto;
    flex-shrink: 0;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .section-header { display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
  .section-title { font-size: 0.9375rem; font-weight: 600; color: var(--text); }
  .empty-state { font-size: 0.875rem; color: var(--text2); padding: 0.75rem 0; }
  .req-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .req-card {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.75rem 1rem;
    transition: border-color 0.15s;
  }
  .req-card:hover { border-color: #111111; }
  .req-card-left { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; min-width: 0; }
  .req-card-right { display: flex; flex-direction: column; gap: 0.25rem; align-items: flex-end; flex-shrink: 0; }
  .req-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 99px;
    color: #ffffff;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    align-self: flex-start;
  }
  .req-title { font-size: 0.875rem; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .req-purpose { font-size: 0.8rem; color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .req-time { font-size: 0.8rem; color: var(--text2); white-space: nowrap; }
  .req-duration { font-size: 0.75rem; color: var(--text2); }
  .req-reason { font-size: 0.75rem; color: #c0392b; }

  /* ── Modal ── */
  .modal-overlay {
    position: fixed; inset: 0;
    background: rgba(7, 23, 47, 0.65);
    display: flex; align-items: center; justify-content: center;
    z-index: 400;
    padding: 1.5rem;
    animation: fadeIn 0.15s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal-box {
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 8px;
    width: 100%;
    max-width: 520px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.16);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border);
    background: #ffffff;
  }
  .modal-title { font-size: 1.125rem; font-weight: 600; color: var(--text); letter-spacing: -0.01em; }
  .modal-close {
    background: none; border: none; color: var(--text2); cursor: pointer;
    font-size: 1.25rem; line-height: 1; padding: 0.25rem;
    display: flex; align-items: center; justify-content: center;
    border-radius: 4px;
    transition: color 0.1s, background 0.1s;
  }
  .modal-close:hover { color: var(--text); background: var(--surface2); }
  .modal-form { display: flex; flex-direction: column; gap: 1.15rem; padding: 1.5rem; }
  .form-group { display: flex; flex-direction: column; gap: 0.4rem; min-width: 0; }
  .field-label { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.8125rem; font-weight: 500; color: var(--text); }
  .required { color: #dc2626; font-weight: 700; margin-left: 0.15rem; }
  .field-input, .field-textarea {
    box-sizing: border-box;
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    font-family: var(--font);
    font-size: 0.875rem;
    padding: 0.55rem 0.75rem;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    width: 100%;
    max-width: 100%;
  }
  .field-input:focus, .field-textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
  .field-textarea { resize: vertical; min-height: 80px; line-height: 1.4; }
  .field-row { display: flex; gap: 1rem; align-items: flex-start; }
  .duration-hint {
    font-size: 0.8125rem;
    color: var(--text2);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.65rem;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  .duration-hint strong { color: var(--text); }
  .collision-pill {
    display: inline-flex;
    align-items: center;
    background: #fef3c7;
    color: #92400e;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid #fde68a;
  }
  .form-error {
    background: #fdf3f2;
    border: 1px solid #f5c6cb;
    border-radius: 6px;
    color: #c0392b;
    font-size: 0.8125rem;
    padding: 0.6rem 0.75rem;
    line-height: 1.4;
  }
  .modal-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    align-items: center;
    padding-top: 1rem;
    margin-top: 0.25rem;
    border-top: 1px solid var(--border);
  }
  .btn-ghost {
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    font-family: var(--font);
    font-size: 0.8125rem;
    font-weight: 500;
    padding: 0.55rem 1.1rem;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .btn-ghost:hover { background: var(--surface2); border-color: #cbd5e1; }
  .btn-primary {
    background: #1d4ed8;
    border: 1px solid transparent;
    border-radius: 6px;
    color: #ffffff;
    font-family: var(--font);
    font-size: 0.8125rem;
    font-weight: 600;
    padding: 0.55rem 1.25rem;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-primary:hover:not(:disabled) { background: #1e40af; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Toast ── */
  .toast {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    z-index: 200;
    padding: 0.75rem 1.125rem;
    border-radius: 6px;
    font-family: var(--font);
    font-size: 0.875rem;
    font-weight: 500;
    animation: toastIn 0.2s ease;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  }
  @keyframes toastIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .toast-success { background: #27ae60; color: #ffffff; }
  .toast-error { background: #c0392b; color: #ffffff; }

  /* ── Scrollbar ── */
  .wg-body-scroll::-webkit-scrollbar, .my-requests::-webkit-scrollbar { width: 6px; }
  .wg-body-scroll::-webkit-scrollbar-track, .my-requests::-webkit-scrollbar-track { background: transparent; }
  .wg-body-scroll::-webkit-scrollbar-thumb, .my-requests::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

  /* Colorscheme inputs */
  input[type="datetime-local"] { color-scheme: light; }
`;
