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
    
    // Use in-memory storage for feedback to avoid MongoDB dependency issues
    if (!global.feedbackStore) {
      global.feedbackStore = [];
    }
    
    const feedback = {
      id: `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: uid, // Use Firebase UID
      userName: req.body.userName,
      userAvatar: req.body.userAvatar,
      email: req.body.email,
      category: req.body.category,
      subject: req.body.subject,
      message: req.body.message,
      rating: req.body.rating,
      attachments: req.body.attachments,
      timestamp: new Date().toISOString()
    };
    
    // Add to in-memory storage
    global.feedbackStore.unshift(feedback);
    
    // Limit to last 100 feedbacks
    if (global.feedbackStore.length > 100) {
      global.feedbackStore = global.feedbackStore.slice(0, 100);
    }
    
    console.log('Feedback submitted successfully to in-memory storage:', feedback.id);
    res.json({ id: feedback.id, success: true, message: 'Feedback submitted successfully' });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// Get feedback for user
router.get('/user/:userId', verifyFirebaseToken, async (req, res) => {
  try {
    // Use in-memory storage
    if (!global.feedbackStore) {
      global.feedbackStore = [];
    }
    const userFeedback = global.feedbackStore.filter(f => f.userId === req.params.userId);
    res.json(userFeedback);
  } catch (error) {
    console.error('Get user feedback error:', error);
    res.status(500).json({ error: 'Failed to get user feedback' });
  }
});

// Get all feedback
router.get('/', verifyFirebaseToken, async (req, res) => {
  try {
    // Use in-memory storage
    if (!global.feedbackStore) {
      global.feedbackStore = [];
    }
    res.json(global.feedbackStore);
  } catch (error) {
    console.error('Get all feedback error:', error);
    res.status(500).json({ error: 'Failed to get all feedback' });
  }
});

export default router;
