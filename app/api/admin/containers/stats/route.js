import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { listManagedContainers, getContainerLiveStats } from '@/lib/docker';
import SlotRequest from '@/models/SlotRequest';
import dbConnect from '@/lib/mongodb';

/**
 * GET /api/admin/containers/stats
 *
 * Admin-only. Query live RAM, GPU RAM, and Storage metrics for managed containers.
 * Query params: ?id=<containerId> (optional)
 */
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const containerIdParam = searchParams.get('id');

    if (containerIdParam) {
      const stats = await getContainerLiveStats(containerIdParam);
      if (!stats) {
        return NextResponse.json({ error: 'Container stats unavailable' }, { status: 404 });
      }
      return NextResponse.json(stats);
    }

    // Otherwise, fetch stats for all running containers
    await dbConnect();

    // 1. Get managed containers from Docker engine
    let containers = [];
    try {
      containers = await listManagedContainers();
    } catch (err) {
      console.warn('[api/admin/containers/stats] Warning querying containers:', err.message);
    }

    const runningContainers = containers.filter((c) => c.State === 'running');
    const statsMap = {};

    await Promise.all(
      runningContainers.map(async (c) => {
        try {
          const stats = await getContainerLiveStats(c.Id);
          if (stats) {
            statsMap[c.Id] = stats;
            // Also index by 12-char short ID for UI flexibility
            statsMap[c.Id.slice(0, 12)] = stats;
          }
        } catch (e) {
          console.warn(`[api/admin/containers/stats] Error getting stats for ${c.Id}:`, e.message);
        }
      })
    );

    return NextResponse.json(statsMap);
  } catch (error) {
    console.error('Error fetching admin container stats:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
