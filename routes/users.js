import express from 'express';
import User from '../models/User.js';
import { verifyFirebaseToken } from '../middleware/auth.js';

const router = express.Router();

// Get user by ID (supports both MongoDB ObjectId and Firebase UID)
router.get('/:userId', verifyFirebaseToken, async (req, res) => {
  try {
    console.log('GET /api/users/:userId - Looking for user:', req.params.userId);
    
    // Try to find by Firebase UID first (since frontend sends Firebase UIDs)
    let user = await User.findOne({ firebaseUid: req.params.userId });
    
    // If not found, try MongoDB ObjectId
    if (!user) {
      try {
        user = await User.findById(req.params.userId);
      } catch (e) {
        // Invalid ObjectId format, continue with user being null
      }
    }
    
    if (!user) {
      console.log('User not found:', req.params.userId);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('User found:', user.username);
    
    res.json({
      id: user._id.toString(),
      firebaseUid: user.firebaseUid,
      name: user.name,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      reputation: user.reputation,
      bio: user.bio,
      interests: user.interests,
      onboardingComplete: user.onboardingComplete,
      streak: user.streak,
      badges: user.badges,
      expertiseScores: user.expertiseScores,
      overallExpertise: user.overallExpertise
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Get user profile
router.get('/:userId/profile', verifyFirebaseToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      id: user._id,
      username: user.username,
      interests: user.interests,
      onboardingComplete: user.onboardingComplete
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Create/update profile
router.post('/profile', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { name, username, bio, interests, avatar } = req.body;

    const user = await User.findOneAndUpdate(
      { firebaseUid: uid },
      { 
        name, 
        username, 
        bio, 
        interests, 
        avatar,
        updatedAt: Date.now()
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, user });
  } catch (error) {
    console.error('Create profile error:', error);
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

// Update user
router.put('/:userId', verifyFirebaseToken, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      req.body,
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Update interests
router.put('/:userId/interests', verifyFirebaseToken, async (req, res) => {
  try {
    const { interests } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { interests },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error('Update interests error:', error);
    res.status(500).json({ error: 'Failed to update interests' });
  }
});

// Get all users
router.get('/', verifyFirebaseToken, async (req, res) => {
  try {
    const { search } = req.query;
    
    if (search) {
      // Search users by name or username
      console.log('Searching for users with query:', search);
      
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } }
        ]
      }).select('-firebaseUid -email');
      
      console.log('Found users:', users.length);
      
      // Convert MongoDB _id to id for frontend compatibility
      const usersWithId = users.map(user => ({
        ...user.toObject(),
        id: user._id.toString()
      }));
      
      res.json(usersWithId);
    } else {
      // Get all users
      const users = await User.find().select('-firebaseUid -email');
      // Convert MongoDB _id to id for frontend compatibility
      const usersWithId = users.map(user => ({
        ...user.toObject(),
        id: user._id.toString()
      }));
      res.json(usersWithId);
    }
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get users by interests
router.post('/by-interests', verifyFirebaseToken, async (req, res) => {
  try {
    const { interests } = req.body;
    const users = await User.find({ 
      interests: { $in: interests } 
    }).select('-firebaseUid -email');
    res.json(users);
  } catch (error) {
    console.error('Get users by interests error:', error);
    res.status(500).json({ error: 'Failed to get users by interests' });
  }
});

// Follow user
router.post('/:userId/follow', verifyFirebaseToken, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const user = await User.findById(req.params.userId);
    const targetUser = await User.findById(targetUserId);

    if (!user || !targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.following.includes(targetUserId)) {
      user.following.push(targetUserId);
      targetUser.followers.push(req.params.userId);
      await user.save();
      await targetUser.save();
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Follow user error:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

// Unfollow user
router.delete('/:userId/follow/:targetUserId', verifyFirebaseToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    const targetUser = await User.findById(req.params.targetUserId);

    if (!user || !targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.following = user.following.filter(id => id.toString() !== req.params.targetUserId);
    targetUser.followers = targetUser.followers.filter(id => id.toString() !== req.params.userId);
    await user.save();
    await targetUser.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Unfollow user error:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// Get saved items
router.get('/:userId/saved', verifyFirebaseToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).populate('savedItems');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user.savedItems || []);
  } catch (error) {
    console.error('Get saved items error:', error);
    res.status(500).json({ error: 'Failed to get saved items' });
  }
});

// Save item
router.post('/:userId/saved', verifyFirebaseToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // For now, just return success - implement proper saved items later
    res.json({ success: true });
  } catch (error) {
    console.error('Save item error:', error);
    res.status(500).json({ error: 'Failed to save item' });
  }
});

// Remove saved item
router.delete('/:userId/saved/:itemId', verifyFirebaseToken, async (req, res) => {
  try {
    res.json({ success: true });
  } catch (error) {
    console.error('Remove saved item error:', error);
    res.status(500).json({ error: 'Failed to remove saved item' });
  }
});

// Get activity log
router.get('/:userId/activity', verifyFirebaseToken, async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    console.error('Get activity log error:', error);
    res.status(500).json({ error: 'Failed to get activity log' });
  }
});

export default router;
