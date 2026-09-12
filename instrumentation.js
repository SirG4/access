export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only run in Node.js server environment (not Edge or client)
    const { startScheduler } = await import('@/lib/scheduler');
    // Start scheduler with default interval (30s) or SCHEDULER_INTERVAL_MS env var
    startScheduler();
  }
}
