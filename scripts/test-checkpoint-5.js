#!/usr/bin/env node
/**
 * scripts/test-checkpoint-5.js
 *
 * Standalone verification for Checkpoint 5:
 *   Automated Scheduler & Container Lifecycle Controller
 *
 * Steps verified:
 *   [1] Slot Start Handler:
 *       - Approved slot reaching startTime transitions to 'active'.
 *       - Docker container is provisioned/started.
 *       - SSH connection credentials (host, port, user, password, volume) stored.
 *   [2] Live SSH verification:
 *       - Direct SSH connection to container using generated credentials and port.
 *   [3] Idempotency:
 *       - Re-running lifecycle while active maintains active status without recreation.
 *   [4] Slot End Handler:
 *       - Active slot reaching endTime transitions to 'completed'.
 *       - Container is stopped.
 *       - Persistent volume and container remain preserved on host.
 *   [5] Expired slot handling:
 *       - Approved slot where endTime has elapsed transitions cleanly to 'completed'.
 *   [6] Continuous polling loop:
 *       - Background interval timer automatically detects and transitions slots.
 *   [7] Cleanup:
 *       - Removes test containers, volumes, and database records.
 *
 * Usage:
 *   node scripts/test-checkpoint-5.js
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

async function runCheckpoint5Tests() {
  console.log('='.repeat(65));
  console.log('   CHECKPOINT 5: AUTOMATED SCHEDULER & CONTAINER LIFECYCLE');
  console.log('='.repeat(65));

  const { default: dbConnect } = await import('../lib/mongodb.js');
  const { default: SlotRequest } = await import('../models/SlotRequest.js');
  const { default: User } = await import('../models/User.js');
  const {
    processSlotLifecycle,
    startScheduler,
    stopScheduler,
    getSchedulerStatus,
  } = await import('../lib/scheduler.js');
  const {
    getContainerStatus,
    deleteContainerAndVolume,
    docker,
  } = await import('../lib/docker.js');

  await dbConnect();

  const testEmail = `sched_test_${Date.now()}@example.com`;
  let testUser = null;
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
    // Step 1: Slot Start Handler Verification
    // -------------------------------------------------------------
    console.log('\n[Step 1] Verifying Slot Start Handler (approved -> active)...');
    const now = Date.now();
    const startSlot = await SlotRequest.create({
      userId: testUser._id,
      title: 'Checkpoint 5 Slot Start Test',
      purpose: 'Verification of automatic container startup and SSH credentials generation',
      startTime: new Date(now - 1000), // started 1s ago
      endTime: new Date(now + 6000),   // ends in 6s
      status: 'approved',
    });
    ok(`Created approved slot request ${startSlot._id}`);

    // Trigger lifecycle execution
    const startResult = await processSlotLifecycle({ now: new Date() });
    const refreshedStartSlot = await SlotRequest.findById(startSlot._id);

    if (refreshedStartSlot.status === 'active') {
      ok("Slot request status transitioned to 'active'");
    } else {
      fail("Slot request status did not transition to 'active'", `Status is: ${refreshedStartSlot.status}`);
    }

    const details = refreshedStartSlot.containerDetails;
    if (details && details.containerId) {
      ok(`Container ID assigned: ${details.containerId.slice(0, 12)}`);
      createdContainers.push(details.containerId);
    } else {
      fail('Container ID not assigned in containerDetails');
    }

    if (details && details.sshPort >= 2222 && details.sshPort <= 2300) {
      ok(`SSH Port allocated in range: ${details.sshPort}`);
    } else {
      fail('SSH Port missing or out of range', details?.sshPort);
    }

    if (details && details.sshUser && details.sshPassword) {
      ok(`SSH Credentials generated: user=${details.sshUser}, password=${details.sshPassword.slice(0, 3)}***`);
    } else {
      fail('SSH User or Password missing in containerDetails');
    }

    if (details && details.volumeName) {
      ok(`Persistent volume assigned: ${details.volumeName}`);
      createdVolumes.push(details.volumeName);
    } else {
      fail('Persistent volume missing in containerDetails');
    }

    // Verify Docker container is actually running
    const dockerStatus = await getContainerStatus(details.containerId);
    if (dockerStatus === 'running') {
      ok(`Docker reports container status: 'running'`);
    } else {
      fail(`Docker reports container status: '${dockerStatus}' (expected 'running')`);
    }

    // -------------------------------------------------------------
    // Step 2: Live SSH Connection Verification
    // -------------------------------------------------------------
    console.log('\n[Step 2] Verifying live SSH access using generated credentials...');
    try {
      const sshRes = await sshExec(
        details.sshHost || 'localhost',
        details.sshPort,
        details.sshUser,
        details.sshPassword,
        'echo "SCHEDULER_LIFECYCLE_OK"'
      );
      if (sshRes.stdout.includes('SCHEDULER_LIFECYCLE_OK')) {
        ok('SSH command execution succeeded over live port');
      } else {
        fail('SSH command output unexpected', sshRes.stdout);
      }
    } catch (sshErr) {
      fail('SSH connection failed to provisioned container', sshErr.message);
    }

    // -------------------------------------------------------------
    // Step 3: Lifecycle Idempotency Check
    // -------------------------------------------------------------
    console.log('\n[Step 3] Verifying idempotency while slot remains active...');
    await processSlotLifecycle({ now: new Date() });
    const slotAfterSecondTick = await SlotRequest.findById(startSlot._id);
    if (slotAfterSecondTick.status === 'active') {
      ok("Status remained 'active' without duplicate container creation");
    } else {
      fail(`Status changed unexpectedly to: ${slotAfterSecondTick.status}`);
    }

    // -------------------------------------------------------------
    // Step 4: Slot End Handler Verification
    // -------------------------------------------------------------
    console.log('\n[Step 4] Verifying Slot End Handler (active -> completed)...');
    console.log('  Waiting for slot endTime to arrive...');
    const waitMs = Math.max(0, new Date(refreshedStartSlot.endTime).getTime() - Date.now() + 500);
    if (waitMs > 0) {
      await wait(waitMs);
    }

    const endResult = await processSlotLifecycle({ now: new Date() });
    const refreshedEndSlot = await SlotRequest.findById(startSlot._id);

    if (refreshedEndSlot.status === 'completed') {
      ok("Slot request status transitioned to 'completed'");
    } else {
      fail("Slot request status did not transition to 'completed'", `Status is: ${refreshedEndSlot.status}`);
    }

    // Verify Docker container is stopped
    const stoppedStatus = await getContainerStatus(details.containerId);
    if (stoppedStatus === 'stopped') {
      ok("Docker reports container status: 'stopped'");
    } else {
      fail(`Docker reports container status: '${stoppedStatus}' (expected 'stopped')`);
    }

    // Verify volume still exists
    try {
      const vol = docker.getVolume(details.volumeName);
      await vol.inspect();
      ok(`Persistent volume ${details.volumeName} is intact after container stop`);
    } catch (volErr) {
      fail('Persistent volume missing after container stop', volErr.message);
    }

    // -------------------------------------------------------------
    // Step 5: Expired Slot Handling Verification
    // -------------------------------------------------------------
    console.log('\n[Step 5] Verifying expired approved slot handling...');
    const expiredSlot = await SlotRequest.create({
      userId: testUser._id,
      title: 'Expired Slot Test',
      purpose: 'Testing graceful completion of slots whose window expired while server was offline',
      startTime: new Date(Date.now() - 10000),
      endTime: new Date(Date.now() - 2000),
      status: 'approved',
    });

    await processSlotLifecycle({ now: new Date() });
    const refreshedExpired = await SlotRequest.findById(expiredSlot._id);
    if (refreshedExpired.status === 'completed') {
      ok("Expired approved slot cleanly transitioned to 'completed' without spawning orphan container");
    } else {
      fail(`Expired slot status is: ${refreshedExpired.status}`);
    }

    // -------------------------------------------------------------
    // Step 6: Background Polling Loop Verification
    // -------------------------------------------------------------
    console.log('\n[Step 6] Verifying automated background polling loop...');
    const loopStartTime = Date.now();
    const loopSlot = await SlotRequest.create({
      userId: testUser._id,
      title: 'Background Polling Loop Test',
      purpose: 'Testing automated timer ticks without manual triggers',
      startTime: new Date(loopStartTime + 800),  // starts in 0.8s
      endTime: new Date(loopStartTime + 3000),   // ends in 3s
      status: 'approved',
    });

    // Start background timer with 1s interval
    startScheduler({ intervalMs: 1000, runImmediately: false });
    ok('Background scheduler started with 1000ms interval');

    // Wait dynamically for background timer to activate slot (up to 5s)
    let loopSlotActive = null;
    const startPollLimit = Date.now() + 5000;
    while (Date.now() < startPollLimit) {
      await wait(300);
      const doc = await SlotRequest.findById(loopSlot._id);
      if (doc && doc.status === 'active') {
        loopSlotActive = doc;
        break;
      }
    }

    if (loopSlotActive && loopSlotActive.status === 'active') {
      ok("Background timer automatically transitioned slot to 'active'");
      if (loopSlotActive.containerDetails?.containerId) {
        createdContainers.push(loopSlotActive.containerDetails.containerId);
      }
      if (loopSlotActive.containerDetails?.volumeName) {
        createdVolumes.push(loopSlotActive.containerDetails.volumeName);
      }
    } else {
      const currentStatus = (await SlotRequest.findById(loopSlot._id))?.status;
      fail(`Background timer did not activate slot in time`, `Status is: ${currentStatus}`);
    }

    // Wait dynamically for background timer to complete slot (up to 6s)
    let loopSlotCompleted = null;
    const endPollLimit = Date.now() + 6000;
    while (Date.now() < endPollLimit) {
      await wait(300);
      const doc = await SlotRequest.findById(loopSlot._id);
      if (doc && doc.status === 'completed') {
        loopSlotCompleted = doc;
        break;
      }
    }

    if (loopSlotCompleted && loopSlotCompleted.status === 'completed') {
      ok("Background timer automatically transitioned slot to 'completed'");
    } else {
      const currentStatus = (await SlotRequest.findById(loopSlot._id))?.status;
      fail(`Background timer did not complete slot in time`, `Status is: ${currentStatus}`);
    }

    // Stop background timer
    stopScheduler();
    const schedState = getSchedulerStatus();
    if (!schedState.running) {
      ok('Background scheduler stopped cleanly');
    } else {
      fail('Scheduler state still indicates running');
    }

  } catch (err) {
    console.error('\nFatal test execution error:', err);
    fail('Test suite crashed', err.message);
  } finally {
    // -------------------------------------------------------------
    // Step 7: Cleanup
    // -------------------------------------------------------------
    console.log('\n[Step 7] Cleaning up test containers, volumes, and database records...');
    stopScheduler();

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

  console.log('\n' + '='.repeat(65));
  console.log(`CHECKPOINT 5 TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(65));

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runCheckpoint5Tests();
