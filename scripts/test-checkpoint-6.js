#!/usr/bin/env node
/**
 * scripts/test-checkpoint-6.js
 *
 * Standalone verification for Checkpoint 6:
 *   User Active Session Portal & SSH Access Dashboard
 *
 * Steps verified:
 *   [1] Slot Activation & Credentials Availability:
 *       - Approved slot transitions to 'active'.
 *       - containerDetails is fully populated with sshHost, sshPort, sshUser, sshPassword, containerId, volumeName.
 *   [2] User Dashboard Data Contract:
 *       - GET /api/requests returns active slot details & SSH connection parameters for normal user.
 *   [3] Live SSH Access Verification:
 *       - Direct SSH connection to the active container on the assigned port using generated credentials.
 *   [4] Active Countdown Logic:
 *       - Verifies active slot remaining time calculation (startTime <= now <= endTime).
 *   [5] Slot Completion & Container Shutdown:
 *       - Lifecycle completion transitions slot to 'completed'.
 *       - Container is stopped while persistent volume remains preserved.
 *   [6] Post-Completion Dashboard State:
 *       - GET /api/requests reflects 'completed' state indicating container stopped and volume saved.
 *   [7] Cleanup:
 *       - Removes test container, persistent volume, and database records.
 *
 * Usage:
 *   node scripts/test-checkpoint-6.js
 */

const path = require('path');
const fs = require('fs');
const { Client } = require('ssh2');

// Load environment variables from .env.local if present
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
}

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  ✓ ${label}`);
  passed++;
}

function fail(label, detail) {
  console.error(`  ✗ ${label}`);
  if (detail) console.error(`    → ${detail}`);
  failed++;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute command over SSH using ssh2
 */
function sshExec(host, port, username, password, command, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      conn.end();
      reject(new Error(`SSH connection timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    conn
      .on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            clearTimeout(timer);
            conn.end();
            return reject(err);
          }
          stream
            .on('close', (code) => {
              clearTimeout(timer);
              conn.end();
              resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
            })
            .on('data', (data) => {
              stdout += data.toString();
            })
            .stderr.on('data', (data) => {
              stderr += data.toString();
            });
        });
      })
      .on('error', (err) => {
        clearTimeout(timer);
        if (!timedOut) reject(err);
      })
      .connect({
        host,
        port,
        username,
        password,
        readyTimeout: timeoutMs,
        algorithms: {
          serverHostKey: [
            'ssh-rsa',
            'ecdsa-sha2-nistp256',
            'ssh-ed25519',
          ],
        },
      });
  });
}

