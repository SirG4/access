import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import SlotRequest from '@/models/SlotRequest';
import { deleteContainerAndVolume, inspectContainer } from '@/lib/docker';

/**
 * DELETE /api/admin/containers/[id]
 *
 * Admin-only. Delete a Docker container and permanently remove its associated
 * persistent storage volume. Target `id` can be a container ID or a SlotRequest ID.
 */
export async function DELETE(req, { params }) {
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

    let targetContainerId = id;
    let targetVolumeName = null;
    let slotRequest = null;

    // Check if ID matches a Mongoose ObjectId for SlotRequest
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      slotRequest = await SlotRequest.findById(id);
      if (slotRequest) {
        targetContainerId = slotRequest.containerDetails?.containerId || id;
        targetVolumeName = slotRequest.containerDetails?.volumeName || null;
      }
    }

    // If slotRequest was not found by ID or if targetVolumeName was missing, check SlotRequest by containerId
    if (!slotRequest && targetContainerId) {
      slotRequest = await SlotRequest.findOne({ 'containerDetails.containerId': targetContainerId });
      if (slotRequest) {
        targetVolumeName = slotRequest.containerDetails?.volumeName || targetVolumeName;
      }
    }

    // Inspect container on host if volumeName is still unknown
    if (targetContainerId && !targetVolumeName) {
      try {
        const inspectData = await inspectContainer(targetContainerId);
        if (inspectData) {
          const volumeBind = inspectData.HostConfig?.Binds?.[0];
          if (volumeBind) {
            targetVolumeName = volumeBind.split(':')[0];
          }
          const volLabel = inspectData.Config?.Labels?.['access.volumeName'];
          if (volLabel) targetVolumeName = volLabel;
        }
      } catch {}
    }

    // Perform container and volume deletion on Docker host
    const result = await deleteContainerAndVolume(targetContainerId, targetVolumeName);

    // If associated SlotRequest exists, update state
    if (slotRequest) {
      if (slotRequest.status === 'active') {
        slotRequest.status = 'completed';
      }
      slotRequest.adminNotes = (slotRequest.adminNotes ? slotRequest.adminNotes + ' | ' : '') +
        `Container and volume deleted by admin on ${new Date().toISOString()}`;

      // Reset container details
      slotRequest.containerDetails = {
        containerId: null,
        containerName: null,
        sshHost: null,
        sshPort: null,
        sshUser: null,
        sshPassword: null,
        volumeName: null,
      };

      await slotRequest.save();
    }

    const { logAuditEvent } = await import('@/lib/audit');
    await logAuditEvent({
      action: 'CONTAINER_DELETED',
      userId: slotRequest?.userId,
      performedBy: session.user.email || session.user.id,
      details: {
        containerId: targetContainerId,
        volumeName: targetVolumeName,
        containerDeleted: result.containerDeleted,
        volumeDeleted: result.volumeDeleted,
        slotId: slotRequest?._id,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      containerDeleted: result.containerDeleted,
      volumeDeleted: result.volumeDeleted,
      message: 'Container and persistent volume permanently deleted.',
    });
  } catch (error) {
    console.error('Error deleting container and volume:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete container and storage volume' },
      { status: 500 }
    );
  }
}
