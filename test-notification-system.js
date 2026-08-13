// Simple notification system test script
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:3001/api';

const testUserId = 'test-user-' + Date.now();
let testNotificationId = null;

console.log('🧪 Starting Notification System Tests');
console.log('=====================================\n');

async function runTests() {
  // Test 1: Create Notification
  console.log('Test 1: Creating notification...');
  try {
    const response = await fetch(`${BASE_URL}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUserId,
        type: 'solution',
        text: 'Test notification for system verification',
        senderName: 'System Test',
        avatar: 'https://picsum.photos/seed/test/100/100',
        read: false
      })
    });
    
    const data = await response.json();
    if (data.success) {
      console.log('✅ Notification created successfully');
      console.log('   Notification ID:', data.notification.id);
      testNotificationId = data.notification.id;
    } else {
      console.log('❌ Failed to create notification');
    }
  } catch (error) {
    console.log('❌ Error creating notification:', error.message);
  }

  // Test 2: Get Notifications
  console.log('\nTest 2: Retrieving notifications...');
  try {
    const response = await fetch(`${BASE_URL}/notifications/${testUserId}`);
    const notifications = await response.json();
    
    if (Array.isArray(notifications) && notifications.length > 0) {
      console.log('✅ Notifications retrieved successfully');
      console.log('   Number of notifications:', notifications.length);
      console.log('   First notification:', notifications[0].text);
    } else {
      console.log('❌ No notifications found or error occurred');
    }
  } catch (error) {
    console.log('❌ Error retrieving notifications:', error.message);
  }

  // Test 3: Mark Notification as Read
  console.log('\nTest 3: Marking notification as read...');
  if (testNotificationId) {
    try {
      const response = await fetch(`${BASE_URL}/notifications/${testNotificationId}/read`, {
        method: 'PUT'
      });
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Notification marked as read successfully');
      } else {
        console.log('❌ Failed to mark notification as read');
      }
    } catch (error) {
      console.log('❌ Error marking notification as read:', error.message);
    }
  } else {
    console.log('⏭️  Skipping - no notification ID available');
  }

  // Test 4: Mark All as Read
  console.log('\nTest 4: Marking all notifications as read...');
  try {
    const response = await fetch(`${BASE_URL}/notifications/${testUserId}/read-all`, {
      method: 'PUT'
    });
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ All notifications marked as read successfully');
    } else {
      console.log('❌ Failed to mark all notifications as read');
    }
  } catch (error) {
    console.log('❌ Error marking all notifications as read:', error.message);
  }

  // Test 5: Delete Notification
  console.log('\nTest 5: Deleting notification...');
  if (testNotificationId) {
    try {
      const response = await fetch(`${BASE_URL}/notifications/${testNotificationId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Notification deleted successfully');
      } else {
        console.log('❌ Failed to delete notification');
      }
    } catch (error) {
      console.log('❌ Error deleting notification:', error.message);
    }
  } else {
    console.log('⏭️  Skipping - no notification ID available');
  }

  // Test 6: Verify Deletion
  console.log('\nTest 6: Verifying notification deletion...');
  try {
    const response = await fetch(`${BASE_URL}/notifications/${testUserId}`);
    const notifications = await response.json();
    
    if (Array.isArray(notifications)) {
      console.log('✅ Verification complete');
      console.log('   Remaining notifications:', notifications.length);
    } else {
      console.log('❌ Error during verification');
    }
  } catch (error) {
    console.log('❌ Error during verification:', error.message);
  }

  console.log('\n=====================================');
  console.log('🧪 Notification System Tests Complete');
  console.log('\nUser ID for manual testing:', testUserId);
  console.log('You can use this ID to test the frontend notification system.\n');
}

runTests().catch(console.error);