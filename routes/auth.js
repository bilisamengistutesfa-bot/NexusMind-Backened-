import express from 'express';
import User from '../models/User.js';
import { verifyFirebaseToken } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const router = express.Router();

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Password validation - at least 8 characters, 1 uppercase, 1 lowercase, 1 number
const validatePassword = (password) => {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true };
};

// Register new user with email and password
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, avatar } = req.body;

    // Validate email
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate Firebase UID (for compatibility)
    const firebaseUid = crypto.randomUUID();

    // Create username from name
    const displayName = `${firstName} ${lastName}`;
    const username = displayName.toLowerCase().replace(/\s+/g, '');

    // Create new user
    const user = new User({
      firebaseUid,
      email,
      password: hashedPassword,
      name: displayName,
      username,
      avatar: avatar,
      reputation: 0,
      onboardingComplete: false
    });

    await user.save();
    console.log('New user registered via backend:', username);

    res.status(201).json({ 
      success: true,
      user: {
        id: user._id.toString(),
        firebaseUid: user.firebaseUid,
        name: user.name,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        reputation: user.reputation,
        onboardingComplete: user.onboardingComplete
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login with email and password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate email
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Validate password
    if (!password || password.length < 1) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if user has password (might be Google auth user)
    if (!user.password) {
      return res.status(401).json({ error: 'Please sign in with Google' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    console.log('User logged in via backend:', user.username);

    res.json({ 
      success: true,
      user: {
        id: user._id.toString(),
        firebaseUid: user.firebaseUid,
        name: user.name,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        reputation: user.reputation,
        onboardingComplete: user.onboardingComplete
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify Firebase token and sync/create user (for Google auth)
router.post('/verify', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid, email } = req.user;
    const { photoURL, displayName } = req.body;
    console.log('Auth verify - Firebase UID:', uid, 'Email:', email, 'PhotoURL:', photoURL);

    // Find or create user
    let user = await User.findOne({ firebaseUid: uid });
    
    if (!user) {
      console.log('User not found, creating new user for Firebase UID:', uid);
      // Create new user with Google profile image
      user = new User({
        firebaseUid: uid,
        email: email || '',
        name: displayName || email?.split('@')[0] || 'User',
        username: (displayName || email?.split('@')[0] || 'user').toLowerCase().replace(/\s+/g, ''),
        avatar: photoURL,
        reputation: 0,
        onboardingComplete: false
      });
      await user.save();
      console.log('New user created in MongoDB via Google auth:', user.username);
    } else {
      console.log('Existing user found:', user.username);
      // Update avatar if provided and user doesn't have one
      if (photoURL && !user.avatar) {
        user.avatar = photoURL;
        await user.save();
        console.log('Updated avatar for existing user:', user.username);
      }
    }

    res.json({ 
      valid: true, 
      userId: user._id.toString(),
      firebaseUid: uid,
      user: {
        id: user._id.toString(),
        firebaseUid: user.firebaseUid,
        name: user.name,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        reputation: user.reputation,
        onboardingComplete: user.onboardingComplete
      }
    });
  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

export default router;
