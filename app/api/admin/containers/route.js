import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import SlotRequest from '@/models/SlotRequest';
import User from '@/models/User';
import { listManagedContainers, docker } from '@/lib/docker';

/**
 * GET /api/admin/containers
 *
 * Admin-only. List all provisioned containers (Running / Stopped),
 * assigned user details, allocated host port, persistent volume name, live status,
 * and associated slot request info.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // 1. Fetch all slot requests that have container details recorded
    const slotRequests = await SlotRequest.find({
      'containerDetails.containerId': { $ne: null },
    }).populate('userId', 'email name role');

    const requestMap = new Map();
    for (const req of slotRequests) {
      if (req.containerDetails?.containerId) {
        requestMap.set(req.containerDetails.containerId, req);
      }
    }

    // 2. Fetch live managed containers from Docker engine
    let dockerContainers = [];
    try {
      dockerContainers = await listManagedContainers();
    } catch (err) {
      console.warn('[api/admin/containers] Warning querying docker containers:', err.message);
    }

    const dockerMap = new Map();
    for (const c of dockerContainers) {
      dockerMap.set(c.Id, c);
      dockerMap.set(c.Id.slice(0, 12), c);
    }

    const containerList = [];
    const processedContainerIds = new Set();

    // 3. Process requests with containers recorded in DB
    for (const req of slotRequests) {
      const details = req.containerDetails || {};
      const cId = details.containerId;
      if (!cId) continue;

      processedContainerIds.add(cId);
      const dockerInfo = dockerMap.get(cId) || dockerMap.get(cId.slice(0, 12));

      let liveStatus = 'stopped';
      let containerName = details.containerName || `container_${cId.slice(0, 8)}`;

      if (dockerInfo) {
        liveStatus = dockerInfo.State === 'running' ? 'running' : 'stopped';
        if (dockerInfo.Names && dockerInfo.Names.length > 0) {
          containerName = dockerInfo.Names[0].replace(/^\//, '');
        }
      } else {
        try {
          const container = docker.getContainer(cId);
          const inspectData = await container.inspect();
          liveStatus = inspectData.State?.Running ? 'running' : 'stopped';
          if (inspectData.Name) {
            containerName = inspectData.Name.replace(/^\//, '');
          }
        } catch {
          liveStatus = 'not_found';
        }
      }

      containerList.push({
        id: cId,
        containerId: cId,
        containerName,
        sshHost: details.sshHost || process.env.SSH_HOST || 'localhost',
        sshPort: details.sshPort,
        sshUser: details.sshUser,
        sshPassword: details.sshPassword,
        volumeName: details.volumeName,
        status: liveStatus,
        slotRequestId: req._id,
        slotTitle: req.title,
        slotPurpose: req.purpose,
        slotStatus: req.status,
        startTime: req.startTime,
        endTime: req.endTime,
        user: req.userId
          ? {
              _id: req.userId._id,
              name: req.userId.name || req.userId.email.split('@')[0],
              email: req.userId.email,
            }
          : null,
        createdAt: req.createdAt,
      });
    }

    // 4. Also check for managed Docker containers that might not be in DB requests map
    for (const dc of dockerContainers) {
      if (processedContainerIds.has(dc.Id) || processedContainerIds.has(dc.Id.slice(0, 12))) {
        continue;
      }

      const labels = dc.Labels || {};
      const userIdStr = labels['access.userId'];

      let userObj = null;
      if (userIdStr) {
        try {
          const u = await User.findById(userIdStr).select('email name role');
          if (u) {
            userObj = { _id: u._id, name: u.name || u.email.split('@')[0], email: u.email };
          }
        } catch {}
      }

      const rawPort = labels['access.port'];
      const sshPort = rawPort ? Number(rawPort) : dc.Ports?.[0]?.PublicPort || null;
      const cName = dc.Names?.[0] ? dc.Names[0].replace(/^\//, '') : dc.Id.slice(0, 12);

      containerList.push({
        id: dc.Id,
        containerId: dc.Id,
        containerName: cName,
        sshHost: process.env.SSH_HOST || 'localhost',
        sshPort,
        sshUser: labels['access.username'] || 'user',
        sshPassword: null,
        volumeName: labels['access.volumeName'] || null,
        status: dc.State === 'running' ? 'running' : 'stopped',
        slotRequestId: null,
        slotTitle: 'Orphaned / Standalone Container',
        slotPurpose: 'Managed host container',
        slotStatus: 'active',
        startTime: null,
        endTime: null,
        user: userObj,
        createdAt: new Date(dc.Created * 1000),
      });
    }

    return NextResponse.json(containerList);
  } catch (error) {
    console.error('Error fetching admin containers:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
