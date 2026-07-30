// Simple auth middleware - verifies Firebase token from Authorization header
import firebaseAdmin from 'firebase-admin';

let firebaseApp;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    firebaseApp = firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount)
    }, 'auth-middleware');
  }
} catch (error) {
  console.warn('Firebase Admin not initialized in auth middleware');
}

export const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    if (firebaseApp) {
      // Verify with Firebase Admin if available
      const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified
      };
    } else {
      // For development without Firebase Admin, just decode the token
      // This is less secure but allows development
      try {
        const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        req.user = {
          uid: decoded.user_id || decoded.uid,
          email: decoded.email
        };
      } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);

    if (firebaseApp) {
      try {
        const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
        req.user = {
          uid: decodedToken.uid,
          email: decodedToken.email,
          emailVerified: decodedToken.email_verified
        };
      } catch (e) {
        // Token invalid, but continue without auth
        next();
        return;
      }
    }

    next();
  } catch (error) {
    next();
  }
};
