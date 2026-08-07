import express from 'express';
import Post from '../models/Post.js';
import { verifyFirebaseToken } from '../middleware/auth.js';

const router = express.Router();

// Get all posts
router.get('/', verifyFirebaseToken, async (req, res) => {
  try {
    const posts = await Post.find().sort({ timestamp: -1 }).limit(50);
    console.log('Returning posts from backend, count:', posts.length);
    res.json(posts);
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Failed to get posts' });
  }
});

// Get all posts (no limit)
router.get('/all', verifyFirebaseToken, async (req, res) => {
  try {
    const posts = await Post.find().sort({ timestamp: -1 });
    res.json(posts);
  } catch (error) {
    console.error('Get all posts error:', error);
    res.status(500).json({ error: 'Failed to get all posts' });
  }
});

// Get single post
router.get('/:postId', verifyFirebaseToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json(post);
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Failed to get post' });
  }
});

// Create post
router.post('/', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const postData = {
      ...req.body,
      userId: uid,
      timestamp: new Date(),
      votes: 0,
      isSolved: false,
      solutions: []
    };

    console.log('Creating post with data:', JSON.stringify(postData, null, 2));
    console.log('Image URL length:', postData.imageUrl?.length || 0);

    const post = new Post(postData);
    await post.save();
    console.log('Post saved successfully with ID:', post._id);
    res.json(post);
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Update post
router.put('/:postId', verifyFirebaseToken, async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.postId,
      req.body,
      { new: true }
    );
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json({ success: true, post });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// Delete post
router.delete('/:postId', verifyFirebaseToken, async (req, res) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Vote on post
router.post('/:postId/vote', verifyFirebaseToken, async (req, res) => {
  try {
    const { userId, voteType } = req.body;
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const delta = voteType === 'up' ? 1 : -1;
    post.votes += delta;
    await post.save();

    res.json({ success: true, votes: post.votes });
  } catch (error) {
    console.error('Vote post error:', error);
    res.status(500).json({ error: 'Failed to vote on post' });
  }
});

// Add solution
router.post('/:postId/solutions', verifyFirebaseToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const solution = {
      ...req.body,
      timestamp: new Date(),
      upvotes: 0,
      helpful: 0,
      replies: []
    };

    post.solutions.push(solution);
    await post.save();

    res.json({ success: true, solution: post.solutions[post.solutions.length - 1] });
  } catch (error) {
    console.error('Add solution error:', error);
    res.status(500).json({ error: 'Failed to add solution' });
  }
});

// Vote on solution
router.post('/:postId/solutions/:solutionId/vote', verifyFirebaseToken, async (req, res) => {
  try {
    const { userId, voteType } = req.body;
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const solution = post.solutions.id(req.params.solutionId);
    if (!solution) {
      return res.status(404).json({ error: 'Solution not found' });
    }

    const delta = voteType === 'up' ? 1 : -1;
    solution.upvotes += delta;
    await post.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Vote solution error:', error);
    res.status(500).json({ error: 'Failed to vote on solution' });
  }
});

// Mark solution as helpful
router.post('/:postId/solutions/:solutionId/helpful', verifyFirebaseToken, async (req, res) => {
  try {
    const { userId } = req.body;
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const solution = post.solutions.id(req.params.solutionId);
    if (!solution) {
      return res.status(404).json({ error: 'Solution not found' });
    }

    solution.helpful += 1;
    await post.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Mark solution helpful error:', error);
    res.status(500).json({ error: 'Failed to mark solution as helpful' });
  }
});

// Accept solution
router.post('/:postId/solutions/:solutionId/accept', verifyFirebaseToken, async (req, res) => {
  try {
    const { userId } = req.body;
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Verify that the requester is the post author
    if (post.userId.toString() !== userId) {
      return res.status(403).json({ error: 'Only post author can accept solutions' });
    }

    const solution = post.solutions.id(req.params.solutionId);
    if (!solution) {
      return res.status(404).json({ error: 'Solution not found' });
    }

    // Toggle acceptance
    solution.accepted = !solution.accepted;
    
    // If accepting, mark post as solved
    if (solution.accepted) {
      post.isSolved = true;
    } else {
      // Check if there are other accepted solutions
      const hasOtherAccepted = post.solutions.some(s => s.accepted && s.id !== req.params.solutionId);
      post.isSolved = hasOtherAccepted;
    }
    
    await post.save();

    res.json({ success: true, accepted: solution.accepted });
  } catch (error) {
    console.error('Accept solution error:', error);
    res.status(500).json({ error: 'Failed to accept solution' });
  }
});

// Add reply to solution
router.post('/:postId/solutions/:solutionId/replies', verifyFirebaseToken, async (req, res) => {
  try {
    const { userId, userName, userAvatar, text } = req.body;
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const solution = post.solutions.id(req.params.solutionId);
    if (!solution) {
      return res.status(404).json({ error: 'Solution not found' });
    }

    const reply = {
      userId,
      userName,
      userAvatar,
      text,
      timestamp: new Date()
    };

    solution.replies.push(reply);
    await post.save();

    res.json({ success: true, reply });
  } catch (error) {
    console.error('Add solution reply error:', error);
    res.status(500).json({ error: 'Failed to add solution reply' });
  }
});

// Add comment
router.post('/:postId/comments', verifyFirebaseToken, async (req, res) => {
  try {
    res.json({ success: true });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

export default router;
