#!/usr/bin/env node
/**
 * scripts/test-docker.js
 *
 * Standalone verification for Checkpoint 4:
 *   Docker Provisioning Engine (Ubuntu + OpenSSH + Persistent Storage)
 *
 * Steps verified:
 *   [1] Provision container via lib/docker.js (custom user, port, persistent volume)
 *   [2] SSH into container & verify authentication
 *   [3] Write test file inside container: /home/<user>/test.txt
 *   [4] Stop container via stopContainer() & verify SSH closes/fails
 *   [5] Start container via startContainer() & verify SSH reconnects
 *   [6] Verify /home/<user>/test.txt persisted across stop/start
 *   [7] Clean up via deleteContainerAndVolume() & verify removal
 *
 * Usage:
 *   node scripts/test-docker.js
 */

const { Client } = require('ssh2');

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

/**
 * Attempt SSH connection with short timeout to verify it fails
 */
function sshExpectFailure(host, port, username, password, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const conn = new Client();
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      conn.end();
      resolve(true); // Connection timed out / unreachable as expected
    }, timeoutMs);

    conn
      .on('ready', () => {
        clearTimeout(timer);
        conn.end();
        resolve(false); // Unexpectedly succeeded
      })
      .on('error', () => {
        clearTimeout(timer);
        resolve(true); // Failed as expected
      })
      .connect({
        host,
        port,
        username,
        password,
        readyTimeout: timeoutMs,
      });
  });
}

