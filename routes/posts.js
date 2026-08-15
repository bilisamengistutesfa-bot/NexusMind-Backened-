import express from 'express';
import Post from '../models/Post.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { verifyFirebaseToken } from '../middleware/auth.js';
import firebaseAdmin from 'firebase-admin';
import RecommendationAlgorithm from '../utils/recommendationAlgorithm.js';

const router = express.Router();

// Initialize Firebase Admin for real-time notifications
let firebaseApp;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    firebaseApp = firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount)
    }, 'posts-routes');
  }
} catch (error) {
  console.warn('Firebase Admin not initialized in posts routes');
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
    
    const { recipientId, type, title, message, fromUserId, fromUserName, fromUserAvatar, postId, solutionId, actionUrl } = notificationData;
    
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
      postId,
      solutionId,
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
    postId: notificationData.postId,
    solutionId: notificationData.solutionId,
    metadata: notificationData.metadata
  });
  
  // Create in Firebase for real-time delivery
  await createFirebaseNotification(notificationData);
};

// Get all posts with privacy filtering and recommendation algorithm
router.get('/', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.user;
    console.log('GET /api/posts - User ID:', uid);
    
    // Get current user's following list for connections privacy
    const currentUser = await User.findOne({ firebaseUid: uid });
    const following = currentUser?.following || [];
    console.log('User following count:', following.length);
    
    // Use recommendation algorithm to get personalized feed
    const personalizedFeed = await RecommendationAlgorithm.getPersonalizedFeed(uid);
    console.log('Personalized feed count:', personalizedFeed.length);
    
    // Apply privacy filtering to personalized feed
    const filteredPosts = personalizedFeed.filter(post => {
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
    
    console.log('Final filtered posts count:', filteredPosts.length);
    
    // Convert MongoDB _id to id for frontend compatibility (already done in algorithm)
    const postsWithId = filteredPosts.map(post => ({
      ...post,
      id: post._id ? post._id.toString() : post.id
    }));
    
    console.log('Post IDs with id field:', postsWithId.map(p => p.id));
    
    res.json(postsWithId);
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Failed to get posts' });
  }
});

