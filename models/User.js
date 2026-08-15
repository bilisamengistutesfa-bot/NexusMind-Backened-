import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // Optional for Google auth users
  avatar: { type: String, maxlength: 50000 },
  bio: { type: String, default: '' },
  reputation: { type: Number, default: 0 },
  
  // Profile fields
  education: String,
  location: String,
  work: String,
  expertise: [String],
  coverPhoto: String,
  
  // Interest selection
  interests: [String],
  onboardingComplete: { type: Boolean, default: false },
  
  // Social
  following: [{ type: mongoose.Schema.Types.Mixed }], // Can be ObjectId or Firebase UID string
  followers: [{ type: mongoose.Schema.Types.Mixed }], // Can be ObjectId or Firebase UID string
  
  // Saved posts
  savedPosts: [{
    postId: { type: mongoose.Schema.Types.Mixed }, // Can be ObjectId or Firebase UID string
    savedAt: { type: Date, default: Date.now }
  }],
  
  // Streak system
  streak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  lastActiveDate: { type: Date, default: Date.now },
  streakFreezes: { type: Number, default: 0 },
  streakHistory: [Number],
  
  // Badge system
  badges: [{
    id: String,
    name: String,
    description: String,
    icon: String,
    category: String,
    rarity: String,
    earnedAt: Date
  }],
  badgeProgress: [{
    badgeId: String,
    currentProgress: Number,
    maxProgress: Number,
    unlocked: Boolean
  }],
  
  // Expertise system
  expertiseScores: [{
    domainId: String,
    domainName: String,
    score: Number,
    problemsSolved: Number,
    solutionsProvided: Number,
    helpfulVotes: Number,
    lastUpdated: Date
  }],
  overallExpertise: { type: Number, default: 0 },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for search
userSchema.index({ name: 'text', username: 'text', bio: 'text' });

export default mongoose.model('User', userSchema);
