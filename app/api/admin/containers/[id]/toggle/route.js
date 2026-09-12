import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import SlotRequest from '@/models/SlotRequest';
import { startContainer, stopContainer, getContainerStatus } from '@/lib/docker';

/**
 * POST /api/admin/containers/[id]/toggle
 *
 * Admin-only. Manually toggle container state between running and stopped.
 * Target `id` can be a container ID or a SlotRequest ID.
 *
 * Body (optional):
 *   { action?: "start" | "stop" | "toggle" }
 */
export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Container ID is required' }, { status: 400 });
    }

    await dbConnect();

    // Check if ID matches a SlotRequest
    let targetContainerId = id;
    let slotRequest = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      slotRequest = await SlotRequest.findById(id);
      if (slotRequest?.containerDetails?.containerId) {
        targetContainerId = slotRequest.containerDetails.containerId;
      }
    }

    if (!targetContainerId) {
      return NextResponse.json({ error: 'No associated container found' }, { status: 404 });
    }

    let body = {};
    try {
      body = await req.json();
    } catch {
      // Body may be empty, default to 'toggle'
    }

    const currentStatus = await getContainerStatus(targetContainerId);
    let requestedAction = body.action || 'toggle';

    if (requestedAction === 'toggle') {
      requestedAction = currentStatus === 'running' ? 'stop' : 'start';
    }

    let newStatus = currentStatus;

    if (requestedAction === 'start') {
      await startContainer(targetContainerId);
      newStatus = 'running';
    } else if (requestedAction === 'stop') {
      await stopContainer(targetContainerId);
      newStatus = 'stopped';
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "start", "stop", or "toggle"' },
        { status: 400 }
      );
    }

    const { logAuditEvent } = await import('@/lib/audit');
    await logAuditEvent({
      action: requestedAction === 'start' ? 'CONTAINER_FORCE_STARTED' : 'CONTAINER_FORCE_STOPPED',
      userId: slotRequest?.userId,
      performedBy: session.user.email || session.user.id,
      details: {
        containerId: targetContainerId,
        action: requestedAction,
        slotId: slotRequest?._id,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      containerId: targetContainerId,
      status: newStatus,
      message: `Container state updated to ${newStatus}`,
    });
  } catch (error) {
    console.error('Error toggling container state:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to toggle container state' },
      { status: 500 }
    );
  }
}
