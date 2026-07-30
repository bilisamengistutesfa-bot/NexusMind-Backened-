# NexusMind Backend

Simple and scalable backend for NexusMind platform, designed for Render deployment.

This is the standalone backend repository for NexusMind. The frontend is maintained in a separate repository.

## Features

- **Authentication**: Firebase token verification
- **Users**: Profile management, interests, following system
- **Posts**: Create, read, update, delete posts with voting
- **Solutions**: Add solutions to posts with voting and helpful marking
- **Notifications**: Real-time notification system
- **Messaging**: Conversation and message management
- **Feedback**: User feedback collection
- **Search**: Global search across users and posts

## Tech Stack

- Node.js with Express
- MongoDB with Mongoose
- Firebase Admin (for token verification)
- CORS enabled for frontend integration

## Setup

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Configure environment variables:
- `MONGODB_URI`: MongoDB connection string
- `FIREBASE_SERVICE_ACCOUNT_KEY`: Firebase service account JSON (optional)
- `CLIENT_URL`: Frontend URL (default: http://localhost:5173)

4. Start the server:
```bash
npm run dev
```

Server will run on `http://localhost:3001`

### MongoDB Setup

For local development, you can use MongoDB locally or MongoDB Atlas:

**Local MongoDB:**
```bash
# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Or install MongoDB directly
# https://www.mongodb.com/docs/manual/installation/
```

**MongoDB Atlas (Recommended for production):**
1. Create account at https://www.mongodb.com/cloud/atlas
2. Create a free cluster
3. Get connection string from Atlas dashboard
4. Set `MONGODB_URI` in `.env`

### Firebase Setup (Optional)

Firebase Admin is optional for basic operations. Without it, the backend will use a simpler token verification for development.

For production:
1. Go to Firebase Console > Project Settings > Service Accounts
2. Generate a new private key
3. Copy the JSON content
4. Set `FIREBASE_SERVICE_ACCOUNT_KEY` in `.env` as the JSON string

## API Endpoints

### Health Check
- `GET /api/health` - Server health status

### Authentication
- `POST /api/auth/verify` - Verify Firebase token and sync user

### Users
- `GET /api/users/:userId` - Get user by ID
- `GET /api/users/:userId/profile` - Get user profile
- `POST /api/users/profile` - Create/update profile
- `PUT /api/users/:userId` - Update user
- `PUT /api/users/:userId/interests` - Update interests
- `GET /api/users` - Get all users
- `POST /api/users/by-interests` - Get users by interests
- `POST /api/users/:userId/follow` - Follow user
- `DELETE /api/users/:userId/follow/:targetUserId` - Unfollow user
- `GET /api/users/:userId/saved` - Get saved items
- `POST /api/users/:userId/saved` - Save item
- `DELETE /api/users/:userId/saved/:itemId` - Remove saved item
- `GET /api/users/:userId/activity` - Get activity log

### Posts
- `GET /api/posts` - Get all posts
- `GET /api/posts/all` - Get all posts (no limit)
- `GET /api/posts/:postId` - Get single post
- `POST /api/posts` - Create post
- `PUT /api/posts/:postId` - Update post
- `DELETE /api/posts/:postId` - Delete post
- `POST /api/posts/:postId/vote` - Vote on post
- `POST /api/posts/:postId/solutions` - Add solution
- `POST /api/posts/:postId/solutions/:solutionId/vote` - Vote on solution
- `POST /api/posts/:postId/solutions/:solutionId/helpful` - Mark solution helpful
- `POST /api/posts/:postId/comments` - Add comment

### Notifications
- `GET /api/notifications/:userId` - Get user notifications
- `POST /api/notifications` - Create notification
- `PUT /api/notifications/:notificationId/read` - Mark as read
- `PUT /api/notifications/:userId/read-all` - Mark all as read
- `DELETE /api/notifications/:notificationId` - Delete notification

### Conversations
- `GET /api/conversations/:userId` - Get user conversations
- `GET /api/conversations/id/:conversationId` - Get conversation by ID
- `POST /api/conversations` - Create conversation
- `POST /api/conversations/:conversationId/messages` - Send message
- `GET /api/conversations/:conversationId/messages` - Get messages
- `DELETE /api/conversations/:conversationId` - Delete conversation

### Feedback
- `POST /api/feedback` - Submit feedback
- `GET /api/feedback/user/:userId` - Get user feedback
- `GET /api/feedback` - Get all feedback

### Search
- `GET /api/search?q=query` - Global search

## Deployment to Render

1. Push code to GitHub
2. Go to Render dashboard
3. Create new Web Service
4. Connect your repository
5. Configure:
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
6. Add environment variables:
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   - `FIREBASE_SERVICE_ACCOUNT_KEY`: Firebase service account JSON
   - `CLIENT_URL`: Your frontend URL
   - `JWT_SECRET`: Generate a random secret
7. Deploy

Or use the provided `render.yaml` for blueprint deployment.

## Architecture

The backend follows a simple, scalable architecture:

- **Express.js** for HTTP server and routing
- **Mongoose** for MongoDB ODM and data modeling
- **Middleware** for authentication and error handling
- **Routes** organized by feature (auth, users, posts, etc.)
- **Models** for database schema definition

## Scalability Considerations

- MongoDB indexes for efficient queries
- Pagination support on list endpoints
- Environment-based configuration
- Stateless API design
- CORS enabled for multi-origin support
- Health check endpoint for monitoring

## Future Enhancements

- WebSocket support for real-time messaging
- Redis caching for frequently accessed data
- Rate limiting for API protection
- File upload handling (images, videos)
- Email notifications
- Push notifications via Firebase Cloud Messaging
