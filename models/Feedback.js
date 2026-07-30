import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: String,
  userAvatar: String,
  email: String,
  category: { 
    type: String, 
    enum: ['general', 'bug', 'feature', 'ui', 'performance', 'security'],
    required: true 
  },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5 },
  timestamp: { type: Date, default: Date.now }
});

// Index for user feedback
feedbackSchema.index({ userId: 1, timestamp: -1 });
feedbackSchema.index({ category: 1, timestamp: -1 });

export default mongoose.model('Feedback', feedbackSchema);
