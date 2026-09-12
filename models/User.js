import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
  },
  password: {
    type: String,
    // Password is not required because Google OAuth users might not have one
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

export default mongoose.models.User || mongoose.model('User', UserSchema);