// Get category-specific feed with recommendation algorithm
router.get('/category/:category', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { category } = req.params;
    console.log('GET /api/posts/category - User ID:', uid, 'Category:', category);
    
    // Use recommendation algorithm to get category-specific feed
    const categoryFeed = await RecommendationAlgorithm.getCategoryFeed(category, uid);
    console.log('Category feed count:', categoryFeed.length);
    
    // Get current user's following list for connections privacy
    const currentUser = await User.findOne({ firebaseUid: uid });
    const following = currentUser?.following || [];
    
    // Apply privacy filtering to category feed
    const filteredPosts = categoryFeed.filter(post => {
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
    
    console.log('Final category posts count:', filteredPosts.length);
    
    // Convert MongoDB _id to id for frontend compatibility
    const postsWithId = filteredPosts.map(post => ({
      ...post,
      id: post._id ? post._id.toString() : post.id
    }));
    
    res.json(postsWithId);
  } catch (error) {
    console.error('Get category posts error:', error);
    res.status(500).json({ error: 'Failed to get category posts' });
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

    // Create notification for post author if voter is not the author
    if (post.userId.toString() !== uid && voteType === 'up') {
      try {
        const voter = await User.findOne({ firebaseUid: uid });
        if (voter) {
          await createNotification({
            recipientId: post.userId.toString(),
            type: 'like',
            title: 'New Like',
            message: `${voter.name} liked your post`,
            fromUserId: uid,
            fromUserName: voter.name,
            fromUserAvatar: voter.avatar,
            postId: req.params.postId,
            actionUrl: `/solutions/${req.params.postId}`
          });
        }
      } catch (notificationError) {
        console.error('Error creating vote notification:', notificationError);
      }
    }

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

    // Create notification for post author if solution author is not the post author
    if (post.userId.toString() !== uid) {
      try {
        const solutionAuthor = await User.findOne({ firebaseUid: uid });
        if (solutionAuthor) {
          const solutionText = req.body.text || 'a solution';
          const previewText = solutionText.length > 100 ? solutionText.substring(0, 100) + '...' : solutionText;
          
          await createNotification({
            recipientId: post.userId.toString(),
            type: 'solution',
            title: 'New Solution',
            message: `${solutionAuthor.name} posted a solution to your question`,
            fromUserId: uid,
            fromUserName: solutionAuthor.name,
            fromUserAvatar: solutionAuthor.avatar,
            postId: req.params.postId,
            solutionId: solution.id,
            actionUrl: `/solutions/${req.params.postId}`,
            metadata: { previewText }
          });
        }
      } catch (notificationError) {
        console.error('Error creating solution notification:', notificationError);
      }
    }

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

    // Create notification for solution author if voter is not the author
    if (solution.userId.toString() !== uid && voteType === 'up') {
      try {
        const voter = await User.findOne({ firebaseUid: uid });
        if (voter) {
          await createNotification({
            recipientId: solution.userId.toString(),
            type: 'vote',
            title: 'New Vote',
            message: `${voter.name} voted on your solution`,
            fromUserId: uid,
            fromUserName: voter.name,
            fromUserAvatar: voter.avatar,
            postId: req.params.postId,
            solutionId: req.params.solutionId,
            actionUrl: `/solutions/${req.params.postId}`
          });
        }
      } catch (notificationError) {
        console.error('Error creating solution vote notification:', notificationError);
      }
    }

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

    // Create notification for solution author if marker is not the author
    if (solution.userId.toString() !== uid) {
      try {
        const marker = await User.findOne({ firebaseUid: uid });
        if (marker) {
          await createNotification({
            recipientId: solution.userId.toString(),
            type: 'solution',
            title: 'Solution Marked Helpful',
            message: `${marker.name} found your solution helpful`,
            fromUserId: uid,
            fromUserName: marker.name,
            fromUserAvatar: marker.avatar,
            postId: req.params.postId,
            solutionId: req.params.solutionId,
            actionUrl: `/solutions/${req.params.postId}`
          });
        }
      } catch (notificationError) {
        console.error('Error creating helpful notification:', notificationError);
      }
    }

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
      
      // Create notification for solution author
      if (solution.userId.toString() !== uid) {
        try {
          const postAuthor = await User.findOne({ firebaseUid: uid });
          if (postAuthor) {
            await createNotification({
              recipientId: solution.userId.toString(),
              type: 'solution',
              title: 'Solution Accepted',
              message: `${postAuthor.name} accepted your solution`,
              fromUserId: uid,
              fromUserName: postAuthor.name,
              fromUserAvatar: postAuthor.avatar,
              postId: req.params.postId,
              solutionId: req.params.solutionId,
              actionUrl: `/solutions/${req.params.postId}`
            });
          }
        } catch (notificationError) {
          console.error('Error creating solution acceptance notification:', notificationError);
        }
      }
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

    // Create notification for solution author if replier is not the author
    if (solution.userId.toString() !== uid) {
      try {
        const replier = await User.findOne({ firebaseUid: uid });
        if (replier) {
          const replyPreview = text.length > 50 ? text.substring(0, 50) + '...' : text;
          
          await createNotification({
            recipientId: solution.userId.toString(),
            type: 'reply',
            title: 'New Reply',
            message: `${replier.name} replied to your solution: ${replyPreview}`,
            fromUserId: uid,
            fromUserName: replier.name,
            fromUserAvatar: replier.avatar,
            postId: req.params.postId,
            solutionId: req.params.solutionId,
            actionUrl: `/solutions/${req.params.postId}`,
            metadata: { previewText: replyPreview }
          });
        }
      } catch (notificationError) {
        console.error('Error creating reply notification:', notificationError);
      }
    }

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

    // Create notification for post author if commenter is not the author
    if (post.userId.toString() !== uid) {
      try {
        const commenter = await User.findOne({ firebaseUid: uid });
        if (commenter) {
          const commentPreview = text.length > 50 ? text.substring(0, 50) + '...' : text;
          
          await createNotification({
            recipientId: post.userId.toString(),
            type: 'reply',
            title: 'New Comment',
            message: `${commenter.name} commented on your post: ${commentPreview}`,
            fromUserId: uid,
            fromUserName: commenter.name,
            fromUserAvatar: commenter.avatar,
            postId: req.params.postId,
            actionUrl: `/solutions/${req.params.postId}`,
            metadata: { previewText: commentPreview }
          });
        }
      } catch (notificationError) {
        console.error('Error creating comment notification:', notificationError);
      }
    }
    
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
