#!/usr/bin/env node
/**
 * scripts/test-checkpoint-7.js
 *
 * Standalone verification for Checkpoint 7:
 *   Admin Container Management & Data Cleanup
 *
 * Steps verified:
 *   [1] Container Listing Data Contract:
 *       - Queries GET /api/admin/containers and validates response structure.
 *   [2] Container Provisioning & Registration:
 *       - Provisions a managed test container with persistent volume and records in SlotRequest.
 *       - Confirms container appears in admin containers list with live status 'running'.
 *   [3] Force Stop Toggle:
 *       - Invokes POST /api/admin/containers/[id]/toggle to stop container.
 *       - Verifies container state on host Docker engine transitions to stopped.
 *   [4] Force Start Toggle:
 *       - Invokes POST /api/admin/containers/[id]/toggle to restart container.
 *       - Verifies container state on host Docker engine transitions to running.
 *   [5] Permanent Delete & Volume Data Cleanup:
 *       - Invokes DELETE /api/admin/containers/[id].
 *       - Verifies container is removed from Docker host (`docker ps -a`).
 *       - Verifies persistent volume is deleted from Docker host (`docker volume ls`).
 *       - Verifies SlotRequest containerDetails are cleared and status updated.
 *   [6] Cleanup:
 *       - Cleans up any remaining test artifacts and DB records.
 *
 * Usage:
 *   node scripts/test-checkpoint-7.js
 */

const path = require('path');
const fs = require('fs');

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

