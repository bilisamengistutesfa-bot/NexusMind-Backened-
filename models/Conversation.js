import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: String,
  imageUrl: String,
  timestamp: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false }
});

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  messages: [messageSchema],
  lastMessage: String,
  time: String,
  unreadCount: { type: Number, default: 0 },
  context: {
    type: { type: String, enum: ['solution', 'post', 'collaboration'] },
    title: String,
    itemId: mongoose.Schema.Types.ObjectId
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
conversationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for user conversations
conversationSchema.index({ participants: 1, updatedAt: -1 });

export default mongoose.model('Conversation', conversationSchema);
