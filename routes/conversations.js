import express from 'express';
import Conversation from '../models/Conversation.js';
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
    }, 'conversations-routes');
  }
} catch (error) {
  console.warn('Firebase Admin not initialized in conversations routes');
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
    
    const { recipientId, type, title, message, fromUserId, fromUserName, fromUserAvatar, conversationId, actionUrl } = notificationData;
    
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
      conversationId,
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
    metadata: { conversationId: notificationData.conversationId }
  });
  
  // Create in Firebase for real-time delivery
  await createFirebaseNotification(notificationData);
};

// Get all conversations for user
router.get('/:userId', verifyFirebaseToken, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.params.userId
    })
    .populate('participants', 'name username avatar')
    .sort({ updatedAt: -1 });
    res.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

// Get conversation by ID
router.get('/id/:conversationId', verifyFirebaseToken, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId)
      .populate('participants', 'name username avatar');
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conversation);
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

// Create conversation
router.post('/', verifyFirebaseToken, async (req, res) => {
  try {
    const conversation = new Conversation({
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await conversation.save();
    await conversation.populate('participants', 'name username avatar');
    res.json(conversation);
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Send message
router.post('/:conversationId/messages', verifyFirebaseToken, async (req, res) => {
  try {
    const { text, imageUrl } = req.body;
    const conversation = await Conversation.findById(req.params.conversationId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const message = {
      senderId: req.user.uid,
      text,
      imageUrl,
      timestamp: new Date(),
      isRead: false
    };

    conversation.messages.push(message);
    conversation.lastMessage = text || 'Image';
    conversation.time = 'Just now';
    conversation.updatedAt = new Date();
    await conversation.save();

    // Create notification for all other participants in the conversation
    try {
      const sender = await User.findOne({ firebaseUid: req.user.uid });
      if (sender) {
        // Get all participants except the sender
        const otherParticipants = conversation.participants.filter(
          p => p.toString() !== req.user.uid && p.toString() !== sender._id.toString()
        );

        for (const participantId of otherParticipants) {
          const messagePreview = text ? (text.length > 50 ? text.substring(0, 50) + '...' : text) : 'Image';
          
          await createNotification({
            recipientId: participantId.toString(),
            type: 'message',
            title: 'New Message',
            message: `${sender.name} sent you a message: ${messagePreview}`,
            fromUserId: req.user.uid,
            fromUserName: sender.name,
            fromUserAvatar: sender.avatar,
            conversationId: req.params.conversationId,
            actionUrl: `/messages?conversation=${req.params.conversationId}`
          });
        }
      }
    } catch (notificationError) {
      console.error('Error creating message notification:', notificationError);
    }

    res.json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get messages for conversation
router.get('/:conversationId/messages', verifyFirebaseToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const conversation = await Conversation.findById(req.params.conversationId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = conversation.messages.slice(-limit);
    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Delete conversation
router.delete('/:conversationId', verifyFirebaseToken, async (req, res) => {
  try {
    const conversation = await Conversation.findByIdAndDelete(req.params.conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// Update user online status
router.post('/user-status', verifyFirebaseToken, async (req, res) => {
  try {
    const { online } = req.body;
    const { uid } = req.user;
    
    const user = await User.findOne({ firebaseUid: uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update user status (this could be stored in a separate UserStatus model or Redis for real-time)
    // For now, we'll use a simple approach with lastActive timestamp
    user.lastActiveDate = new Date();
    await user.save();
    
    res.json({ success: true, online, lastSeen: Date.now() });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Get user online status
router.get('/user-status/:userId', verifyFirebaseToken, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.params.userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const lastActive = user.lastActiveDate ? new Date(user.lastActiveDate).getTime() : 0;
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const isOnline = lastActive > fiveMinutesAgo;
    
    res.json({ 
      online: isOnline, 
      lastSeen: lastActive 
    });
  } catch (error) {
    console.error('Get user status error:', error);
    res.status(500).json({ error: 'Failed to get user status' });
  }
});

// Mark messages as read
router.post('/:conversationId/read', verifyFirebaseToken, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Mark all messages from other users as read
    conversation.messages.forEach(msg => {
      if (msg.senderId !== req.user.uid) {
        msg.isRead = true;
      }
    });

    await conversation.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Mark messages as read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

export default router;
