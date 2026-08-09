import express from 'express';
import User from '../models/User.js';
import { verifyFirebaseToken } from '../middleware/auth.js';

const router = express.Router();

// Verify Firebase token and sync/create user
router.post('/verify', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid, email } = req.user;
    console.log('Auth verify - Firebase UID:', uid, 'Email:', email);

    // Find or create user
    let user = await User.findOne({ firebaseUid: uid });
    
    if (!user) {
      console.log('User not found, creating new user for Firebase UID:', uid);
      // Create new user
      user = new User({
        firebaseUid: uid,
        email: email || '',
        name: email?.split('@')[0] || 'User',
        username: email?.split('@')[0] || 'user',
        avatar: 'https://picsum.photos/seed/default/100/100',
        reputation: 0,
        onboardingComplete: false
      });
      await user.save();
      console.log('New user created in MongoDB:', user.username);
    } else {
      console.log('Existing user found:', user.username);
    }

    res.json({ 
      valid: true, 
      userId: user._id.toString(),
      firebaseUid: uid,
      user: {
        id: user._id.toString(),
        firebaseUid: user.firebaseUid,
        name: user.name,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        reputation: user.reputation,
        onboardingComplete: user.onboardingComplete
      }
    });
  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

export default router;