async function run() {
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   Checkpoint 4 — Docker Provisioning Engine & Persistence Test    ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  // Dynamically import lib/docker.js
  const dockerLib = await import('../lib/docker.js');
  const {
    provisionContainer,
    startContainer,
    stopContainer,
    deleteContainerAndVolume,
    getContainerStatus,
    findAvailablePort,
  } = dockerLib;

  const testUserId = `testuser_${Date.now()}`;
  const testUsername = 'testpilot';
  const testPassword = 'SecretPassword99!';
  const testPort = await findAvailablePort(2230, 2290);
  const testVolume = `vol_access_user_${testUserId}`;

  let provisioned = null;

  try {
    /* ── Step 1: Provision Container ──────────────────────────────── */
    console.log('[ 1 ] Provisioning container via lib/docker.js…');
    provisioned = await provisionContainer({
      userId: testUserId,
      username: testUsername,
      password: testPassword,
      port: testPort,
      volumeName: testVolume,
      autoStart: true,
    });

    if (provisioned?.containerId) {
      ok(`Container provisioned (ID: ${provisioned.containerId.slice(0, 12)})`);
      ok(`Port allocated: ${provisioned.sshPort}`);
      ok(`Persistent volume created: ${provisioned.volumeName}`);
      ok(`SSH user: ${provisioned.sshUser}`);
    } else {
      fail('Provision container returned invalid details', JSON.stringify(provisioned));
      process.exit(1);
    }

    // Verify container is in running state
    const initialStatus = await getContainerStatus(provisioned.containerId);
    if (initialStatus === 'running') {
      ok("Container status confirmed as 'running'");
    } else {
      fail(`Container status expected 'running', got '${initialStatus}'`);
    }

    /* ── Step 2: SSH Connection & Authentication ─────────────────── */
    console.log('\n[ 2 ] Testing SSH connection to container…');
    // Allow OpenSSH server 1-2 seconds to fully initialize host keys
    let connected = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const res = await sshExec(
          '127.0.0.1',
          provisioned.sshPort,
          provisioned.sshUser,
          provisioned.sshPassword,
          'whoami && pwd'
        );
        if (res.code === 0 && res.stdout.includes(testUsername)) {
          ok(`SSH authenticated successfully (User: ${testUsername})`);
          connected = true;
          break;
        }
      } catch (err) {
        if (attempt === 5) {
          fail('SSH connection failed after 5 attempts', err.message);
        } else {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    if (!connected) {
      throw new Error('Unable to establish SSH session to provisioned container');
    }

    /* ── Step 3: Write Test File Inside Container ────────────────── */
    console.log('\n[ 3 ] Writing persistence test file into /home/<user>/test.txt…');
    const writeResult = await sshExec(
      '127.0.0.1',
      provisioned.sshPort,
      provisioned.sshUser,
      provisioned.sshPassword,
      `echo "persistence test" > /home/${testUsername}/test.txt && cat /home/${testUsername}/test.txt`
    );

    if (writeResult.stdout.includes('persistence test')) {
      ok('Created test file: /home/<user>/test.txt containing "persistence test"');
    } else {
      fail('Failed to verify written content in test file', JSON.stringify(writeResult));
    }

    /* ── Step 4: Stop Container ──────────────────────────────────── */
    console.log('\n[ 4 ] Stopping container via stopContainer()…');
    const stopResult = await stopContainer(provisioned.containerId);
    if (stopResult.status === 'stopped') {
      ok('stopContainer() returned status: stopped');
    } else {
      fail('stopContainer() did not report stopped status', JSON.stringify(stopResult));
    }

    const stoppedStatus = await getContainerStatus(provisioned.containerId);
    if (stoppedStatus === 'stopped') {
      ok("Docker confirms container is 'stopped'");
    } else {
      fail(`Expected status 'stopped', got '${stoppedStatus}'`);
    }

    // Verify SSH connection now fails
    const sshClosed = await sshExpectFailure(
      '127.0.0.1',
      provisioned.sshPort,
      provisioned.sshUser,
      provisioned.sshPassword
    );
    if (sshClosed) {
      ok('Verified SSH connection is closed/refused while container is stopped');
    } else {
      fail('SSH unexpectedly still accepted connection after stopContainer()');
    }

    /* ── Step 5: Start Container ─────────────────────────────────── */
    console.log('\n[ 5 ] Restarting container via startContainer()…');
    const startResult = await startContainer(provisioned.containerId);
    if (startResult.status === 'running') {
      ok('startContainer() returned status: running');
    } else {
      fail('startContainer() did not report running status', JSON.stringify(startResult));
    }

    const restartedStatus = await getContainerStatus(provisioned.containerId);
    if (restartedStatus === 'running') {
      ok("Docker confirms container is 'running' again");
    } else {
      fail(`Expected status 'running', got '${restartedStatus}'`);
    }

    /* ── Step 6: Verify Data Persistence ─────────────────────────── */
    console.log('\n[ 6 ] Verifying file persistence across container stop/start…');
    let verifySuccess = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const readResult = await sshExec(
          '127.0.0.1',
          provisioned.sshPort,
          provisioned.sshUser,
          provisioned.sshPassword,
          `cat /home/${testUsername}/test.txt`
        );

        if (readResult.stdout.includes('persistence test')) {
          ok('Persistent volume test PASSED: /home/<user>/test.txt still exists with exact content');
          verifySuccess = true;
          break;
        }
      } catch (err) {
        if (attempt === 5) {
          fail('SSH read after restart failed', err.message);
        } else {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    if (!verifySuccess) {
      fail('Persistent data verification failed');
    }

    /* ── Step 7: Delete Container and Volume Cleanup ─────────────── */
    console.log('\n[ 7 ] Cleaning up test container and volume via deleteContainerAndVolume()…');
    const deleteResult = await deleteContainerAndVolume(
      provisioned.containerId,
      provisioned.volumeName
    );

    if (deleteResult.containerDeleted) {
      ok('Test container successfully removed');
    } else {
      fail('Test container could not be confirmed removed');
    }

    if (deleteResult.volumeDeleted) {
      ok('Test volume successfully removed');
    } else {
      fail('Test volume could not be confirmed removed');
    }

    const postDeleteStatus = await getContainerStatus(provisioned.containerId);
    if (postDeleteStatus === 'not_found') {
      ok("Confirmed container state is now 'not_found'");
    } else {
      fail(`Expected 'not_found', got '${postDeleteStatus}'`);
    }
  } catch (err) {
    fail('Unexpected exception during Checkpoint 4 testing', err.stack || err.message);
  } finally {
    // Failsafe cleanup in case of failure before Step 7
    if (provisioned?.containerId) {
      try {
        await deleteContainerAndVolume(provisioned.containerId, provisioned.volumeName);
      } catch (_) {}
    }
  }

  /* ── Summary ──────────────────────────────────────────────────── */
  console.log('\n──────────────────────────────────────────────────────────');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('──────────────────────────────────────────────────────────\n');

  if (failed > 0) {
    console.error('Checkpoint 4 verification failed.');
    process.exit(1);
  }

  console.log('All Checkpoint 4 checks passed! ✓');
  console.log('Docker Provisioning Engine with Ubuntu + OpenSSH + Persistent Volume is verified.\n');
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
