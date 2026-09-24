import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import SlotRequest from '@/models/SlotRequest';
import { updateContainerLimits, inspectContainer } from '@/lib/docker';

/**
 * PATCH /api/admin/containers/[id]/limits
 *
 * Admin-only. Change resource hard limits (RAM limit, GPU RAM limit, Storage limit)
 * for a specific container. Target `id` can be a container ID or a SlotRequest ID.
 */
export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Container ID is required' }, { status: 400 });
    }

    const body = await req.json();
    const { ramLimitGB, gpuRamLimitGB, storageLimitGB } = body;

    if (
      (ramLimitGB !== undefined && (isNaN(ramLimitGB) || ramLimitGB <= 0)) ||
      (gpuRamLimitGB !== undefined && (isNaN(gpuRamLimitGB) || gpuRamLimitGB <= 0)) ||
      (storageLimitGB !== undefined && (isNaN(storageLimitGB) || storageLimitGB <= 0))
    ) {
      return NextResponse.json(
        { error: 'Resource limits must be valid positive numbers in GB' },
        { status: 400 }
      );
    }

    await dbConnect();

    let targetContainerId = id;
    let slotRequest = null;

    // 1. Resolve container ID if `id` is a SlotRequest ObjectId
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      slotRequest = await SlotRequest.findById(id);
      if (slotRequest?.containerDetails?.containerId) {
        targetContainerId = slotRequest.containerDetails.containerId;
      }
    }

    if (!slotRequest) {
      slotRequest = await SlotRequest.findOne({ 'containerDetails.containerId': targetContainerId });
    }

    // 2. Perform limits update on Docker container & DB
    const result = await updateContainerLimits(targetContainerId, {
      ramLimitGB,
      gpuRamLimitGB,
      storageLimitGB,
    });

    // 3. Log audit event
    const { logAuditEvent } = await import('@/lib/audit');
    await logAuditEvent({
      action: 'CONTAINER_LIMITS_UPDATED',
      userId: slotRequest?.userId,
      performedBy: session.user.email || session.user.id,
      details: {
        containerId: targetContainerId,
        ramLimitGB: result.ramLimitGB,
        gpuRamLimitGB: result.gpuRamLimitGB,
        storageLimitGB: result.storageLimitGB,
        slotId: slotRequest?._id,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      containerId: targetContainerId,
      ramLimitGB: result.ramLimitGB,
      gpuRamLimitGB: result.gpuRamLimitGB,
      storageLimitGB: result.storageLimitGB,
      message: 'Container resource limits updated successfully',
    });
  } catch (error) {
    console.error('Error updating container resource limits:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update container resource limits' },
      { status: 500 }
    );
  }
}
