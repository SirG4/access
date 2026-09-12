#!/usr/bin/env node
/**
 * scripts/test-checkpoint-2.js
 *
 * Automated verification for Checkpoint 2:
 *   - Calendar Slot Query (GET /api/requests/slots)
 *   - Booking Submission (POST /api/requests)
 *   - Request List (GET /api/requests)
 *   - Conflict Detection (POST /api/requests with overlapping slot)
 *
 * Usage:
 *   1. Start dev server: npm run dev
 *   2. Ensure a test user account exists (run scripts/seed.js first)
 *   3. Run: node scripts/test-checkpoint-2.js
 *
 * The script uses HTTP basic-style cookie auth via NextAuth credentials.
 */

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const USER_EMAIL = process.env.TEST_USER_EMAIL || "user@example.com";
const USER_PASSWORD = process.env.TEST_USER_PASSWORD || "password123";

let passed = 0;
let failed = 0;

/* ── helpers ── */
function ok(label) {
  console.log(`  ✓ ${label}`);
  passed++;
}
function fail(label, detail) {
  console.error(`  ✗ ${label}`);
  if (detail) console.error(`      ${detail}`);
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

async function login() {
  const cookieStore = [];
  const csrfToken = await getCSRF(cookieStore);

  const body = new URLSearchParams({
    csrfToken,
    email: USER_EMAIL,
    password: USER_PASSWORD,
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

  // Collect session cookies
  const setCookies = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookies) cookieStore.push(c.split(";")[0]);

  return cookieStore;
}

function futureISO(offsetHours) {
  const d = new Date(Date.now() + offsetHours * 3600 * 1000);
  // Round up to next hour for cleanliness
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}

/* ── main ── */
async function run() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║  Checkpoint 2 — Calendar UI & Booking   ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // ── Step 0: Login ──────────────────────────────────────────
  console.log("[ 0 ] Authenticating as normal user…");
  let cookies;
  try {
    cookies = await login();
    if (!cookies.some((c) => c.startsWith("next-auth.session-token") || c.startsWith("__Secure-next-auth"))) {
      throw new Error("No session cookie found after login — check TEST_USER_EMAIL/TEST_USER_PASSWORD");
    }
    ok(`Logged in as ${USER_EMAIL}`);
  } catch (err) {
    fail("Login failed", err.message);
    console.log("\nTip: Set TEST_USER_EMAIL and TEST_USER_PASSWORD env vars, or ensure seed.js has run.\n");
    process.exit(1);
  }

  const authHeaders = { Cookie: cookies.join("; "), "Content-Type": "application/json" };

  // ── Step 1: GET /api/requests/slots ───────────────────────
  console.log("\n[ 1 ] GET /api/requests/slots");
  try {
    const start = new Date().toISOString();
    const end = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const res = await fetch(`${BASE}/api/requests/slots?start=${start}&end=${end}`, {
      headers: authHeaders,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Expected array response");

    ok(`Returned ${data.length} slot(s) — shape is correct`);

    if (data.length > 0) {
      const s = data[0];
      const hasRequired = s._id && s.startTime && s.endTime && s.status;
      hasRequired ? ok("Slot shape: _id, startTime, endTime, status present") : fail("Slot shape missing required fields");
    } else {
      ok("No existing slots (clean state)");
    }
  } catch (err) {
    fail("GET /api/requests/slots", err.message);
  }

  // ── Step 2: POST /api/requests — valid future slot ─────────
  console.log("\n[ 2 ] POST /api/requests — valid new booking");
  let createdId = null;
  const slotStart = futureISO(2);  // 2h from now
  const slotEnd = futureISO(4);    // 4h from now

  try {
    const res = await fetch(`${BASE}/api/requests`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        title: "Checkpoint-2 Test Booking",
        purpose: "Automated test for calendar booking flow",
        startTime: slotStart,
        endTime: slotEnd,
      }),
    });

    if (res.status !== 201) {
      const d = await res.json();
      throw new Error(`HTTP ${res.status}: ${d.error || JSON.stringify(d)}`);
    }

    const data = await res.json();
    createdId = data._id;
    if (!createdId) throw new Error("No _id in response");

    ok(`Created booking (id: ${createdId}, status: ${data.status})`);
    data.status === "pending" ? ok("Status is 'pending' as expected") : fail(`Status should be 'pending', got '${data.status}'`);
  } catch (err) {
    fail("POST /api/requests — valid slot", err.message);
  }

  // ── Step 3: GET /api/requests — verify it appears ─────────
  console.log("\n[ 3 ] GET /api/requests — new booking should appear");
  try {
    const res = await fetch(`${BASE}/api/requests`, { headers: authHeaders });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!Array.isArray(data)) throw new Error("Expected array");
    ok(`Returned ${data.length} request(s) for current user`);

    if (createdId) {
      const found = data.find((r) => r._id === createdId);
      found ? ok("New booking found in list") : fail("New booking NOT found in list");
    }
  } catch (err) {
    fail("GET /api/requests", err.message);
  }

  // ── Step 4: POST /api/requests — overlapping slot → 409 ───
  console.log("\n[ 4 ] POST /api/requests — overlapping slot (should return 409)");
  try {
    const res = await fetch(`${BASE}/api/requests`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        title: "Overlap Test",
        purpose: "Should be rejected",
        startTime: slotStart,    // same window as step 2
        endTime: slotEnd,
      }),
    });

    if (res.status === 409) {
      const data = await res.json();
      ok("409 Conflict returned for overlapping slot");
      data.collision ? ok("Collision details included in response") : ok("Conflict error returned (no collision details)");
    } else {
      fail(`Expected 409, got HTTP ${res.status}`);
    }
  } catch (err) {
    fail("Overlap collision check", err.message);
  }

  // ── Step 5: POST /api/requests — past date → 400 ──────────
  console.log("\n[ 5 ] POST /api/requests — past start time (should return 400)");
  try {
    const res = await fetch(`${BASE}/api/requests`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        title: "Past Slot Test",
        purpose: "Should be rejected",
        startTime: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        endTime: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
      }),
    });

    if (res.status === 400) {
      ok("400 Bad Request returned for past start time");
    } else {
      fail(`Expected 400, got HTTP ${res.status}`);
    }
  } catch (err) {
    fail("Past date validation", err.message);
  }

  // ── Step 6: Calendar slots query shows new booking ─────────
  console.log("\n[ 6 ] GET /api/requests/slots — new booking appears in calendar feed");
  try {
    const res = await fetch(
      `${BASE}/api/requests/slots?start=${slotStart}&end=${slotEnd}`,
      { headers: authHeaders }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!Array.isArray(data)) throw new Error("Expected array");

    if (createdId) {
      const found = data.find((s) => s._id === createdId);
      found ? ok("New booking visible in /api/requests/slots feed") : fail("New booking NOT visible in calendar slots feed");
    } else {
      ok(`${data.length} slot(s) returned in date window`);
    }
  } catch (err) {
    fail("GET /api/requests/slots with date range", err.message);
  }

  // ── Summary ───────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────────");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("─────────────────────────────────────────────\n");

  if (failed > 0) {
    console.log("Manual verification steps:");
    console.log("  1. npm run dev  →  open http://localhost:3000");
    console.log("  2. Log in as a normal user");
    console.log("  3. Click 'Book a Slot' on the dashboard");
    console.log("  4. Verify the weekly calendar loads and existing slots show");
    console.log("  5. Click an empty hour cell → booking modal opens pre-filled");
    console.log("  6. Submit → new pending slot appears in calendar + request list");
    console.log("  7. Try same time again → submit button disabled / overlap shown\n");
    process.exit(1);
  }

  console.log("All checks passed! ✓");
  console.log("Next: Open http://localhost:3000/dashboard/calendar to verify the UI.\n");
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
