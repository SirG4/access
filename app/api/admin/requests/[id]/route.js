import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import SlotRequest from '@/models/SlotRequest';

/**
 * PATCH /api/admin/requests/[id]
 *
 * Admin-only. Update the status of a slot request.
 *
 * Body:
 *   { status: 'approved' | 'rejected', rejectionReason?: string, adminNotes?: string }
 *
 * Returns the updated SlotRequest document (populated with userId email).
 */
export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const body = await req.json();
    const { status, rejectionReason, adminNotes } = body;

    // Validate status value
    const allowedStatuses = ['approved', 'rejected'];
    if (!status || !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Rejection requires a reason
    if (status === 'rejected' && (!rejectionReason || !rejectionReason.trim())) {
      return NextResponse.json(
        { error: 'A rejection reason is required when rejecting a request.' },
        { status: 400 }
      );
    }

    await dbConnect();

    const request = await SlotRequest.findById(id);

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Only allow transitioning from 'pending'
    if (request.status !== 'pending') {
      return NextResponse.json(
        {
          error: `Cannot update a request with status '${request.status}'. Only 'pending' requests can be approved or rejected.`,
        },
        { status: 409 }
      );
    }

    request.status = status;
    if (rejectionReason) request.rejectionReason = rejectionReason.trim();
    if (adminNotes) request.adminNotes = adminNotes.trim();

    await request.save();

    // Log audit event
    const { logAuditEvent } = await import('@/lib/audit');
    await logAuditEvent({
      action: status === 'approved' ? 'REQUEST_APPROVED' : 'REQUEST_REJECTED',
      userId: request.userId,
      performedBy: session.user.email || session.user.id,
      details: {
        slotId: request._id,
        title: request.title,
        status,
        rejectionReason: rejectionReason || null,
      },
      req,
    });

    // Return populated document
    const updated = await SlotRequest.findById(id).populate('userId', 'email name role');

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating slot request:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/requests/[id]
 *
 * Admin-only. Fetch a single slot request by ID.
 */
export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await dbConnect();

    const request = await SlotRequest.findById(id).populate('userId', 'email name role');

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    return NextResponse.json(request);
  } catch (error) {
    console.error('Error fetching slot request:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
