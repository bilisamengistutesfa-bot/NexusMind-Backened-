import express from 'express';
import Post from '../models/Post.js';
import User from '../models/User.js';
import { verifyFirebaseToken } from '../middleware/auth.js';

const router = express.Router();

// Get all posts with privacy filtering
router.get('/', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.user;
    console.log('GET /api/posts - User ID:', uid);
    
    // Get current user's following list for connections privacy
    const currentUser = await User.findOne({ firebaseUid: uid });
    const following = currentUser?.following || [];
    console.log('User following count:', following.length);
    
    // Get all posts and filter by privacy
    const allPosts = await Post.find().sort({ timestamp: -1 }).limit(100);
    
    const filteredPosts = allPosts.filter(post => {
      const privacy = post.privacy || 'public';
      
      // Public: visible to everyone
      if (privacy === 'public') {
        return true;
      }
      
      // Connections: visible to followers of the author
      if (privacy === 'connections') {
        // Author can always see their own posts
        if (post.userId === uid) {
          return true;
        }
        // Followers can see connections posts
        return following.includes(post.userId);
      }
      
      // Private: only visible to author
      if (privacy === 'private') {
        return post.userId === uid;
      }
      
      return false;
    });
    
    console.log('Filtered posts count:', filteredPosts.length, 'from total:', allPosts.length);
    
    // Convert MongoDB _id to id for frontend compatibility
    const postsWithId = filteredPosts.map(post => ({
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

// Get single post with privacy check
router.get('/:postId', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Check privacy permissions
    const privacy = post.privacy || 'public';
    
    // Public: visible to everyone
    if (privacy === 'public') {
      return res.json(post);
    }
    
    // Connections: visible to author and followers
    if (privacy === 'connections') {
      // Author can always see their own posts
      if (post.userId === uid) {
        return res.json(post);
      }
      
      // Check if current user follows the author
      const currentUser = await User.findOne({ firebaseUid: uid });
      const following = currentUser?.following || [];
      
      if (following.includes(post.userId)) {
        return res.json(post);
      }
      
      return res.status(403).json({ error: 'You do not have permission to view this post' });
    }
    
    // Private: only visible to author
    if (privacy === 'private') {
      if (post.userId === uid) {
        return res.json(post);
      }
      return res.status(403).json({ error: 'You do not have permission to view this post' });
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

// Report post
router.post('/:postId/report', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { reason } = req.body;
    
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if user already reported this post
    const alreadyReported = post.reports?.some(report => report.reporterId === uid);
    if (alreadyReported) {
      return res.status(400).json({ error: 'You have already reported this post' });
    }

    // Get reporter name
    const reporter = await User.findOne({ firebaseUid: uid });
    const reporterName = reporter?.name || 'Anonymous';

    // Add report
    if (!post.reports) {
      post.reports = [];
    }
    post.reports.push({
      reporterId: uid,
      reporterName,
      reason: reason || 'Inappropriate content',
      timestamp: new Date()
    });

    await post.save();
    console.log('Post reported:', req.params.postId, 'by:', uid, 'reason:', reason);
    
    res.json({ success: true, message: 'Post reported successfully' });
  } catch (error) {
    console.error('Report post error:', error);
    res.status(500).json({ error: 'Failed to report post' });
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
    const { uid } = req.user;
    console.log('Add solution request - Firebase UID:', uid, 'Post ID:', req.params.postId);
    
    const post = await Post.findById(req.params.postId);
    if (!post) {
      console.log('Post not found:', req.params.postId);
      return res.status(404).json({ error: 'Post not found' });
    }

    const solution = {
      ...req.body,
      userId: uid, // Use Firebase UID
      timestamp: new Date(),
      upvotes: 0,
      helpful: 0,
      replies: []
    };

    post.solutions.push(solution);
    await post.save();
    console.log('Solution added successfully - Solution ID:', solution.id || 'pending');

    res.json({ success: true, solution: post.solutions[post.solutions.length - 1] });
  } catch (error) {
    console.error('Add solution error:', error);
    res.status(500).json({ error: 'Failed to add solution' });
  }
});

// Vote on solution
router.post('/:postId/solutions/:solutionId/vote', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { userId, voteType } = req.body;
    console.log('Vote solution request - Firebase UID:', uid, 'Post ID:', req.params.postId, 'Solution ID:', req.params.solutionId, 'Vote type:', voteType);
    
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
      console.log('Post not found:', req.params.postId);
      return res.status(404).json({ error: 'Post not found' });
    }

    const solution = post.solutions.id(req.params.solutionId);
    if (!solution) {
      console.log('Solution not found:', req.params.solutionId);
      return res.status(404).json({ error: 'Solution not found' });
    }

    const delta = voteType === 'up' ? 1 : -1;
    solution.upvotes += delta;
    await post.save();
    console.log('Solution vote successful - New upvote count:', solution.upvotes);

    res.json({ success: true, upvotes: solution.upvotes });
  } catch (error) {
    console.error('Vote solution error:', error);
    res.status(500).json({ error: 'Failed to vote on solution' });
  }
});

// Mark solution as helpful
router.post('/:postId/solutions/:solutionId/helpful', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { userId } = req.body;
    console.log('Mark solution helpful request - Firebase UID:', uid, 'Post ID:', req.params.postId, 'Solution ID:', req.params.solutionId);
    
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
      console.log('Post not found:', req.params.postId);
      return res.status(404).json({ error: 'Post not found' });
    }

    const solution = post.solutions.id(req.params.solutionId);
    if (!solution) {
      console.log('Solution not found:', req.params.solutionId);
      return res.status(404).json({ error: 'Solution not found' });
    }

    solution.helpful += 1;
    await post.save();
    console.log('Solution marked as helpful - New helpful count:', solution.helpful);

    res.json({ success: true, helpful: solution.helpful });
  } catch (error) {
    console.error('Mark solution helpful error:', error);
    res.status(500).json({ error: 'Failed to mark solution as helpful' });
  }
});

