import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import SlotRequest from '@/models/SlotRequest';
import { stopContainer } from '@/lib/docker';
import { logAuditEvent } from '@/lib/audit';

/**
 * GET /api/requests/[id]
 */
export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await dbConnect();

    const request = await SlotRequest.findById(id).populate('userId', 'email name role');
    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (request.userId._id.toString() !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(request);
  } catch (error) {
    console.error('Error fetching request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/requests/[id] - Allows cancellation by owner
 */
export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    await dbConnect();
    const request = await SlotRequest.findById(id);
    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const isOwner = request.userId.toString() === session.user.id;
    const isAdmin = session.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (body.status === 'cancelled') {
      if (['completed', 'cancelled', 'rejected'].includes(request.status)) {
        return NextResponse.json(
          { error: `Cannot cancel a request that is already ${request.status}` },
          { status: 400 }
        );
      }

      if (request.containerDetails?.containerId) {
        try {
          await stopContainer(request.containerDetails.containerId);
        } catch (err) {
          console.warn(`[Cancel] Warning stopping container: ${err.message}`);
        }
      }

      request.status = 'cancelled';
      await request.save();

      await logAuditEvent({
        action: 'REQUEST_CANCELLED',
        userId: request.userId,
        performedBy: session.user.email || session.user.id,
        details: { slotId: request._id, title: request.title },
        req,
      });

      return NextResponse.json(request);
    }

    return NextResponse.json({ error: 'Unsupported update operation' }, { status: 400 });
  } catch (error) {
    console.error('Error updating request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
