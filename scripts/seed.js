const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^([^#\s]+)\s*=\s*(.*)$/);
    if (match) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  });
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Please define the MONGODB_URI environment variable inside .env.local');
  process.exit(1);
}

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  provider: {
    type: String,
    enum: ['credentials', 'google'],
    default: 'credentials',
  }
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function seedAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to database.');

    const username = await question('Enter username (email): ');
    const password = await question('Enter password: ');
    const confirmPassword = await question('Confirm password: ');

    if (password !== confirmPassword) {
      console.error('Passwords do not match. Aborting.');
      process.exit(1);
    }

    const existingUser = await User.findOne({ email: username });
    if (existingUser) {
      console.error('User already exists. Aborting.');
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const adminUser = new User({
      email: username,
      password: hashedPassword,
      role: 'admin',
      provider: 'credentials'
    });

    await adminUser.save();
    console.log('Admin user created successfully.');
  } catch (error) {
    console.error('Error seeding admin user:', error);
  } finally {
    mongoose.disconnect();
    rl.close();
  }
}

seedAdmin();
