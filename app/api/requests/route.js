import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import SlotRequest from '@/models/SlotRequest';
import User from '@/models/User';
import { processSlotLifecycle } from '@/lib/scheduler';

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    await processSlotLifecycle().catch((err) => console.error('Scheduler tick error:', err));

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let query = {};

    if (session.user.role === 'admin') {
      // Admin can view all requests or filter by user/status
      const userId = searchParams.get('userId');
      if (userId) {
        query.userId = userId;
      }
      if (status) {
        query.status = status;
      }

      const requests = await SlotRequest.find(query)
        .populate('userId', 'email role provider')
        .sort({ createdAt: -1 });

      return NextResponse.json(requests);
    } else {
      // Normal user can only view their own requests
      query.userId = session.user.id;
      if (status) {
        query.status = status;
      }

      const requests = await SlotRequest.find(query).sort({ createdAt: -1 });

      return NextResponse.json({ requests });
    }
  } catch (error) {
    console.error('Error fetching slot requests:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, purpose, startTime, endTime } = body;

    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: 'Start time and end time are required' },
        { status: 400 }
      );
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Invalid start or end date format' },
        { status: 400 }
      );
    }

    if (start >= end) {
      return NextResponse.json(
        { error: 'End time must be after start time' },
        { status: 400 }
      );
    }

    // 1-minute buffer to accommodate client-server clock variances
    const nowWithBuffer = new Date(Date.now() - 60 * 1000);
    if (start < nowWithBuffer) {
      return NextResponse.json(
        { error: 'Start time must be in the future' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Collision Check: Overlaps occur when existing.startTime < newEnd AND existing.endTime > newStart
    const collidingSlot = await SlotRequest.findOne({
      status: { $in: ['pending', 'approved', 'active'] },
      startTime: { $lt: end },
      endTime: { $gt: start },
    });

    if (collidingSlot) {
      return NextResponse.json(
        {
          error: 'The requested time slot overlaps with an existing booking or pending request',
          collision: {
            id: collidingSlot._id,
            startTime: collidingSlot.startTime,
            endTime: collidingSlot.endTime,
            status: collidingSlot.status,
          },
        },
        { status: 409 }
      );
    }

    const newRequest = await SlotRequest.create({
      userId: session.user.id,
      title: title?.trim() || purpose?.trim() || 'Supercomputer Access Slot',
      purpose: purpose?.trim() || title?.trim() || '',
      startTime: start,
      endTime: end,
      status: 'pending',
    });

    // Record audit event
    const { logAuditEvent } = await import('@/lib/audit');
    await logAuditEvent({
      action: 'REQUEST_CREATED',
      userId: session.user.id,
      performedBy: session.user.email || session.user.id,
      details: {
        slotId: newRequest._id,
        title: newRequest.title,
        startTime: newRequest.startTime,
        endTime: newRequest.endTime,
      },
      req,
    });

    return NextResponse.json(newRequest, { status: 201 });
  } catch (error) {
    console.error('Error creating slot request:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
