import express from 'express';
import Feedback from '../models/Feedback.js';
import User from '../models/User.js';
import { verifyFirebaseToken } from '../middleware/auth.js';

const router = express.Router();

// Submit feedback
router.post('/', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.user;
    console.log('Feedback submission - Firebase UID:', uid);
    console.log('Feedback data:', req.body);
    
    // Get user details from Firebase UID
    let user = await User.findOne({ firebaseUid: uid });
    
    // If user doesn't exist in MongoDB, create minimal user record
    if (!user) {
      console.log('User not found in MongoDB, creating minimal user record for feedback');
      user = new User({
        firebaseUid: uid,
        name: req.body.userName || 'Unknown User',
        username: req.body.userName?.toLowerCase().replace(/\s+/g, '') || 'unknown',
        email: req.body.email || `${uid}@firebase.auth`,
        avatar: req.body.userAvatar || 'https://picsum.photos/seed/default/100/100',
        reputation: 0
      });
      await user.save();
      console.log('Created minimal user record:', user._id);
    }

    const feedback = new Feedback({
      userId: user._id, // Use MongoDB ObjectId
      userName: user.name,
      userAvatar: user.avatar,
      email: user.email,
      ...req.body,
      timestamp: new Date()
    });
    
    await feedback.save();
    console.log('Feedback submitted successfully:', feedback._id);
    res.json({ id: feedback._id, success: true, message: 'Feedback submitted successfully' });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// Get feedback for user
router.get('/user/:userId', verifyFirebaseToken, async (req, res) => {
  try {
    const feedback = await Feedback.find({ userId: req.params.userId })
      .sort({ timestamp: -1 });
    res.json(feedback);
  } catch (error) {
    console.error('Get user feedback error:', error);
    res.status(500).json({ error: 'Failed to get user feedback' });
  }
});

// Get all feedback
router.get('/', verifyFirebaseToken, async (req, res) => {
  try {
    const feedback = await Feedback.find().sort({ timestamp: -1 });
    res.json(feedback);
  } catch (error) {
    console.error('Get all feedback error:', error);
    res.status(500).json({ error: 'Failed to get all feedback' });
  }
});

export default router;
