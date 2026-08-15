import mongoose from 'mongoose';

const solutionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.Mixed, required: true }, // Can be ObjectId or Firebase UID string
  userName: String,
  userAvatar: String,
  title: String,
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  upvotes: { type: Number, default: 0 },
  helpful: { type: Number, default: 0 },
  replies: [{
    userId: { type: mongoose.Schema.Types.Mixed }, // Can be ObjectId or Firebase UID string
    userName: String,
    userAvatar: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
  }],
  accepted: { type: Boolean, default: false },
  imageUrl: String,
  emoji: String
});

const commentSchema = new mongoose.Schema({
  id: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.Mixed, required: true }, // Can be ObjectId or Firebase UID string
  userName: String,
  userAvatar: String,
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
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
  userId: { type: mongoose.Schema.Types.Mixed, required: true }, // Can be ObjectId or Firebase UID string
  userName: String,
  userAvatar: String,
  category: { type: String, required: true },
  interests: [String], // Interest tags for recommendation algorithm
  title: { type: String },
  content: { type: String, required: true },
  imageUrl: { type: String, maxlength: 50000 }, // 50KB limit for base64
  videoUrl: String,
  gifUrl: String,
  timestamp: { type: Date, default: Date.now },
  votes: { type: Number, default: 0 },
  solutions: [solutionSchema],
  comments: [commentSchema],
  isSolved: { type: Boolean, default: false },
  taggedUsers: [{ type: mongoose.Schema.Types.Mixed }], // Can be ObjectId or Firebase UID string
  emoji: String,
  location: String,
  locationCoordinates: {
    latitude: Number,
    longitude: Number
  },
  poll: pollSchema,
  scheduledTime: Date,
  privacy: { type: String, enum: ['public', 'connections', 'private'], default: 'public' },
  
  // Report system
  reports: [{
    reporterId: { type: mongoose.Schema.Types.Mixed }, // Can be ObjectId or Firebase UID string
    reporterName: String,
    reason: String,
    timestamp: { type: Date, default: Date.now }
  }],
  
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
