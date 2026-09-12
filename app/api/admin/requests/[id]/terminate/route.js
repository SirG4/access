import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import SlotRequest from '@/models/SlotRequest';
import { stopContainer } from '@/lib/docker';
import { logAuditEvent } from '@/lib/audit';

/**
 * POST /api/admin/requests/[id]/terminate
 *
 * Admin-only: Force terminates an active slot session and immediately stops the container.
 */
export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    let body = {};
    try {
      body = await req.json();
    } catch {}

    const { reason, adminNotes } = body;

    await dbConnect();

    const request = await SlotRequest.findById(id).populate('userId', 'email name role');

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Stop container if currently assigned / running
    if (request.containerDetails?.containerId) {
      try {
        await stopContainer(request.containerDetails.containerId);
        console.log(`[Admin] Force stopped container ${request.containerDetails.containerId.slice(0, 12)} for slot ${id}`);
      } catch (stopErr) {
        console.warn(`[Admin] Warning stopping container during termination: ${stopErr.message}`);
      }
    }

    request.status = 'completed';
    request.adminNotes = [
      request.adminNotes,
      `Terminated early by admin${reason ? `: ${reason}` : ''}${adminNotes ? ` (${adminNotes})` : ''}`,
    ]
      .filter(Boolean)
      .join(' | ');

    await request.save();

    // Record audit event
    await logAuditEvent({
      action: 'SESSION_FORCE_TERMINATED',
      userId: request.userId?._id,
      performedBy: session.user.email || session.user.id,
      details: {
        slotId: request._id,
        containerId: request.containerDetails?.containerId,
        reason: reason || 'Admin force termination',
      },
      req,
    });

    return NextResponse.json(request);
  } catch (error) {
    console.error('Error terminating slot request:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
