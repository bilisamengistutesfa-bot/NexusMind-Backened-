import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { 
    type: String, 
    enum: ['mention', 'reply', 'like', 'follow', 'solution', 'vote', 'system', 
           'streak_reminder', 'streak_milestone', 'streak_warning', 'badge_earned', 
           'message', 'collaboration_accepted'],
    required: true 
  },
  text: { type: String, required: true },
  time: String,
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
  avatar: String,
  actionUrl: String,
  metadata: mongoose.Schema.Types.Mixed,
  senderName: String,
  previewText: String,
  solutionId: String,
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' }
});

// Index for user notifications
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

export default mongoose.model('Notification', notificationSchema);
