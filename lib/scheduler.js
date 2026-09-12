import dbConnect from './mongodb.js';
import SlotRequest from '../models/SlotRequest.js';
import User from '../models/User.js';
import { logAuditEvent } from './audit.js';
import {
  provisionContainer,
  startContainer,
  stopContainer,
  getContainerStatus,
  listManagedContainers,
  broadcastMessage,
} from './docker.js';

// Global singleton keys to prevent multiple timers during Next.js hot-reloads
const GLOBAL_SCHEDULER_KEY = '__access_scheduler_state__';

if (!global[GLOBAL_SCHEDULER_KEY]) {
  global[GLOBAL_SCHEDULER_KEY] = {
    timer: null,
    intervalMs: 30000,
    running: false,
    isProcessing: false,
    lastRunTime: null,
    lastResult: null,
  };
}

const state = global[GLOBAL_SCHEDULER_KEY];

/**
 * Process a single lifecycle tick:
 * 1. Activate approved slots where currentTime >= startTime and currentTime < endTime
 * 2. Stop containers and complete active slots where currentTime >= endTime
 * 3. Handle expired approved slots where currentTime >= endTime
 *
 * @param {Object} [options]
 * @param {Date} [options.now] - Current time override (for testing)
 * @returns {Promise<Object>} Execution result summary
 */
