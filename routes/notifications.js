import express from 'express';
import Notification from '../models/Notification.js';
import { verifyFirebaseToken, optionalAuth } from '../middleware/auth.js';
import firebaseAdmin from 'firebase-admin';

const router = express.Router();

let firebaseApp;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    firebaseApp = firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount)
    }, 'notifications-routes');
  }
} catch (error) {
  console.warn('Firebase Admin not initialized in notifications routes');
}

// Helper to check if MongoDB is available
const isMongoDBAvailable = async () => {
  try {
    await Notification.findOne().limit(1);
    return true;
  } catch (error) {
    return false;
  }
};

// Get notifications for user
router.get('/:userId', optionalAuth, async (req, res) => {
  try {
    const mongoAvailable = await isMongoDBAvailable();
    
    if (mongoAvailable) {
      const notifications = await Notification.find({ userId: req.params.userId })
        .sort({ createdAt: -1 })
        .limit(50);
      res.json(notifications);
    } else {
      // Fallback to in-memory storage (not persistent but works for testing)
      if (!global.notificationsStore) {
        global.notificationsStore = {};
      }
      const userNotifications = global.notificationsStore[req.params.userId] || [];
      res.json(userNotifications);
    }
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Create notification
router.post('/', optionalAuth, async (req, res) => {
  try {
    const mongoAvailable = await isMongoDBAvailable();
    
    if (mongoAvailable) {
      const notification = new Notification({
        ...req.body,
        createdAt: new Date()
      });
      await notification.save();
      res.json({ success: true, notification });
    } else {
      // Fallback to in-memory storage (not persistent but works for testing)
      if (!global.notificationsStore) {
        global.notificationsStore = {};
      }
      const notification = {
        id: `notif-${Date.now()}`,
        ...req.body,
        read: false,
        createdAt: new Date().toISOString(),
        time: 'Just now'
      };
      
      const userId = req.body.userId;
      if (!global.notificationsStore[userId]) {
        global.notificationsStore[userId] = [];
      }
      global.notificationsStore[userId].unshift(notification);
      
      res.json({ success: true, notification });
    }
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// Mark notification as read
router.put('/:notificationId/read', optionalAuth, async (req, res) => {
  try {
    const mongoAvailable = await isMongoDBAvailable();
    
    if (mongoAvailable) {
      const notification = await Notification.findByIdAndUpdate(
        req.params.notificationId,
        { read: true },
        { new: true }
      );
      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }
      res.json({ success: true });
    } else {
      // Fallback to in-memory storage
      if (global.notificationsStore) {
        for (const userId in global.notificationsStore) {
          const notification = global.notificationsStore[userId].find(n => n.id === req.params.notificationId);
          if (notification) {
            notification.read = true;
            res.json({ success: true });
            return;
          }
        }
        res.status(404).json({ error: 'Notification not found' });
      } else {
        res.json({ success: true });
      }
    }
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read for user
router.put('/:userId/read-all', optionalAuth, async (req, res) => {
  try {
    const mongoAvailable = await isMongoDBAvailable();
    
    if (mongoAvailable) {
      await Notification.updateMany(
        { userId: req.params.userId },
        { read: true }
      );
      res.json({ success: true });
    } else {
      // Fallback to in-memory storage
      if (global.notificationsStore && global.notificationsStore[req.params.userId]) {
        global.notificationsStore[req.params.userId].forEach(notification => {
          notification.read = true;
        });
      }
      res.json({ success: true });
    }
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Delete notification
router.delete('/:notificationId', optionalAuth, async (req, res) => {
  try {
    const mongoAvailable = await isMongoDBAvailable();
    
    if (mongoAvailable) {
      const notification = await Notification.findByIdAndDelete(req.params.notificationId);
      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }
      res.json({ success: true });
    } else {
      // Fallback to in-memory storage
      if (global.notificationsStore) {
        for (const userId in global.notificationsStore) {
          const index = global.notificationsStore[userId].findIndex(n => n.id === req.params.notificationId);
          if (index !== -1) {
            global.notificationsStore[userId].splice(index, 1);
            res.json({ success: true });
            return;
          }
        }
        res.status(404).json({ error: 'Notification not found' });
      } else {
        res.json({ success: true });
      }
    }
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

export default router;