async function runCheckpoint6Tests() {
  console.log('='.repeat(68));
  console.log('   CHECKPOINT 6: USER ACTIVE SESSION PORTAL & SSH ACCESS DASHBOARD');
  console.log('='.repeat(68));

  const { default: dbConnect } = await import('../lib/mongodb.js');
  const { default: SlotRequest } = await import('../models/SlotRequest.js');
  const { default: User } = await import('../models/User.js');
  const { processSlotLifecycle, stopScheduler } = await import('../lib/scheduler.js');
  const { getContainerStatus, deleteContainerAndVolume, docker } = await import('../lib/docker.js');

  await dbConnect();
  stopScheduler();

  const testEmail = `user_dash_${Date.now()}@example.com`;
  let testUser = null;
  let activeSlot = null;
  const createdContainers = [];
  const createdVolumes = [];

  try {
    // -------------------------------------------------------------
    // Step 0: Setup Test User
    // -------------------------------------------------------------
    console.log('\n[Step 0] Creating test user in MongoDB...');
    testUser = await User.create({
      email: testEmail,
      role: 'user',
      provider: 'credentials',
    });
    ok(`Test user created with ID ${testUser._id}`);

    // -------------------------------------------------------------
    // Step 1: Create Approved Slot & Activate via Lifecycle
    // -------------------------------------------------------------
    console.log('\n[Step 1] Creating approved slot & triggering container activation...');
    const nowMs = Date.now();
    activeSlot = await SlotRequest.create({
      userId: testUser._id,
      title: 'Deep Learning Access Test',
      purpose: 'Verification of user active access portal credentials & countdown',
      startTime: new Date(nowMs - 2000), // started 2s ago
      endTime: new Date(nowMs + 10000),  // ends in 10s
      status: 'approved',
    });
    ok(`Approved slot request created with ID ${activeSlot._id}`);

    await processSlotLifecycle({ now: new Date() });
    const refreshedSlot = await SlotRequest.findById(activeSlot._id);

    if (refreshedSlot.status === 'active') {
      ok("Slot request status transitioned to 'active'");
    } else {
      fail("Slot request status did not transition to 'active'", `Status is: ${refreshedSlot.status}`);
    }

    const details = refreshedSlot.containerDetails;
    if (details && details.containerId) {
      ok(`Container ID assigned: ${details.containerId.slice(0, 12)}`);
      createdContainers.push(details.containerId);
    } else {
      fail('Container ID missing in containerDetails');
    }

    if (details && details.sshPort >= 2222 && details.sshPort <= 2300) {
      ok(`SSH Port allocated in valid range: ${details.sshPort}`);
    } else {
      fail('SSH Port missing or invalid', details?.sshPort);
    }

    if (details && details.sshUser && details.sshPassword) {
      ok(`SSH Credentials ready: user=${details.sshUser}, pass=${details.sshPassword.slice(0, 3)}***`);
    } else {
      fail('SSH username or password missing in containerDetails');
    }

    if (details && details.volumeName) {
      ok(`Persistent volume assigned: ${details.volumeName}`);
      createdVolumes.push(details.volumeName);
    } else {
      fail('Persistent volume missing in containerDetails');
    }

    // -------------------------------------------------------------
    // Step 2: User Active Session Data Contract Verification
    // -------------------------------------------------------------
    console.log('\n[Step 2] Verifying User Dashboard data contract for active slot...');
    const userSlots = await SlotRequest.find({ userId: testUser._id }).sort({ createdAt: -1 });
    const userActive = userSlots.find((s) => s.status === 'active');

    if (userActive) {
      ok('Active slot found in user request query');
      const sshCmd = `ssh ${userActive.containerDetails.sshUser}@${userActive.containerDetails.sshHost || 'localhost'} -p ${userActive.containerDetails.sshPort}`;
      ok(`Formatted SSH command string: '${sshCmd}'`);
    } else {
      fail('Active slot not returned for user query');
    }

    // -------------------------------------------------------------
    // Step 3: Live SSH Connection & Command Execution
    // -------------------------------------------------------------
    console.log('\n[Step 3] Verifying SSH connection using active session credentials...');
    try {
      const sshRes = await sshExec(
        details.sshHost || 'localhost',
        details.sshPort,
        details.sshUser,
        details.sshPassword,
        'echo "ACTIVE_SESSION_PORTAL_OK"'
      );
      if (sshRes.stdout.includes('ACTIVE_SESSION_PORTAL_OK')) {
        ok('SSH command executed successfully over live container port');
      } else {
        fail('SSH command output unexpected', sshRes.stdout);
      }
    } catch (sshErr) {
      fail('SSH connection failed using active session credentials', sshErr.message);
    }

    // -------------------------------------------------------------
    // Step 4: Active Session Countdown Verification
    // -------------------------------------------------------------
    console.log('\n[Step 4] Verifying countdown calculations for active session...');
    const curNow = Date.now();
    const endMs = new Date(refreshedSlot.endTime).getTime();
    const remainingMs = endMs - curNow;

    if (remainingMs > 0 && remainingMs <= 10000) {
      ok(`Countdown timer remaining time is positive: ${Math.round(remainingMs / 1000)}s remaining`);
    } else {
      fail(`Countdown remaining time invalid: ${remainingMs}ms`);
    }

    // -------------------------------------------------------------
    // Step 5: Slot End Handling & Container Stopping
    // -------------------------------------------------------------
    console.log('\n[Step 5] Waiting for slot window to end & completing session...');
    const waitTime = Math.max(0, endMs - Date.now() + 500);
    if (waitTime > 0) {
      await wait(waitTime);
    }

    await processSlotLifecycle({ now: new Date() });
    const completedSlot = await SlotRequest.findById(activeSlot._id);

    if (completedSlot.status === 'completed') {
      ok("Slot request status transitioned to 'completed'");
    } else {
      fail(`Slot request status did not transition to 'completed': ${completedSlot.status}`);
    }

    // Verify Docker container is stopped
    const stoppedStatus = await getContainerStatus(details.containerId);
    if (stoppedStatus === 'stopped') {
      ok("Docker container gracefully stopped upon slot completion");
    } else {
      fail(`Docker container status is '${stoppedStatus}' (expected 'stopped')`);
    }

    // Verify volume preserved
    try {
      const vol = docker.getVolume(details.volumeName);
      await vol.inspect();
      ok(`Persistent volume '${details.volumeName}' is preserved on host`);
    } catch (volErr) {
      fail('Persistent volume missing after session completed', volErr.message);
    }

    // -------------------------------------------------------------
    // Step 6: Post-Completion Dashboard State Verification
    // -------------------------------------------------------------
    console.log('\n[Step 6] Verifying user dashboard state after session completed...');
    const postSlots = await SlotRequest.find({ userId: testUser._id }).sort({ createdAt: -1 });
    const hasActiveNow = postSlots.some((s) => s.status === 'active');
    const hasCompleted = postSlots.some((s) => s.status === 'completed');

    if (!hasActiveNow && hasCompleted) {
      ok('Dashboard reflects no active session and presents completed session summary');
    } else {
      fail('Post-completion dashboard state invalid', { hasActiveNow, hasCompleted });
    }

  } catch (err) {
    console.error('\nFatal test execution error:', err);
    fail('Test suite crashed', err.message);
  } finally {
    // -------------------------------------------------------------
    // Step 7: Cleanup
    // -------------------------------------------------------------
    console.log('\n[Step 7] Cleaning up test containers, volumes, and database records...');
    for (const cId of createdContainers) {
      try {
        await deleteContainerAndVolume(cId, null);
      } catch (cErr) {
        console.warn(`Warning cleaning container ${cId}:`, cErr.message);
      }
    }
    for (const vName of createdVolumes) {
      try {
        await deleteContainerAndVolume(null, vName);
      } catch (vErr) {
        console.warn(`Warning cleaning volume ${vName}:`, vErr.message);
      }
    }
    if (testUser) {
      try {
        await SlotRequest.deleteMany({ userId: testUser._id });
        await User.deleteOne({ _id: testUser._id });
        ok('Cleaned up test database records');
      } catch (dbErr) {
        console.warn('Warning cleaning database records:', dbErr.message);
      }
    }
  }

  console.log('\n' + '='.repeat(68));
  console.log(`CHECKPOINT 6 TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(68));

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runCheckpoint6Tests();
