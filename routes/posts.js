import express from 'express';
import Post from '../models/Post.js';
import { verifyFirebaseToken } from '../middleware/auth.js';

const router = express.Router();

// Get all posts
router.get('/', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.user;
    console.log('GET /api/posts - User ID:', uid);
    
    const posts = await Post.find().sort({ timestamp: -1 }).limit(50);
    console.log('Returning posts from backend, count:', posts.length);
    
    // Convert MongoDB _id to id for frontend compatibility
    const postsWithId = posts.map(post => ({
      ...post.toObject(),
      id: post._id.toString()
    }));
    
    console.log('Post IDs with id field:', postsWithId.map(p => p.id));
    
    res.json(postsWithId);
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
    
    // Return post with id field for frontend compatibility
    const postWithId = {
      ...post.toObject(),
      id: post._id.toString()
    };
    
    res.json(postWithId);
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
    const { uid } = req.user;
    const { userId, voteType } = req.body;
    console.log('Vote request received - Firebase UID:', uid, 'Post ID:', req.params.postId, 'Vote type:', voteType);
    
    // Check if post ID is valid
    if (!req.params.postId || req.params.postId === 'undefined') {
      console.log('Invalid post ID:', req.params.postId);
      return res.status(400).json({ error: 'Invalid post ID' });
    }
    
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
      console.log('Post not found:', req.params.postId);
      return res.status(404).json({ error: 'Post not found' });
    }

    const delta = voteType === 'up' ? 1 : -1;
    post.votes += delta;
    await post.save();
    console.log('Vote successful - New vote count:', post.votes);

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
    const { uid } = req.user;
    const { userId, userName, userAvatar, text } = req.body;
    console.log('Add comment request - Firebase UID:', uid, 'Post ID:', req.params.postId);
    
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Create comment object
    const comment = {
      id: `comment-${Date.now()}`,
      userId: uid,
      userName: userName || 'User',
      userAvatar: userAvatar || 'https://picsum.photos/seed/default/100/100',
      text,
      timestamp: new Date()
    };

    // Add comment to post
    post.comments.push(comment);
    await post.save();
    console.log('Comment added to post:', req.params.postId);
    
    res.json({ success: true, comment });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Delete comment
router.delete('/:postId/comments/:commentId', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { postId, commentId } = req.params;
    console.log('Delete comment request - Firebase UID:', uid, 'Post ID:', postId, 'Comment ID:', commentId);
    
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Remove comment from post
    post.comments = post.comments.filter((c: any) => c.id !== commentId);
    await post.save();
    console.log('Comment deleted from post:', postId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// Get comments for a post
router.get('/:postId/comments', verifyFirebaseToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    console.log('Returning comments for post:', req.params.postId, 'Count:', post.comments.length);
    res.json(post.comments || []);
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

export default router;
