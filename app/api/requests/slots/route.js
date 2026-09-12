import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import SlotRequest from '@/models/SlotRequest';
import { processSlotLifecycle } from '@/lib/scheduler';

export async function GET(req) {
  try {
    await dbConnect();
    await processSlotLifecycle().catch((err) => console.error('Scheduler tick error:', err));

    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const status = searchParams.get('status');

    let query = {
      status: status ? status : { $in: ['pending', 'approved', 'active'] },
    };

    // If date range is specified, match any overlapping slots
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);

      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        query.startTime = { $lt: endDate };
        query.endTime = { $gt: startDate };
      }
    } else if (start) {
      const startDate = new Date(start);
      if (!isNaN(startDate.getTime())) {
        query.endTime = { $gte: startDate };
      }
    }

    const slots = await SlotRequest.find(query)
      .select('_id title purpose startTime endTime status userId')
      .populate('userId', 'email')
      .sort({ startTime: 1 });

    return NextResponse.json(slots);
  } catch (error) {
    console.error('Error fetching calendar slots:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
