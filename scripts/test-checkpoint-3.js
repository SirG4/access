#!/usr/bin/env node
/**
 * scripts/test-checkpoint-3.js
 *
 * Automated verification for Checkpoint 3:
 *   Admin Request Review & Approval Workflow
 *
 *   Tests:
 *     [1] Admin can list all requests (GET /api/requests as admin)
 *     [2] Admin can approve a pending request (PATCH /api/admin/requests/:id)
 *     [3] Admin can reject a pending request with a reason
 *     [4] Non-admin cannot use admin PATCH endpoint (401/403 check)
 *     [5] Rejecting without a reason returns 400
 *     [6] Approving an already-approved request returns 409
 *     [7] User sees rejection reason in GET /api/requests
 *
 * Usage:
 *   1.  Start dev server:  npm run dev
 *   2.  Ensure admin and user accounts exist (run scripts/seed.js first)
 *   3.  Run:  node scripts/test-checkpoint-3.js
 *
 * Environment:
 *   TEST_BASE_URL          – defaults to http://localhost:3000
 *   TEST_ADMIN_EMAIL       – defaults to admin@example.com
 *   TEST_ADMIN_PASSWORD    – defaults to admin123
 *   TEST_USER_EMAIL        – defaults to user@example.com
 *   TEST_USER_PASSWORD     – defaults to password123
 */

const BASE            = process.env.TEST_BASE_URL       || "http://localhost:3000";
const ADMIN_EMAIL     = process.env.TEST_ADMIN_EMAIL    || "admin@example.com";
const ADMIN_PASSWORD  = process.env.TEST_ADMIN_PASSWORD || "admin123";
const USER_EMAIL      = process.env.TEST_USER_EMAIL     || "user@example.com";
const USER_PASSWORD   = process.env.TEST_USER_PASSWORD  || "password123";

let passed = 0;
let failed = 0;

/* ── helpers ──────────────────────────────────────────────────────────── */
function ok(label) { console.log(`  ✓ ${label}`); passed++; }
function fail(label, detail) {
  console.error(`  ✗ ${label}`);
  if (detail) console.error(`    → ${detail}`);
  failed++;
}

async function getCSRF(cookieStore) {
  const res = await fetch(`${BASE}/api/auth/csrf`, {
    headers: { Cookie: cookieStore.join("; ") },
  });
  const { csrfToken } = await res.json();
  const setCookies = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookies) cookieStore.push(c.split(";")[0]);
  return csrfToken;
}

async function login(email, password) {
  const cookieStore = [];
  const csrfToken   = await getCSRF(cookieStore);

  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: `${BASE}/dashboard`,
    json: "true",
  });

  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieStore.join("; "),
    },
    body: body.toString(),
    redirect: "manual",
  });

  const setCookies = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookies) cookieStore.push(c.split(";")[0]);
  return cookieStore;
}

function futureISO(offsetHours) {
  const d = new Date(Date.now() + offsetHours * 3600 * 1000);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}

