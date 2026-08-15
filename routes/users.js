import express from 'express';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { verifyFirebaseToken } from '../middleware/auth.js';
import firebaseAdmin from 'firebase-admin';

const router = express.Router();

// Initialize Firebase Admin for real-time notifications
let firebaseApp;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    firebaseApp = firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount)
    }, 'users-routes');
  }
} catch (error) {
  console.warn('Firebase Admin not initialized in users routes');
}

// Helper function to create notification in MongoDB
const createMongoNotification = async (notificationData) => {
  try {
    const notification = new Notification({
      ...notificationData,
      createdAt: new Date(),
      read: false
    });
    await notification.save();
    console.log('MongoDB notification created:', notification.type);
  } catch (error) {
    console.error('Error creating MongoDB notification:', error);
  }
};

// Helper function to create notification in Firebase Realtime Database
const createFirebaseNotification = async (notificationData) => {
  try {
    if (!firebaseApp) {
      console.log('Firebase not available, skipping Firebase notification');
      return;
    }
    
    const { recipientId, type, title, message, fromUserId, fromUserName, fromUserAvatar, actionUrl } = notificationData;
    
    // Create notification in Firebase Realtime Database
    const firebaseNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      userId: recipientId,
      title,
      message,
      fromUserId,
      fromUserName,
      fromUserAvatar,
      actionUrl,
      isRead: false,
      timestamp: Date.now()
    };
    
    await firebaseAdmin.database().ref(`notifications/${recipientId}`).push(firebaseNotification);
    console.log('Firebase notification created for user:', recipientId);
  } catch (error) {
    console.error('Error creating Firebase notification:', error);
  }
};

// Helper function to create notification in both systems
const createNotification = async (notificationData) => {
  // Create in MongoDB
  await createMongoNotification({
    userId: notificationData.recipientId,
    type: notificationData.type,
    text: notificationData.message,
    senderName: notificationData.fromUserName,
    avatar: notificationData.fromUserAvatar,
    actionUrl: notificationData.actionUrl,
    metadata: notificationData.metadata
  });
  
  // Create in Firebase for real-time delivery
  await createFirebaseNotification(notificationData);
};

// Search users by name or username (must come before /:userId)
router.get('/search', verifyFirebaseToken, async (req, res) => {
  try {
    const { q } = req.query;
    console.log('Searching for users with query:', q);
    
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    const users = await User.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { username: { $regex: q, $options: 'i' } }
      ]
    }).select('-firebaseUid -email');
    
    console.log('Found users:', users.length);
    
    // Convert MongoDB _id to id for frontend compatibility
    const usersWithId = users.map(user => ({
      ...user.toObject(),
      id: user._id.toString()
    }));
    
    res.json(usersWithId);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Get all users with optional search
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
    const { name, username, bio, interests, avatar, id } = req.body;
    
    console.log('Creating/updating profile for Firebase UID:', uid);
    console.log('Profile data:', { name, username, bio, interests, avatar });

    // Validate interests - must be exactly 3
    if (interests && interests.length !== 3) {
      return res.status(400).json({ 
        error: 'Users must select exactly 3 interests',
        currentCount: interests.length,
        requiredCount: 3
      });
    }

    // Use Firebase UID if provided, otherwise use the id from body
    const firebaseUidToUse = id || uid;

    const user = await User.findOneAndUpdate(
      { firebaseUid: firebaseUidToUse },
      { 
        name, 
        username, 
        bio, 
        interests, 
        avatar,
        firebaseUid: firebaseUidToUse,
        onboardingComplete: interests && interests.length === 3, // Mark onboarding as complete if 3 interests
        updatedAt: Date.now()
      },
      { new: true, upsert: true }
    );

    console.log('Profile saved/updated in MongoDB:', user.username);
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Create profile error:', error);
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

// Update user
router.put('/:userId', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const userId = req.params.userId;
    console.log('Update user request - Firebase UID:', uid, 'User ID:', userId);
    
    // Use Firebase UID for user identification
    const user = await User.findOneAndUpdate(
      { firebaseUid: userId },
      req.body,
      { new: true }
    );
    
    if (!user) {
      console.log('User not found for update:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('User updated successfully:', user.username);
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
    
    // Validate interests - must be exactly 3
    if (!interests || interests.length !== 3) {
      return res.status(400).json({ 
        error: 'Users must have exactly 3 interests',
        currentCount: interests ? interests.length : 0,
        requiredCount: 3
      });
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { 
        interests,
        onboardingComplete: true // Mark onboarding as complete when interests are set
      },
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

// Save post
router.post('/:userId/saved', verifyFirebaseToken, async (req, res) => {
  try {
    const { postId } = req.body;
    const user = await User.findOne({ firebaseUid: req.params.userId });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if post is already saved
    const alreadySaved = user.savedPosts.some(saved => saved.postId === postId);
    
    if (alreadySaved) {
      return res.json({ success: true, message: 'Post already saved' });
    }

    // Add post to saved posts
    user.savedPosts.push({
      postId,
      savedAt: new Date()
    });
    
    await user.save();
    console.log('Post saved for user:', req.params.userId, 'Post ID:', postId);
    
    res.json({ success: true, message: 'Post saved successfully' });
  } catch (error) {
    console.error('Save post error:', error);
    res.status(500).json({ error: 'Failed to save post' });
  }
});

// Remove saved post
router.delete('/:userId/saved/:postId', verifyFirebaseToken, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.params.userId });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove post from saved posts
    user.savedPosts = user.savedPosts.filter(saved => saved.postId !== req.params.postId);
    
    await user.save();
    console.log('Post unsaved for user:', req.params.userId, 'Post ID:', req.params.postId);
    
    res.json({ success: true, message: 'Post removed from saved' });
  } catch (error) {
    console.error('Remove saved post error:', error);
    res.status(500).json({ error: 'Failed to remove saved post' });
  }
});

// Get saved posts for a user
router.get('/:userId/saved', verifyFirebaseToken, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.params.userId });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return saved posts with post IDs and save dates
    const savedPosts = user.savedPosts.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    
    res.json({ success: true, savedPosts });
  } catch (error) {
    console.error('Get saved posts error:', error);
    res.status(500).json({ error: 'Failed to get saved posts' });
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

      // Create notification for the user being followed
      try {
        await createNotification({
          recipientId: targetUserId,
          type: 'follow',
          title: 'New Follower',
          message: `${user.name} started following you`,
          fromUserId: req.params.userId,
          fromUserName: user.name,
          fromUserAvatar: user.avatar,
          actionUrl: `/profile/${req.params.userId}`
        });
      } catch (notificationError) {
        console.error('Error creating follow notification:', notificationError);
      }
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
