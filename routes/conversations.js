import express from 'express';
import Conversation from '../models/Conversation.js';
import { verifyFirebaseToken } from '../middleware/auth.js';

const router = express.Router();

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

export default router;