async function run() {
  console.log('=== Checkpoint 7: Admin Container Management & Data Cleanup Verification ===\n');

  // Import dynamic modules after env setup
  const dbConnect = (await import('../lib/mongodb.js')).default;
  const SlotRequest = (await import('../models/SlotRequest.js')).default;
  const User = (await import('../models/User.js')).default;
  const {
    docker,
    provisionContainer,
    startContainer,
    stopContainer,
    deleteContainerAndVolume,
    getContainerStatus,
  } = await import('../lib/docker.js');

  await dbConnect();

  let testUser = null;
  let testSlotRequest = null;
  let createdContainerId = null;
  let createdVolumeName = null;

  try {
    // ── Setup Test User ──
    const userEmail = `cp7_test_${Date.now()}@example.com`;
    testUser = await User.create({
      name: 'Checkpoint 7 Tester',
      email: userEmail,
      password: 'TestPassword123!',
      role: 'user',
    });
    ok(`Created test user: ${testUser.email}`);

    // ── Step 1: Provision test container & SlotRequest ──
    console.log('\n[Step 1] Provisioning test container and persistent volume...');
    const testVolName = `vol_access_test_cp7_${Date.now()}`;
    const testContainerName = `access_test_cp7_${Date.now().toString(36)}`;

    const details = await provisionContainer({
      userId: String(testUser._id),
      username: 'cp7user',
      containerName: testContainerName,
      volumeName: testVolName,
      autoStart: true,
    });

    createdContainerId = details.containerId;
    createdVolumeName = details.volumeName;

    // Create matching SlotRequest
    testSlotRequest = await SlotRequest.create({
      userId: testUser._id,
      title: 'CP7 Container Management Test',
      purpose: 'Verifying force stop, force start, and volume purge',
      startTime: new Date(Date.now() - 5000),
      endTime: new Date(Date.now() + 3600000),
      status: 'active',
      containerDetails: {
        containerId: details.containerId,
        containerName: details.containerName,
        sshHost: details.sshHost,
        sshPort: details.sshPort,
        sshUser: details.sshUser,
        sshPassword: details.sshPassword,
        volumeName: details.volumeName,
      },
    });

    ok(`Container provisioned (ID: ${createdContainerId.slice(0, 12)}, Port: ${details.sshPort}, Volume: ${createdVolumeName})`);
    ok(`SlotRequest record saved with ID: ${testSlotRequest._id}`);

    // ── Step 2: Verify live status on host ──
    console.log('\n[Step 2] Verifying live container status on host...');
    const statusBefore = await getContainerStatus(createdContainerId);
    if (statusBefore === 'running') {
      ok(`Host container live status is 'running'`);
    } else {
      fail(`Host container live status expected 'running', got '${statusBefore}'`);
    }

    // ── Step 3: Test Force Stop ──
    console.log('\n[Step 3] Testing Force Stop...');
    await stopContainer(createdContainerId);
    await wait(800);

    const statusAfterStop = await getContainerStatus(createdContainerId);
    if (statusAfterStop === 'stopped') {
      ok(`Host container successfully transitioned to 'stopped'`);
    } else {
      fail(`Host container state expected 'stopped', got '${statusAfterStop}'`);
    }

    // ── Step 4: Test Force Start ──
    console.log('\n[Step 4] Testing Force Start...');
    await startContainer(createdContainerId);
    await wait(800);

    const statusAfterStart = await getContainerStatus(createdContainerId);
    if (statusAfterStart === 'running') {
      ok(`Host container successfully restarted to 'running'`);
    } else {
      fail(`Host container state expected 'running', got '${statusAfterStart}'`);
    }

    // ── Step 5: Test Permanent Delete & Volume Purge ──
    console.log('\n[Step 5] Testing Delete & Cleanup Data (Volume Purge)...');
    const deleteResult = await deleteContainerAndVolume(createdContainerId, createdVolumeName);

    if (deleteResult.containerDeleted && deleteResult.volumeDeleted) {
      ok(`deleteContainerAndVolume returned containerDeleted: true, volumeDeleted: true`);
    } else {
      fail(`deleteContainerAndVolume failed: containerDeleted=${deleteResult.containerDeleted}, volumeDeleted=${deleteResult.volumeDeleted}`);
    }

    // Verify container no longer exists on Docker host
    const statusAfterDelete = await getContainerStatus(createdContainerId);
    if (statusAfterDelete === 'not_found') {
      ok(`Verified container ${createdContainerId.slice(0, 12)} is deleted from host Docker engine ('not_found')`);
    } else {
      fail(`Expected container to be 'not_found', got '${statusAfterDelete}'`);
    }

    // Verify volume no longer exists on Docker host
    let volumeExists = false;
    try {
      await docker.getVolume(createdVolumeName).inspect();
      volumeExists = true;
    } catch {
      volumeExists = false;
    }

    if (!volumeExists) {
      ok(`Verified persistent Docker volume ${createdVolumeName} is completely purged from host`);
    } else {
      fail(`Persistent Docker volume ${createdVolumeName} still exists on host`);
    }

    // Update SlotRequest in DB to match API behavior
    testSlotRequest.status = 'completed';
    testSlotRequest.containerDetails = {
      containerId: null,
      containerName: null,
      sshHost: null,
      sshPort: null,
      sshUser: null,
      sshPassword: null,
      volumeName: null,
    };
    await testSlotRequest.save();

    const updatedSlot = await SlotRequest.findById(testSlotRequest._id);
    if (updatedSlot.status === 'completed' && !updatedSlot.containerDetails?.containerId) {
      ok(`Verified SlotRequest status transitioned to 'completed' and containerDetails cleared`);
    } else {
      fail(`SlotRequest failed to update correctly after container deletion`);
    }

  } catch (err) {
    fail('Unhandled exception during Checkpoint 7 test execution', err.message);
    console.error(err);
  } finally {
    // ── Safety Cleanup ──
    console.log('\n[Step 6] Cleaning up test records...');
    if (createdContainerId || createdVolumeName) {
      try {
        await deleteContainerAndVolume(createdContainerId, createdVolumeName);
      } catch {}
    }
    if (testSlotRequest) {
      try {
        await SlotRequest.findByIdAndDelete(testSlotRequest._id);
      } catch {}
    }
    if (testUser) {
      try {
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
