import dbConnect from './mongodb.js';
import AuditLog from '../models/AuditLog.js';

/**
 * Log an audit event safely without crashing caller if DB or logging fails
 *
 * @param {Object} params
 * @param {string} params.action - Action identifier (e.g. 'REQUEST_CREATED', 'REQUEST_CANCELLED')
 * @param {string|mongoose.Types.ObjectId} [params.userId] - Affected user or target ID
 * @param {string} [params.performedBy] - Email, user ID or 'system'
 * @param {Object} [params.details] - Arbitrary context details
 * @param {Request} [params.req] - Optional Next.js / Node request object to extract IP
 */
export async function logAuditEvent({
  action,
  userId = null,
  performedBy = 'system',
  details = {},
  req = null,
}) {
  try {
    await dbConnect();

    let ip = null;
    if (req) {
      const forwarded = req.headers?.get?.('x-forwarded-for') || req.headers?.['x-forwarded-for'];
      if (forwarded) {
        ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0];
      } else {
        ip = req.ip || req.socket?.remoteAddress || null;
      }
    }

    const entry = await AuditLog.create({
      action,
      userId: userId || null,
      performedBy: String(performedBy || 'system'),
      details: details || {},
      ip,
    });

    return entry;
  } catch (err) {
    console.warn(`[AuditLog] Warning recording audit log for ${action}:`, err.message);
    return null;
  }
}

export default logAuditEvent;
