import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import SlotRequest from '@/models/SlotRequest';
import {
  getSchedulerStatus,
  startScheduler,
  stopScheduler,
  processSlotLifecycle,
} from '@/lib/scheduler';

/**
 * GET /api/admin/scheduler
 *
 * Admin-only. Query scheduler state, active slot count, and active requests.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const schedulerState = getSchedulerStatus();
    const activeCount = await SlotRequest.countDocuments({ status: 'active' });
    const approvedCount = await SlotRequest.countDocuments({ status: 'approved' });
    const activeRequests = await SlotRequest.find({ status: 'active' })
      .populate('userId', 'email name role')
      .sort({ startTime: 1 });

    return NextResponse.json({
      scheduler: schedulerState,
      counts: {
        active: activeCount,
        approved: approvedCount,
      },
      activeRequests,
    });
  } catch (error) {
    console.error('Error fetching scheduler status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/scheduler
 *
 * Admin-only. Trigger lifecycle processing or control background timer.
 *
 * Body:
 *   { action: 'tick' | 'start' | 'stop', intervalMs?: number }
 */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { action = 'tick', intervalMs } = body;

    let result = null;

    if (action === 'tick') {
      result = await processSlotLifecycle();
    } else if (action === 'start') {
      result = startScheduler({
        intervalMs: intervalMs ? Number(intervalMs) : undefined,
      });
    } else if (action === 'stop') {
      result = stopScheduler();
    } else {
      return NextResponse.json(
        { error: `Invalid action '${action}'. Must be 'tick', 'start', or 'stop'.` },
        { status: 400 }
      );
    }

    const currentState = getSchedulerStatus();

    return NextResponse.json({
      success: true,
      action,
      result,
      scheduler: currentState,
    });
  } catch (error) {
    console.error('Error controlling scheduler:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
