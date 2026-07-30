import express from 'express';
import User from '../models/User.js';
import Post from '../models/Post.js';
import { verifyFirebaseToken } from '../middleware/auth.js';

const router = express.Router();

// Global search
router.get('/', verifyFirebaseToken, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.json({ users: [], posts: [], groups: [] });
    }

    const query = q.trim();

    // Search users
    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } },
        { bio: { $regex: query, $options: 'i' } }
      ]
    }).select('-firebaseUid -email').limit(20);

    // Search posts
    const posts = await Post.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { content: { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } }
      ]
    }).limit(20);

    res.json({ users, posts, groups: [] });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
