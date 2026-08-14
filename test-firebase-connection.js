import dotenv from 'dotenv';
import firebaseAdmin from 'firebase-admin';

dotenv.config();

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
const app = firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount)
}, 'test-connection');

const db = app.database();

// Test writing to Firebase Realtime Database
const testRef = db.ref('test_notifications/test-user-id').push();
await testRef.set({
  id: testRef.key,
  text: 'Test notification',
  timestamp: Date.now()
});

console.log('Written to Firebase Realtime Database');

// Test reading from Firebase Realtime Database
const snapshot = await db.ref('test_notifications/test-user-id').once('value');
const data = snapshot.val();
console.log('Read from Firebase Realtime Database:', data);

// Clean up
await db.ref('test_notifications/test-user-id').remove();
console.log('Cleaned up test data');

process.exit(0);