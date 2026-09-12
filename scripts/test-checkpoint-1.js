const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach((line) => {
    const match = line.match(/^([^#\s]+)\s*=\s*(.*)$/);
    if (match) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  });
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Please define MONGODB_URI in .env.local');
  process.exit(1);
}

// Define User & SlotRequest schemas for test runner
const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    provider: { type: String, enum: ['credentials', 'google'], default: 'credentials' },
  },
  { timestamps: true }
);

const SlotRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, trim: true, default: '' },
    purpose: { type: String, trim: true, default: '' },
    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'active', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    adminNotes: { type: String, trim: true, default: '' },
    rejectionReason: { type: String, trim: true, default: '' },
    containerDetails: {
      containerId: { type: String, default: null },
      containerName: { type: String, default: null },
      sshHost: { type: String, default: null },
      sshPort: { type: Number, default: null },
      sshUser: { type: String, default: null },
      sshPassword: { type: String, default: null },
      volumeName: { type: String, default: null },
    },
  },
  { timestamps: true }
);

SlotRequestSchema.index({ startTime: 1, endTime: 1, status: 1 });

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const SlotRequest = mongoose.models.SlotRequest || mongoose.model('SlotRequest', SlotRequestSchema);

async function runTests() {
  console.log('Connecting to MongoDB at:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log('✓ Connected to MongoDB.\n');

  try {
    // 1. Create or find test users
    console.log('--- Step 1: Setting up Test Users ---');
    let testUser = await User.findOne({ email: 'testuser_cp1@example.com' });
    if (!testUser) {
      testUser = await User.create({
        email: 'testuser_cp1@example.com',
        role: 'user',
        provider: 'credentials',
      });
    }

    let testUser2 = await User.findOne({ email: 'testuser2_cp1@example.com' });
    if (!testUser2) {
      testUser2 = await User.create({
        email: 'testuser2_cp1@example.com',
        role: 'user',
        provider: 'credentials',
      });
    }

    let adminUser = await User.findOne({ email: 'admin_cp1@example.com' });
    if (!adminUser) {
      adminUser = await User.create({
        email: 'admin_cp1@example.com',
        role: 'admin',
        provider: 'credentials',
      });
    }
    console.log(`✓ Test Users Ready: User 1 (${testUser._id}), User 2 (${testUser2._id}), Admin (${adminUser._id})\n`);

    // Clean up any previous test requests for these test users
    await SlotRequest.deleteMany({ userId: { $in: [testUser._id, testUser2._id, adminUser._id] } });

    // 2. Test valid SlotRequest creation
    console.log('--- Step 2: Test Valid Slot Request Creation ---');
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
    const slotStart1 = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 10, 0, 0);
    const slotEnd1 = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 12, 0, 0);

    const req1 = await SlotRequest.create({
      userId: testUser._id,
      title: 'Deep Learning Model Training',
      purpose: 'Training PyTorch LLM on GPU node',
      startTime: slotStart1,
      endTime: slotEnd1,
      status: 'pending',
    });

    console.log('✓ Created Slot Request 1:', {
      id: req1._id.toString(),
      title: req1.title,
      startTime: req1.startTime.toISOString(),
      endTime: req1.endTime.toISOString(),
      status: req1.status,
    });

    // 3. Test Collision Logic (Overlap detection)
    console.log('\n--- Step 3: Test Collision Detection Logic ---');
    // Overlapping slot: 11:00 to 13:00 (overlaps with 10:00 to 12:00)
    const overlapStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 11, 0, 0);
    const overlapEnd = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 13, 0, 0);

    const collision = await SlotRequest.findOne({
      userId: { $in: [testUser._id, testUser2._id] },
      status: { $in: ['pending', 'approved', 'active'] },
      startTime: { $lt: overlapEnd },
      endTime: { $gt: overlapStart },
    });

    if (collision) {
      console.log('✓ Overlap correctly detected with existing slot:', {
        collidingId: collision._id.toString(),
        title: collision.title,
        startTime: collision.startTime.toISOString(),
        endTime: collision.endTime.toISOString(),
      });
    } else {
      throw new Error('Collision detection failed! Overlapping slot was not caught.');
    }

    // Non-overlapping slot: 14:00 to 16:00 (after 10:00 - 12:00)
    const nonOverlapStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 14, 0, 0);
    const nonOverlapEnd = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 16, 0, 0);

    const noCollision = await SlotRequest.findOne({
      userId: { $in: [testUser._id, testUser2._id] },
      status: { $in: ['pending', 'approved', 'active'] },
      startTime: { $lt: nonOverlapEnd },
      endTime: { $gt: nonOverlapStart },
    });

    if (!noCollision) {
      console.log('✓ Non-overlapping time slot allowed as expected.');
      const req2 = await SlotRequest.create({
        userId: testUser2._id,
        title: 'CFD Fluid Simulation',
        purpose: 'Running OpenFOAM simulations',
        startTime: nonOverlapStart,
        endTime: nonOverlapEnd,
        status: 'approved',
      });
      console.log('✓ Created Slot Request 2 for User 2:', req2._id.toString());
    } else {
      throw new Error('False collision detected for non-overlapping slot!');
    }

    // 4. Test User vs Admin Isolation
    console.log('\n--- Step 4: Test Normal User vs Admin Query Isolation ---');
    const user1Requests = await SlotRequest.find({ userId: testUser._id });
    console.log(`✓ User 1 query returned ${user1Requests.length} request(s) (Expected: 1)`);
    if (user1Requests.length !== 1 || user1Requests[0].userId.toString() !== testUser._id.toString()) {
      throw new Error('User data isolation check failed!');
    }

    const allRequestsAdmin = await SlotRequest.find({}).populate('userId', 'email role');
    console.log(`✓ Admin query returned ${allRequestsAdmin.length} request(s) total across all users.`);
    if (allRequestsAdmin.length < 2) {
      throw new Error('Admin view failed to see all requests!');
    }

    // 5. Test Calendar Slots Query
    console.log('\n--- Step 5: Test Calendar Slots Endpoint Query ---');
    const calendarSlots = await SlotRequest.find({
      status: { $in: ['pending', 'approved', 'active'] },
    })
      .select('_id title purpose startTime endTime status userId')
      .populate('userId', 'email')
      .sort({ startTime: 1 });

    console.log(`✓ Found ${calendarSlots.length} occupied/booked slots for calendar display:`);
    calendarSlots.forEach((slot, i) => {
      const email = typeof slot.userId === 'object' && slot.userId?.email ? slot.userId.email : String(slot.userId);
      console.log(
        `   ${i + 1}. [${slot.status.toUpperCase()}] ${slot.title} (${slot.startTime.toISOString()} - ${slot.endTime.toISOString()}) by ${email}`
      );
    });

    console.log('\n=============================================');
    console.log('🎉 ALL CHECKPOINT 1 MODEL & QUERY TESTS PASSED');
    console.log('=============================================');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
