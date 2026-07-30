import mongoose from 'mongoose';

const solutionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: String,
  userAvatar: String,
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  upvotes: { type: Number, default: 0 },
  helpful: { type: Number, default: 0 },
  replies: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    userAvatar: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
  }]
});

const pollOptionSchema = new mongoose.Schema({
  id: String,
  text: String,
  votes: { type: Number, default: 0 }
});

const pollSchema = new mongoose.Schema({
  question: String,
  options: [pollOptionSchema],
  expiresAt: Date
});

const postSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: String,
  userAvatar: String,
  category: { type: String, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  imageUrl: String,
  videoUrl: String,
  gifUrl: String,
  timestamp: { type: Date, default: Date.now },
  votes: { type: Number, default: 0 },
  solutions: [solutionSchema],
  isSolved: { type: Boolean, default: false },
  taggedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  emoji: String,
  location: String,
  locationCoordinates: {
    latitude: Number,
    longitude: Number
  },
  poll: pollSchema,
  scheduledTime: Date,
  privacy: { type: String, enum: ['public', 'friends', 'private'], default: 'public' },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
postSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for search
postSchema.index({ title: 'text', content: 'text', category: 'text' });
// Index for feed sorting
postSchema.index({ timestamp: -1 });
postSchema.index({ votes: -1 });

export default mongoose.model('Post', postSchema);
