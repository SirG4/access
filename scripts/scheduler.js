#!/usr/bin/env node
/**
 * scripts/scheduler.js
 *
 * Standalone background scheduler daemon for Supercomputer Access.
 * Monitors slot requests, starts/provisions containers at slot start times,
 * and gracefully stops containers at slot end times.
 *
 * Usage:
 *   node scripts/scheduler.js
 *   node scripts/scheduler.js --interval 15
 *   node scripts/scheduler.js --once
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

// Parse command-line flags
const args = process.argv.slice(2);
let intervalSec = 30;
let runOnce = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--interval' && args[i + 1]) {
    intervalSec = Number(args[i + 1]) || 30;
    i++;
  } else if (args[i] === '--once') {
    runOnce = true;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('   Supercomputer Access — Container Lifecycle Scheduler');
  console.log('='.repeat(60));

  // Dynamic import for ES modules
  const { default: dbConnect } = await import('../lib/mongodb.js');
  const {
    processSlotLifecycle,
    startScheduler,
    stopScheduler,
    getSchedulerStatus,
  } = await import('../lib/scheduler.js');

  console.log('[Init] Connecting to MongoDB...');
  await dbConnect();
  console.log('[Init] MongoDB connected.');

  if (runOnce) {
    console.log('[Scheduler] Executing single lifecycle tick (--once)...');
    const result = await processSlotLifecycle();
    console.log('[Scheduler] Lifecycle result:', JSON.stringify(result, null, 2));
    process.exit(0);
  }

  const intervalMs = intervalSec * 1000;
  startScheduler({ intervalMs, runImmediately: true });
  console.log(`[Scheduler] Daemon running. Polling interval: ${intervalSec}s.`);
  console.log('[Scheduler] Press Ctrl+C to terminate cleanly.');

  // Handle graceful termination
  function shutdown(signal) {
    console.log(`\n[Scheduler] Received ${signal}. Shutting down cleanly...`);
    stopScheduler();
    setTimeout(() => {
      console.log('[Scheduler] Exiting.');
      process.exit(0);
    }, 500);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Keep node process alive
  setInterval(() => {}, 60000);
}

main().catch((err) => {
  console.error('[Scheduler] Fatal error:', err);
  process.exit(1);
});