export async function processSlotLifecycle({ now = new Date() } = {}) {
  if (state.isProcessing) {
    return {
      status: 'skipped',
      reason: 'Previous lifecycle execution still in progress',
      timestamp: now.toISOString(),
    };
  }

  state.isProcessing = true;
  const startTime = Date.now();
  const results = {
    timestamp: now.toISOString(),
    activated: [],
    completed: [],
    expired: [],
    errors: [],
  };

  try {
    await dbConnect();

    // -------------------------------------------------------------
    // 1. SLOT START HANDLER
    // -------------------------------------------------------------
    const approvedSlots = await SlotRequest.find({
      status: 'approved',
      startTime: { $lte: now },
    }).populate('userId');

    for (const slot of approvedSlots) {
      try {
        // If the window has already passed entirely, mark completed directly
        if (new Date(slot.endTime) <= now) {
          slot.status = 'completed';
          slot.adminNotes = (slot.adminNotes ? slot.adminNotes + ' | ' : '') + 'Slot window expired before activation';
          await slot.save();
          results.expired.push({
            id: slot._id.toString(),
            title: slot.title,
            startTime: slot.startTime,
            endTime: slot.endTime,
          });
          console.log(`[Scheduler] Marked expired slot ${slot._id} as completed`);
          continue;
        }

        const user = slot.userId;
        const userId = (user?._id || slot.userId).toString();
        const username = user?.email ? user.email.split('@')[0] : `user_${userId}`;

        let details = slot.containerDetails;
        let started = false;

        // A. If container is already assigned to this request, check status & start
        if (details && details.containerId) {
          try {
            const containerStatus = await getContainerStatus(details.containerId);
            if (containerStatus === 'running') {
              started = true;
            } else if (containerStatus === 'stopped') {
              await startContainer(details.containerId);
              started = true;
            } else {
              // Container not found on host, clear details to trigger re-provision
              details = null;
            }
          } catch (err) {
            console.warn(`[Scheduler] Could not restart assigned container ${details.containerId}: ${err.message}`);
            details = null;
          }
        }

        // B. If not assigned, check if user has an existing stopped managed container to reuse
        if (!started) {
          try {
            const managed = await listManagedContainers();
            const match = managed.find(
              (c) => c.Labels && c.Labels['access.userId'] === userId
            );

            if (match) {
              try {
                const status = await getContainerStatus(match.Id);
                if (status === 'stopped') {
                  await startContainer(match.Id);
                }
                const port = match.Labels?.['access.port']
                  ? Number(match.Labels['access.port'])
                  : (slot.containerDetails?.sshPort || 2222);
                const sshUser = match.Labels?.['access.username'] || username;
                const volumeName = match.Labels?.['access.volumeName'] || `vol_access_user_${userId}`;

                // Try retrieving existing password from current or previous slot
                let sshPassword = slot.containerDetails?.sshPassword;
                if (!sshPassword) {
                  const prev = await SlotRequest.findOne({
                    userId,
                    'containerDetails.sshPassword': { $exists: true, $ne: null },
                  }).sort({ createdAt: -1 });
                  if (prev?.containerDetails?.sshPassword) {
                    sshPassword = prev.containerDetails.sshPassword;
                  }
                }

                details = {
                  containerId: match.Id,
                  containerName: match.Names?.[0]?.replace(/^\//, '') || `access_user_${sshUser}`,
                  sshHost: process.env.SSH_HOST || 'localhost',
                  sshPort: port,
                  sshUser,
                  sshPassword: sshPassword || 'GeneratedKeyAccess',
                  volumeName,
                };
                started = true;
              } catch (startErr) {
                console.warn(`[Scheduler] Failed to restart existing user container ${match.Id}: ${startErr.message}. Will provision new.`);
                started = false;
              }
            }
          } catch (listErr) {
            console.warn(`[Scheduler] Error inspecting user containers: ${listErr.message}`);
          }
        }

        // C. Provision new container if not already running or restarted
        if (!started || !details) {
          const provisionResult = await provisionContainer({
            userId,
            username,
            autoStart: true,
          });

          details = {
            containerId: provisionResult.containerId,
            containerName: provisionResult.containerName,
            sshHost: provisionResult.sshHost,
            sshPort: provisionResult.sshPort,
            sshUser: provisionResult.sshUser,
            sshPassword: provisionResult.sshPassword,
            volumeName: provisionResult.volumeName,
          };
        }

        // Save container details and transition status to active
        slot.containerDetails = details;
        slot.status = 'active';
        await slot.save();

        // Record audit event for session activation
        await logAuditEvent({
          action: 'SESSION_ACTIVATED',
          userId,
          performedBy: 'scheduler',
          details: {
            slotId: slot._id,
            containerId: details.containerId,
            sshPort: details.sshPort,
            sshUser: details.sshUser,
            title: slot.title,
          },
        });

        console.log(
          `[Scheduler] Activated slot ${slot._id} for user ${user?.email || userId} (Port: ${details.sshPort}, Container: ${details.containerId.slice(0, 12)})`
        );

        results.activated.push({
          id: slot._id.toString(),
          userId,
          port: details.sshPort,
          containerId: details.containerId,
          sshUser: details.sshUser,
        });
      } catch (slotErr) {
        console.error(`[Scheduler] Error activating slot ${slot._id}:`, slotErr);
        results.errors.push({
          slotId: slot._id.toString(),
          action: 'activate',
          error: slotErr.message,
        });
      }
    }

    // -------------------------------------------------------------
    // 2. SLOT END HANDLER (and 10-minute warning)
    // -------------------------------------------------------------
    const tenMinsFromNow = new Date(now.getTime() + 10 * 60 * 1000);
    const endingSlots = await SlotRequest.find({
      status: 'active',
      endTime: { $lte: tenMinsFromNow },
    });

    for (const slot of endingSlots) {
      try {
        if (new Date(slot.endTime) <= now) {
          // Slot has actually ended
          if (slot.containerDetails?.containerId) {
            try {
              await stopContainer(slot.containerDetails.containerId);
              console.log(
                `[Scheduler] Stopped container ${slot.containerDetails.containerId.slice(0, 12)} for completed slot ${slot._id}`
              );
            } catch (stopErr) {
              console.warn(
                `[Scheduler] Warning stopping container for slot ${slot._id}: ${stopErr.message}`
              );
            }
          }

          slot.status = 'completed';
          await slot.save();

          // Record audit event for session completion
          await logAuditEvent({
            action: 'SESSION_COMPLETED',
            userId: slot.userId,
            performedBy: 'scheduler',
            details: {
              slotId: slot._id,
              containerId: slot.containerDetails?.containerId || null,
              title: slot.title,
            },
          });

          console.log(`[Scheduler] Marked slot ${slot._id} as completed`);
          results.completed.push({
            id: slot._id.toString(),
            containerId: slot.containerDetails?.containerId || null,
          });
        } else {
          // Slot is ending within 10 minutes, but hasn't ended yet
          if (!slot.warningSent) {
            if (slot.containerDetails?.containerId) {
              try {
                await broadcastMessage(
                  slot.containerDetails.containerId, 
                  "WARNING: Your session will end in less than 10 minutes. Please save your work. The container will automatically shut down."
                );
                slot.warningSent = true;
                await slot.save();
                console.log(`[Scheduler] Sent 10-minute warning to container ${slot.containerDetails.containerId.slice(0, 12)} for slot ${slot._id}`);
              } catch (err) {
                console.warn(`[Scheduler] Could not send warning: ${err.message}`);
              }
            }
          }
        }
      } catch (endErr) {
        console.error(`[Scheduler] Error processing slot ${slot._id} in end handler:`, endErr);
        results.errors.push({
          slotId: slot._id.toString(),
          action: 'end_handler',
          error: endErr.message,
        });
      }
    }
  } catch (globalErr) {
    console.error('[Scheduler] Fatal error in lifecycle execution:', globalErr);
    results.errors.push({ action: 'global', error: globalErr.message });
  } finally {
    state.isProcessing = false;
    state.lastRunTime = new Date().toISOString();
    state.lastResult = {
      ...results,
      durationMs: Date.now() - startTime,
    };
  }

  return state.lastResult;
}

/**
 * Re-sync and reconcile running Docker host containers with database statuses (Server Restart Recovery)
 *
 * Checks:
 * 1. Active slots whose time has passed -> stops container, marks completed.
 * 2. Active slots whose time is valid -> ensures container is running; if stopped, restarts it.
 * 3. Orphaned running containers -> stops containers with no matching active DB slot.
 *
 * @param {Object} [options]
 * @param {Date} [options.now]
 * @returns {Promise<Object>} Recovery synchronization summary
 */
export async function syncContainerStates({ now = new Date() } = {}) {
  await dbConnect();
  const summary = {
    restarted: [],
    stoppedExpired: [],
    stoppedOrphaned: [],
    errors: [],
  };

  try {
    const activeSlots = await SlotRequest.find({ status: 'active' });
    const activeContainerIds = new Set();
    const activeUserIds = new Set();

    for (const slot of activeSlots) {
      const containerId = slot.containerDetails?.containerId;
      const userId = slot.userId?.toString();
      if (containerId) activeContainerIds.add(containerId);
      if (userId) activeUserIds.add(userId);

      // Check if slot has expired
      if (new Date(slot.endTime) <= now) {
        if (containerId) {
          try {
            await stopContainer(containerId);
          } catch (e) {
            console.warn(`[Recovery] Warning stopping expired container ${containerId}: ${e.message}`);
          }
        }
        slot.status = 'completed';
        await slot.save();
        summary.stoppedExpired.push({ slotId: slot._id, containerId });
      } else if (new Date(slot.startTime) <= now) {
        // Active slot should have running container
        if (containerId) {
          try {
            const status = await getContainerStatus(containerId);
            if (status === 'stopped') {
              await startContainer(containerId);
              summary.restarted.push({ slotId: slot._id, containerId });
              console.log(`[Recovery] Restored running state for container ${containerId.slice(0, 12)} on slot ${slot._id}`);
            }
          } catch (err) {
            console.warn(`[Recovery] Could not restart active container ${containerId}: ${err.message}`);
          }
        }
      }
    }

    // Inspect Docker host for orphaned running containers
    try {
      const managed = await listManagedContainers();
      for (const c of managed) {
        if (c.State === 'running') {
          const containerUserId = c.Labels?.['access.userId'];
          const isAssigned = activeContainerIds.has(c.Id) || (containerUserId && activeUserIds.has(containerUserId));
          if (!isAssigned) {
            try {
              await stopContainer(c.Id);
              summary.stoppedOrphaned.push({ containerId: c.Id, name: c.Names?.[0] });
              console.log(`[Recovery] Stopped orphaned managed container ${c.Id.slice(0, 12)}`);
            } catch (orphanErr) {
              console.warn(`[Recovery] Failed stopping orphan ${c.Id}: ${orphanErr.message}`);
            }
          }
        }
      }
    } catch (listErr) {
      console.warn(`[Recovery] Warning listing host containers: ${listErr.message}`);
    }

    if (summary.restarted.length || summary.stoppedExpired.length || summary.stoppedOrphaned.length) {
      await logAuditEvent({
        action: 'SYSTEM_SYNC_RECOVERY',
        performedBy: 'system',
        details: summary,
      });
    }
  } catch (err) {
    console.error('[Recovery] Error syncing container states:', err);
    summary.errors.push(err.message);
  }

  return summary;
}

/**
 * Start the background polling timer
 *
 * @param {Object} [options]
 * @param {number} [options.intervalMs=30000] - Polling interval in ms
 * @param {boolean} [options.runImmediately=true] - Whether to trigger an immediate tick on start
 * @returns {Object} Scheduler status
 */
export function startScheduler({
  intervalMs = Number(process.env.SCHEDULER_INTERVAL_MS) || 30000,
  runImmediately = true,
} = {}) {
  if (state.running) {
    console.log(`[Scheduler] Background scheduler is already running (interval: ${state.intervalMs}ms)`);
    return getSchedulerStatus();
  }

  state.intervalMs = intervalMs;
  state.running = true;

  console.log(`[Scheduler] Starting background scheduler (polling every ${intervalMs / 1000}s)`);

  if (runImmediately) {
    // Run recovery sync and then slot lifecycle tick
    syncContainerStates()
      .then(() => processSlotLifecycle())
      .catch((err) => {
        console.error('[Scheduler] Initial startup error:', err);
      });
  }

  state.timer = setInterval(() => {
    processSlotLifecycle().catch((err) => {
      console.error('[Scheduler] Scheduled tick error:', err);
    });
  }, intervalMs);

  // Allow Node process to exit gracefully if only this timer is running
  if (state.timer.unref) {
    state.timer.unref();
  }

  return getSchedulerStatus();
}

/**
 * Stop the background polling timer
 *
 * @returns {Object} Scheduler status
 */
export function stopScheduler() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  state.running = false;
  console.log('[Scheduler] Background scheduler stopped');
  return getSchedulerStatus();
}

/**
 * Retrieve the current scheduler status and statistics
 *
 * @returns {Object} Scheduler status
 */
export function getSchedulerStatus() {
  return {
    running: state.running,
    intervalMs: state.intervalMs,
    isProcessing: state.isProcessing,
    lastRunTime: state.lastRunTime,
    lastResult: state.lastResult,
  };
}

const scheduler = {
  processSlotLifecycle,
  syncContainerStates,
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
};

export default scheduler;
