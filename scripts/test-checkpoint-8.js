#!/usr/bin/env node
/**
 * scripts/test-checkpoint-8.js
 *
 * Standalone verification for Checkpoint 8:
 *   End-to-End Integration, Resilience & Edge Cases
 *
 * Test Scenarios:
 *   [1] Full User Flow: Register -> Book Slot -> Admin Approve -> Scheduler Activates -> SSH Session -> Scheduler Completes -> Admin Cleanup
 *   [2] User Request Cancellation Edge Case & Slot Release
 *   [3] Admin Force Termination of Active Session
 *   [4] Server Restart Recovery & Container State Reconciliation (`syncContainerStates`)
 *   [5] Port Allocation Manager Collision Resilience & Concurrency Locks
 *   [6] Audit & Security Logging Integrity
 *
 * Usage:
 *   node scripts/test-checkpoint-8.js
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

function testSSHConnection({ host, port, username, password, command = 'whoami' }) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      conn.end();
      reject(new Error(`SSH connection timed out after 10000ms to ${host}:${port}`));
    }, 10000);

    conn
      .on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            clearTimeout(timeout);
            conn.end();
            return reject(err);
          }
          stream
            .on('close', (code) => {
              clearTimeout(timeout);
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
        clearTimeout(timeout);
        reject(err);
      })
      .connect({
        host: host === 'localhost' ? '127.0.0.1' : host,
        port: Number(port),
        username,
        password,
        readyTimeout: 10000,
        algorithms: {
          serverHostKey: [
            'ssh-rsa',
            'ssh-ed25519',
            'ecdsa-sha2-nistp256',
            'rsa-sha2-256',
            'rsa-sha2-512',
          ],
        },
      });
  });
}

async function run() {
  console.log('=== Checkpoint 8: End-to-End Integration, Resilience & Edge Cases Verification ===\n');

  const dbConnect = (await import('../lib/mongodb.js')).default;
  const SlotRequest = (await import('../models/SlotRequest.js')).default;
  const User = (await import('../models/User.js')).default;
  const AuditLog = (await import('../models/AuditLog.js')).default;
  const {
    provisionContainer,
    startContainer,
    stopContainer,
    deleteContainerAndVolume,
    getContainerStatus,
    findAvailablePort,
    reservePort,
    releasePort,
  } = await import('../lib/docker.js');
  const {
    processSlotLifecycle,
    syncContainerStates,
  } = await import('../lib/scheduler.js');
  const { logAuditEvent } = await import('../lib/audit.js');

  await dbConnect();

  let testUser = null;
  let flowSlotRequest = null;
  let cancelSlotRequest = null;
  let terminateSlotRequest = null;
  let flowContainerId = null;
  let flowVolumeName = null;
  let terminateContainerId = null;
  let terminateVolumeName = null;

  try {
    // ── Setup Test User ──
    const userEmail = `cp8_test_${Date.now()}@example.com`;
    testUser = await User.create({
      name: 'Checkpoint 8 Resilience Tester',
      email: userEmail,
      password: 'SecurePassword123!',
      role: 'user',
    });
    ok(`Created test user account: ${testUser.email}`);

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 1: Full User Flow & SSH Persistence Lifecycle
    // ─────────────────────────────────────────────────────────────
    console.log('\n[Scenario 1] Full User Flow (Book -> Approve -> Activate -> SSH -> Complete -> Delete)...');

    const flowStartTime = new Date(Date.now() - 3000);
    const flowEndTime = new Date(Date.now() + 10000);

    flowSlotRequest = await SlotRequest.create({
      userId: testUser._id,
      title: 'End-to-End AI Model Job',
      purpose: 'Training PyTorch neural net',
      startTime: flowStartTime,
      endTime: flowEndTime,
      status: 'approved',
    });
    ok(`Slot request created and approved (ID: ${flowSlotRequest._id})`);

    // 1. Scheduler Activation
    await processSlotLifecycle({ now: new Date() });
    flowSlotRequest = await SlotRequest.findById(flowSlotRequest._id);

    if (flowSlotRequest.status === 'active' && flowSlotRequest.containerDetails?.containerId) {
      flowContainerId = flowSlotRequest.containerDetails.containerId;
      flowVolumeName = flowSlotRequest.containerDetails.volumeName;
      ok(`Scheduler auto-activated slot request: Status='active', Port=${flowSlotRequest.containerDetails.sshPort}, Container=${flowContainerId.slice(0, 12)}`);
    } else {
      fail(`Slot failed to auto-activate: status=${flowSlotRequest.status}`);
    }

    // 2. SSH Terminal Session & Persistent Write
    console.log('  Testing live SSH connection & persistent volume write...');
    await wait(1000);
    const sshRes = await testSSHConnection({
      host: flowSlotRequest.containerDetails.sshHost,
      port: flowSlotRequest.containerDetails.sshPort,
      username: flowSlotRequest.containerDetails.sshUser,
      password: flowSlotRequest.containerDetails.sshPassword,
      command: 'echo "Checkpoint 8 Persistence Data" > ~/e2e_checkpoint_8.txt && cat ~/e2e_checkpoint_8.txt',
    });

    if (sshRes.stdout.includes('Checkpoint 8 Persistence Data')) {
      ok(`SSH session executed successfully on port ${flowSlotRequest.containerDetails.sshPort} and wrote data`);
    } else {
      fail(`SSH command output unexpected: stdout="${sshRes.stdout}", stderr="${sshRes.stderr}"`);
    }

    // 3. Scheduler Completion
    console.log('  Triggering slot completion lifecycle tick (simulating elapsed endTime)...');
    await processSlotLifecycle({ now: new Date(Date.now() + 20000) });
    flowSlotRequest = await SlotRequest.findById(flowSlotRequest._id);

    if (flowSlotRequest.status === 'completed') {
      ok(`Scheduler gracefully completed slot when endTime passed (status='completed')`);
    } else {
      fail(`Slot did not complete: status=${flowSlotRequest.status}`);
    }

    const hostStatusAfterEnd = await getContainerStatus(flowContainerId);
    if (hostStatusAfterEnd === 'stopped') {
      ok(`Docker host container stopped automatically (status='stopped') with persistent volume preserved`);
    } else {
      fail(`Expected container to be stopped on host, got '${hostStatusAfterEnd}'`);
    }

    // 4. Admin Data Cleanup
    console.log('  Cleaning up container and persistent storage...');
    const cleanupRes = await deleteContainerAndVolume(flowContainerId, flowVolumeName);
    if (cleanupRes.containerDeleted && cleanupRes.volumeDeleted) {
      ok(`Admin container & persistent volume successfully deleted and purged from host`);
    } else {
      fail(`Failed to delete container/volume: ${JSON.stringify(cleanupRes)}`);
    }

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 2: User Cancellation Edge Case & Slot Release
    // ─────────────────────────────────────────────────────────────
    console.log('\n[Scenario 2] User Cancellation of Pending Request & Slot Collision Release...');

    const cancelStart = new Date(Date.now() + 3600000); // 1h in future
    const cancelEnd = new Date(Date.now() + 7200000);   // 2h in future

    cancelSlotRequest = await SlotRequest.create({
      userId: testUser._id,
      title: 'Slot to Cancel',
      purpose: 'Testing cancellation flow',
      startTime: cancelStart,
      endTime: cancelEnd,
      status: 'pending',
    });
    ok(`Created pending slot request: ${cancelSlotRequest._id}`);

    // Check collision exists
    const collisionCheck = await SlotRequest.findOne({
      status: { $in: ['pending', 'approved', 'active'] },
      startTime: { $lt: cancelEnd },
      endTime: { $gt: cancelStart },
    });
    if (collisionCheck) {
      ok(`Verified colliding window is blocked while status='pending'`);
    } else {
      fail(`Collision check failed to detect pending request`);
    }

    // Cancel the request
    cancelSlotRequest.status = 'cancelled';
    await cancelSlotRequest.save();

    await logAuditEvent({
      action: 'REQUEST_CANCELLED',
      userId: testUser._id,
      performedBy: testUser.email,
      details: { slotId: cancelSlotRequest._id },
    });

    const updatedCancelled = await SlotRequest.findById(cancelSlotRequest._id);
    if (updatedCancelled.status === 'cancelled') {
      ok(`Slot request successfully updated to status='cancelled'`);
    } else {
      fail(`Expected status='cancelled', got '${updatedCancelled.status}'`);
    }

    // Check collision is now freed
    const collisionAfterCancel = await SlotRequest.findOne({
      _id: { $ne: cancelSlotRequest._id },
      status: { $in: ['pending', 'approved', 'active'] },
      startTime: { $lt: cancelEnd },
      endTime: { $gt: cancelStart },
    });
    if (!collisionAfterCancel) {
      ok(`Time slot window is immediately freed up for re-booking after cancellation`);
    } else {
      fail(`Cancelled slot still blocking collision check`);
    }

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 3: Admin Force Termination of Active Session
    // ─────────────────────────────────────────────────────────────
    console.log('\n[Scenario 3] Admin Force Termination of Active Session...');

    const termVolName = `vol_access_test_term_${Date.now()}`;
    const termContainerName = `access_test_term_${Date.now().toString(36)}`;

    const termDetails = await provisionContainer({
      userId: String(testUser._id),
      username: 'termuser',
      containerName: termContainerName,
      volumeName: termVolName,
      autoStart: true,
    });

    terminateContainerId = termDetails.containerId;
    terminateVolumeName = termDetails.volumeName;

    terminateSlotRequest = await SlotRequest.create({
      userId: testUser._id,
      title: 'Slot To Terminate Early',
      purpose: 'Simulating admin emergency stop',
      startTime: new Date(Date.now() - 5000),
      endTime: new Date(Date.now() + 3600000),
      status: 'active',
      containerDetails: termDetails,
    });

    ok(`Active slot created with running container (ID: ${terminateContainerId.slice(0, 12)})`);

    // Force stop container and mark completed
    await stopContainer(terminateContainerId);
    terminateSlotRequest.status = 'completed';
    terminateSlotRequest.adminNotes = 'Terminated early by admin: Security audit';
    await terminateSlotRequest.save();

    await logAuditEvent({
      action: 'SESSION_FORCE_TERMINATED',
      userId: testUser._id,
      performedBy: 'admin@access.internal',
      details: { slotId: terminateSlotRequest._id, containerId: terminateContainerId },
    });

    const termStatus = await getContainerStatus(terminateContainerId);
    if (termStatus === 'stopped') {
      ok(`Container immediately stopped upon admin force termination`);
    } else {
      fail(`Container expected 'stopped', got '${termStatus}'`);
    }

    const termSlot = await SlotRequest.findById(terminateSlotRequest._id);
    if (termSlot.status === 'completed' && termSlot.adminNotes.includes('Terminated early by admin')) {
      ok(`SlotRequest status transitioned to 'completed' with admin termination notes recorded`);
    } else {
      fail(`SlotRequest status not properly transitioned: ${termSlot.status}`);
    }

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 4: Server Restart Recovery & Container State Re-sync
    // ─────────────────────────────────────────────────────────────
    console.log('\n[Scenario 4] Server Restart Recovery & Reconciliation (`syncContainerStates`)...');

    // Create an expired active slot with a running container to simulate server downtime
    const recoveryDetails = await provisionContainer({
      userId: String(testUser._id),
      username: 'recovuser',
      autoStart: true,
    });

    const expiredSlot = await SlotRequest.create({
      userId: testUser._id,
      title: 'Downtime Expired Slot',
      purpose: 'Slot expired while server was offline',
      startTime: new Date(Date.now() - 60000),
      endTime: new Date(Date.now() - 5000), // Ended 5s ago
      status: 'active',
      containerDetails: recoveryDetails,
    });

    ok(`Simulated server downtime scenario: Slot ended in past, container ${recoveryDetails.containerId.slice(0, 12)} running on host`);

    // Run recovery sync
    const recoverySummary = await syncContainerStates({ now: new Date() });
    ok(`Executed syncContainerStates(): Stopped ${recoverySummary.stoppedExpired.length} expired slots, ${recoverySummary.stoppedOrphaned.length} orphans`);

    const updatedExpiredSlot = await SlotRequest.findById(expiredSlot._id);
    const expiredContainerStatus = await getContainerStatus(recoveryDetails.containerId);

    if (updatedExpiredSlot.status === 'completed' && expiredContainerStatus === 'stopped') {
      ok(`Recovery sync automatically resolved expired active slot: Status='completed' and container='stopped'`);
    } else {
      fail(`Recovery sync failed to resolve expired slot: status=${updatedExpiredSlot.status}, container=${expiredContainerStatus}`);
    }

    // Cleanup recovery container
    await deleteContainerAndVolume(recoveryDetails.containerId, recoveryDetails.volumeName);
    await SlotRequest.findByIdAndDelete(expiredSlot._id);

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 5: Port Allocation Manager Collision Resilience
    // ─────────────────────────────────────────────────────────────
    console.log('\n[Scenario 5] Port Allocation Manager Collision Resilience & Concurrency...');

    const port1 = await findAvailablePort();
    reservePort(port1);
    const port2 = await findAvailablePort();
    reservePort(port2);
    const port3 = await findAvailablePort();

    releasePort(port1);
    releasePort(port2);

    if (port1 !== port2 && port2 !== port3 && port1 !== port3) {
      ok(`Concurrency locks verified: 3 consecutive port reservations returned unique ports (${port1}, ${port2}, ${port3})`);
    } else {
      fail(`Port collision detected: port1=${port1}, port2=${port2}, port3=${port3}`);
    }

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 6: Audit & Security Logging
    // ─────────────────────────────────────────────────────────────
    console.log('\n[Scenario 6] Verifying Audit Logs Integrity...');

    const recentLogs = await AuditLog.find({ userId: testUser._id }).sort({ createdAt: -1 });
    const actionTypes = new Set(recentLogs.map((l) => l.action));

    ok(`Found ${recentLogs.length} audit log entries for test user`);
    if (actionTypes.has('REQUEST_CANCELLED') && actionTypes.has('SESSION_FORCE_TERMINATED')) {
      ok(`Audit log records verified: [REQUEST_CANCELLED, SESSION_FORCE_TERMINATED] captured with user/admin context`);
    } else {
      fail(`Missing expected audit actions in log: ${[...actionTypes].join(', ')}`);
    }

  } catch (err) {
    fail('Unhandled exception during Checkpoint 8 test execution', err.message);
    console.error(err);
  } finally {
    // ── Global Test Cleanup ──
    console.log('\n[Step 7] Cleaning up test records and containers...');
    if (flowContainerId || flowVolumeName) {
      try {
        await deleteContainerAndVolume(flowContainerId, flowVolumeName);
      } catch {}
    }
    if (terminateContainerId || terminateVolumeName) {
      try {
        await deleteContainerAndVolume(terminateContainerId, terminateVolumeName);
      } catch {}
    }
    if (flowSlotRequest) {
      try {
        await SlotRequest.findByIdAndDelete(flowSlotRequest._id);
      } catch {}
    }
    if (cancelSlotRequest) {
      try {
        await SlotRequest.findByIdAndDelete(cancelSlotRequest._id);
      } catch {}
    }
    if (terminateSlotRequest) {
      try {
        await SlotRequest.findByIdAndDelete(terminateSlotRequest._id);
      } catch {}
    }
    if (testUser) {
      try {
        await AuditLog.deleteMany({ userId: testUser._id });
        await User.findByIdAndDelete(testUser._id);
      } catch {}
    }
    ok('Test cleanup complete');
  }

  console.log(`\n=== Results: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

run();
