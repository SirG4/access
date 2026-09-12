import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import SlotRequest from '@/models/SlotRequest';
import { stopContainer } from '@/lib/docker';
import { logAuditEvent } from '@/lib/audit';

/**
 * POST /api/requests/[id]/cancel or PATCH /api/requests/[id]/cancel
 *
 * Allows a user (or admin) to cancel their slot request.
 */
async function handleCancel(req, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await dbConnect();

    const request = await SlotRequest.findById(id);

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Permission check: User can only cancel their own request, unless admin
    const isOwner = request.userId.toString() === session.user.id;
    const isAdmin = session.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Allow cancellation of pending or approved requests
    if (['completed', 'cancelled', 'rejected'].includes(request.status)) {
      return NextResponse.json(
        { error: `Cannot cancel a request that is already ${request.status}` },
        { status: 400 }
      );
    }

    // If container was started or provisioned, stop it safely
    if (request.containerDetails?.containerId) {
      try {
        await stopContainer(request.containerDetails.containerId);
      } catch (err) {
        console.warn(`[Cancel] Warning stopping container on cancel: ${err.message}`);
      }
    }

    request.status = 'cancelled';
    await request.save();

    // Log audit event
    await logAuditEvent({
      action: 'REQUEST_CANCELLED',
      userId: request.userId,
      performedBy: session.user.email || session.user.id,
      details: {
        slotId: request._id,
        title: request.title,
        startTime: request.startTime,
        endTime: request.endTime,
      },
      req,
    });

    return NextResponse.json(request);
  } catch (error) {
    console.error('Error cancelling slot request:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export const POST = handleCancel;
export const PATCH = handleCancel;
