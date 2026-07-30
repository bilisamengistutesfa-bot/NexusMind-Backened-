import express from 'express';
import Notification from '../models/Notification.js';
import { verifyFirebaseToken } from '../middleware/auth.js';

const router = express.Router();

// Get notifications for user
router.get('/:userId', verifyFirebaseToken, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Create notification
router.post('/', verifyFirebaseToken, async (req, res) => {
  try {
    const notification = new Notification({
      ...req.body,
      createdAt: new Date()
    });
    await notification.save();
    res.json({ success: true, notification });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// Mark notification as read
router.put('/:notificationId/read', verifyFirebaseToken, async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.notificationId,
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read for user
router.put('/:userId/read-all', verifyFirebaseToken, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.params.userId },
      { read: true }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Delete notification
router.delete('/:notificationId', verifyFirebaseToken, async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.notificationId);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

export default router;
