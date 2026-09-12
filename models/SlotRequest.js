import mongoose from 'mongoose';

const SlotRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    title: {
      type: String,
      trim: true,
      default: '',
    },
    purpose: {
      type: String,
      trim: true,
      default: '',
    },
    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
      index: true,
    },
    endTime: {
      type: Date,
      required: [true, 'End time is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'active', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    adminNotes: {
      type: String,
      trim: true,
      default: '',
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
    containerDetails: {
      containerId: { type: String, default: null },
      containerName: { type: String, default: null },
      sshHost: { type: String, default: null },
      sshPort: { type: Number, default: null },
      sshUser: { type: String, default: null },
      sshPassword: { type: String, default: null },
      volumeName: { type: String, default: null },
    },
    warningSent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Compound index for efficient slot collision checks and calendar queries
SlotRequestSchema.index({ startTime: 1, endTime: 1, status: 1 });

export default mongoose.models.SlotRequest || mongoose.model('SlotRequest', SlotRequestSchema);