/* ── main ─────────────────────────────────────────────────────────────── */
async function run() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║   Checkpoint 3 — Admin Request Review & Approval    ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  /* ── Step 0a: Login as admin ────────────────────────────────────── */
  console.log("[ 0a ] Authenticating as admin…");
  let adminCookies;
  try {
    adminCookies = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const hasSession = adminCookies.some(
      (c) => c.startsWith("next-auth.session-token") || c.startsWith("__Secure-next-auth")
    );
    if (!hasSession) throw new Error("No session cookie found — check TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD");
    ok(`Logged in as admin (${ADMIN_EMAIL})`);
  } catch (err) {
    fail("Admin login failed", err.message);
    console.log("\nTip: Run scripts/seed.js to create admin@example.com / admin123\n");
    process.exit(1);
  }

  const adminHeaders = { Cookie: adminCookies.join("; "), "Content-Type": "application/json" };

  /* ── Step 0b: Login as normal user ─────────────────────────────── */
  console.log("\n[ 0b ] Authenticating as normal user…");
  let userCookies;
  try {
    userCookies = await login(USER_EMAIL, USER_PASSWORD);
    const hasSession = userCookies.some(
      (c) => c.startsWith("next-auth.session-token") || c.startsWith("__Secure-next-auth")
    );
    if (!hasSession) throw new Error("No session cookie found — check TEST_USER_EMAIL / TEST_USER_PASSWORD");
    ok(`Logged in as user (${USER_EMAIL})`);
  } catch (err) {
    fail("User login failed", err.message);
    console.log("\nTip: Create a user account at http://localhost:3000/auth/signin or run seed.js\n");
    process.exit(1);
  }

  const userHeaders = { Cookie: userCookies.join("; "), "Content-Type": "application/json" };

  /* ── Step 0c: Create a pending request (as user) ────────────────── */
  console.log("\n[ 0c ] Creating two pending slot requests as normal user…");
  let approveId = null;
  let rejectId  = null;

  try {
    const s1 = futureISO(10);
    const e1 = futureISO(12);
    const r1 = await fetch(`${BASE}/api/requests`, {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({
        title: "Checkpoint-3 Approve Test",
        purpose: "Testing approve flow",
        startTime: s1,
        endTime: e1,
      }),
    });
    if (r1.status !== 201) {
      const d = await r1.json();
      throw new Error(`HTTP ${r1.status}: ${d.error || JSON.stringify(d)}`);
    }
    const d1 = await r1.json();
    approveId = d1._id;
    ok(`Created request to approve (id: ${approveId})`);
  } catch (err) {
    fail("Create approve-target request", err.message);
  }

  try {
    const s2 = futureISO(14);
    const e2 = futureISO(16);
    const r2 = await fetch(`${BASE}/api/requests`, {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({
        title: "Checkpoint-3 Reject Test",
        purpose: "Testing rejection flow",
        startTime: s2,
        endTime: e2,
      }),
    });
    if (r2.status !== 201) {
      const d = await r2.json();
      throw new Error(`HTTP ${r2.status}: ${d.error || JSON.stringify(d)}`);
    }
    const d2 = await r2.json();
    rejectId = d2._id;
    ok(`Created request to reject (id: ${rejectId})`);
  } catch (err) {
    fail("Create reject-target request", err.message);
  }

  /* ── Step 1: Admin lists all requests ───────────────────────────── */
  console.log("\n[ 1 ] GET /api/requests as admin — should return ALL users' requests");
  try {
    const res = await fetch(`${BASE}/api/requests`, { headers: adminHeaders });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Expected array response");
    ok(`Admin sees ${data.length} total request(s)`);
    // Admin view should have populated userId with email
    const hasPopulated = data.length === 0 || (data[0].userId && typeof data[0].userId === "object");
    hasPopulated
      ? ok("Requests are populated with userId object (email visible)")
      : fail("userId should be a populated object for admin, got primitive");
  } catch (err) {
    fail("GET /api/requests as admin", err.message);
  }

  /* ── Step 2: Approve a pending request ──────────────────────────── */
  console.log("\n[ 2 ] PATCH /api/admin/requests/:id — approve a pending request");
  if (approveId) {
    try {
      const res = await fetch(`${BASE}/api/admin/requests/${approveId}`, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({ status: "approved" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${data.error || JSON.stringify(data)}`);
      data.status === "approved"
        ? ok(`Request ${approveId} status is now 'approved'`)
        : fail(`Expected status 'approved', got '${data.status}'`);
      data._id ? ok("Returned updated request document") : fail("No _id in response");
    } catch (err) {
      fail("Approve request", err.message);
    }
  } else {
    fail("Approve request", "Skipped — no approveId (request creation failed)");
  }

  /* ── Step 3: Reject a pending request with reason ───────────────── */
  console.log("\n[ 3 ] PATCH /api/admin/requests/:id — reject with reason");
  if (rejectId) {
    try {
      const res = await fetch(`${BASE}/api/admin/requests/${rejectId}`, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({ status: "rejected", rejectionReason: "Maintenance window" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${data.error || JSON.stringify(data)}`);
      data.status === "rejected"
        ? ok(`Request ${rejectId} status is now 'rejected'`)
        : fail(`Expected status 'rejected', got '${data.status}'`);
      data.rejectionReason === "Maintenance window"
        ? ok("rejectionReason stored correctly")
        : fail(`rejectionReason mismatch: '${data.rejectionReason}'`);
    } catch (err) {
      fail("Reject request with reason", err.message);
    }
  } else {
    fail("Reject request with reason", "Skipped — no rejectId (request creation failed)");
  }

  /* ── Step 4: Non-admin blocked from PATCH endpoint ─────────────── */
  console.log("\n[ 4 ] PATCH /api/admin/requests/:id as normal user — should return 401");
  if (approveId) {
    try {
      const res = await fetch(`${BASE}/api/admin/requests/${approveId}`, {
        method: "PATCH",
        headers: userHeaders,
        body: JSON.stringify({ status: "approved" }),
      });
      if (res.status === 401 || res.status === 403) {
        ok(`Non-admin correctly blocked with HTTP ${res.status}`);
      } else {
        fail(`Expected 401/403, got HTTP ${res.status}`);
      }
    } catch (err) {
      fail("Non-admin access check", err.message);
    }
  } else {
    fail("Non-admin access check", "Skipped — no valid request ID");
  }

  /* ── Step 5: Reject without reason → 400 ────────────────────────── */
  console.log("\n[ 5 ] PATCH — reject without rejectionReason → should return 400");
  // Create a fresh pending request for this test
  let noReasonId = null;
  try {
    const s = futureISO(20);
    const e = futureISO(22);
    const r = await fetch(`${BASE}/api/requests`, {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ title: "No-Reason Reject Test", startTime: s, endTime: e }),
    });
    if (r.status === 201) {
      const d = await r.json();
      noReasonId = d._id;
    }
  } catch (_) { /* ignore */ }

  if (noReasonId) {
    try {
      const res = await fetch(`${BASE}/api/admin/requests/${noReasonId}`, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({ status: "rejected" }), // no rejectionReason
      });
      res.status === 400
        ? ok("400 returned when rejecting without a reason")
        : fail(`Expected 400, got HTTP ${res.status}`);
    } catch (err) {
      fail("Reject-without-reason validation", err.message);
    }
  } else {
    fail("Reject-without-reason validation", "Skipped — could not create test request");
  }

  /* ── Step 6: Re-approving already-approved request → 409 ─────────── */
  console.log("\n[ 6 ] PATCH — approve already-approved request → should return 409");
  if (approveId) {
    try {
      const res = await fetch(`${BASE}/api/admin/requests/${approveId}`, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({ status: "approved" }),
      });
      res.status === 409
        ? ok("409 Conflict returned for re-approving already-approved request")
        : fail(`Expected 409, got HTTP ${res.status}`);
    } catch (err) {
      fail("Re-approve conflict check", err.message);
    }
  } else {
    fail("Re-approve conflict check", "Skipped — no approveId");
  }

  /* ── Step 7: User sees rejection reason in their list ──────────── */
  console.log("\n[ 7 ] GET /api/requests as user — user sees rejectionReason in rejected request");
  if (rejectId) {
    try {
      const res = await fetch(`${BASE}/api/requests`, { headers: userHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rejected = data.find((r) => r._id === rejectId);
      rejected
        ? ok("Rejected request appears in user's list")
        : fail("Rejected request NOT found in user's list");
      if (rejected) {
        rejected.rejectionReason
          ? ok(`rejectionReason visible to user: "${rejected.rejectionReason}"`)
          : fail("rejectionReason missing from user's view of rejected request");
        rejected.status === "rejected"
          ? ok("Status is 'rejected' in user view")
          : fail(`Status should be 'rejected', got '${rejected.status}'`);
      }
    } catch (err) {
      fail("User sees rejection reason", err.message);
    }
  } else {
    fail("User sees rejection reason", "Skipped — no rejectId");
  }

  /* ── Summary ──────────────────────────────────────────────────────── */
  console.log("\n──────────────────────────────────────────────────────────");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("──────────────────────────────────────────────────────────\n");

  if (failed > 0) {
    console.log("Manual verification steps:");
    console.log("  1.  npm run dev  →  open http://localhost:3000");
    console.log("  2.  Log in as a normal user, book a slot via /dashboard/calendar");
    console.log("  3.  Log in as admin, open http://localhost:3000/admin/requests");
    console.log("  4.  Verify 'Pending' tab shows the request with user details");
    console.log("  5.  Click 'Approve' → verify status changes to Approved");
    console.log("  6.  Book another slot (as user), then click 'Reject' (as admin)");
    console.log("  7.  Enter reason in modal → confirm rejection");
    console.log("  8.  Log back in as user → verify rejected request shows reason\n");
    process.exit(1);
  }

  console.log("All Checkpoint 3 checks passed! ✓");
  console.log("Next: Open http://localhost:3000/admin/requests to verify the UI.\n");
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
