import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn) return cached.conn;
  
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then(mongoose => mongoose);
  }
  
  cached.conn = await cached.promise;
  return cached.conn;
}

// Schema User
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  photo: { type: String, default: '/default-avatar.png' },
  isOwner: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now }
}, { timestamps: true });

// Schema Message
const MessageSchema = new mongoose.Schema({
  username: String,
  userId: String,
  text: String,
  image: String,
  isSystemMessage: { type: Boolean, default: false },
  forUser: { type: String, default: null }, // null = untuk group, username = private chat
  timestamp: { type: Date, default: Date.now }
});

// Schema Notification
const NotificationSchema = new mongoose.Schema({
  to: String, // username
  from: String,
  message: String,
  type: { type: String, default: 'info' }, // 'new_user', 'private_message'
  isRead: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
export const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema);
export const Notification = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);