// Accept solution
router.post('/:postId/solutions/:solutionId/accept', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { userId } = req.body;
    console.log('Accept solution request - Firebase UID:', uid, 'Post ID:', req.params.postId, 'Solution ID:', req.params.solutionId);
    
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
      console.log('Post not found:', req.params.postId);
      return res.status(404).json({ error: 'Post not found' });
    }

    // Verify that the requester is the post author
    if (post.userId.toString() !== uid && post.userId !== uid) {
      console.log('Unauthorized: User is not post author');
      return res.status(403).json({ error: 'Only post author can accept solutions' });
    }

    const solution = post.solutions.id(req.params.solutionId);
    if (!solution) {
      console.log('Solution not found:', req.params.solutionId);
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
    console.log('Solution acceptance toggled - Accepted:', solution.accepted, 'Post solved:', post.isSolved);

    res.json({ success: true, accepted: solution.accepted });
  } catch (error) {
    console.error('Accept solution error:', error);
    res.status(500).json({ error: 'Failed to accept solution' });
  }
});

// Add reply to solution
router.post('/:postId/solutions/:solutionId/replies', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { userId, userName, userAvatar, text } = req.body;
    console.log('Add reply request - Firebase UID:', uid, 'Post ID:', req.params.postId, 'Solution ID:', req.params.solutionId);
    
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
      console.log('Post not found:', req.params.postId);
      return res.status(404).json({ error: 'Post not found' });
    }

    const solution = post.solutions.id(req.params.solutionId);
    if (!solution) {
      console.log('Solution not found:', req.params.solutionId);
      return res.status(404).json({ error: 'Solution not found' });
    }

    const reply = {
      userId: uid, // Use Firebase UID
      userName,
      userAvatar,
      text,
      timestamp: new Date()
    };

    solution.replies.push(reply);
    await post.save();
    console.log('Reply added successfully to solution:', req.params.solutionId);

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
    post.comments = post.comments.filter((c) => c.id !== commentId);
    await post.save();
    console.log('Comment deleted from post:', postId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// Report post
router.post('/:postId/report', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { reason } = req.body;
    console.log('Report post request - Firebase UID:', uid, 'Post ID:', req.params.postId, 'Reason:', reason);
    
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Add report to post
    const report = {
      reporterId: uid,
      reporterName: 'User', // You might want to fetch user name from User model
      reason,
      timestamp: new Date()
    };

    post.reports = post.reports || [];
    post.reports.push(report);
    await post.save();
    console.log('Post reported successfully:', req.params.postId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Report post error:', error);
    res.status(500).json({ error: 'Failed to report post' });
  }
});

// Repost post
router.post('/:postId/repost', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { userId } = req.body;
    console.log('Repost post request - Firebase UID:', uid, 'Post ID:', req.params.postId);
    
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Get user info for repost
    const user = await User.findOne({ firebaseUid: uid });
    const userName = user ? user.name : 'User';
    const userAvatar = user ? user.avatar : 'https://picsum.photos/seed/default/100/100';

    // Check if user already reposted this post
    const existingRepostIndex = post.reposts ? post.reposts.findIndex(r => r.userId === uid) : -1;
    
    if (existingRepostIndex >= 0) {
      // Remove repost (toggle off)
      post.reposts.splice(existingRepostIndex, 1);
      await post.save();
      console.log('Post un-reposted:', req.params.postId);
      res.json({ success: true, reposted: false });
    } else {
      // Add repost
      const repost = {
        userId: uid,
        userName,
        userAvatar,
        timestamp: new Date()
      };

      post.reposts = post.reposts || [];
      post.reposts.push(repost);
      await post.save();
      console.log('Post reposted successfully:', req.params.postId);
      res.json({ success: true, reposted: true });
    }
  } catch (error) {
    console.error('Repost post error:', error);
    res.status(500).json({ error: 'Failed to repost post' });
  }
});

// Get reposts for a post
router.get('/:postId/reposts', verifyFirebaseToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Return reposts array
    const reposts = post.reposts || [];
    res.json(reposts);
  } catch (error) {
    console.error('Get reposts error:', error);
    res.status(500).json({ error: 'Failed to get reposts' });
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
