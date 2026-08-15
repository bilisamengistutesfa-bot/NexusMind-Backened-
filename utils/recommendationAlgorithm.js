import Post from '../models/Post.js';
import User from '../models/User.js';

/**
 * Advanced Recommendation Algorithm for NexusMind
 * This algorithm uses multiple factors to recommend personalized content:
 * 1. User Interest Matching (primary factor)
 * 2. Category Separation (ensures categories don't mix)
 * 3. Engagement Scoring (votes, solutions, comments)
 * 4. Recency (fresh content)
 * 5. User Activity Patterns
 */

class RecommendationAlgorithm {
  /**
   * Calculate relevance score for a post based on user interests
   * @param {Object} post - Post object
   * @param {Array} userInterests - User's selected interests
   * @returns {Number} - Relevance score (0-100)
   */
  static calculateInterestScore(post, userInterests) {
    if (!userInterests || userInterests.length === 0) return 50; // Default score if no interests
    
    const postInterests = post.interests || [];
    const postCategory = post.category;
    
    // Convert both to lowercase for case-insensitive matching
    const normalizedUserInterests = userInterests.map(i => i.toLowerCase());
    const normalizedPostInterests = postInterests.map(i => i.toLowerCase());
    const normalizedCategory = postCategory.toLowerCase();
    
    let score = 0;
    
    // Direct interest matches (highest weight)
    const directMatches = normalizedPostInterests.filter(interest => 
      normalizedUserInterests.includes(interest)
    );
    score += directMatches.length * 30; // 30 points per direct match
    
    // Category matching (medium weight)
    if (normalizedUserInterests.some(interest => interest.includes(normalizedCategory) || normalizedCategory.includes(interest))) {
      score += 20;
    }
    
    // Partial matches (lower weight)
    const partialMatches = normalizedPostInterests.filter(interest =>
      normalizedUserInterests.some(userInterest =>
        interest.includes(userInterest) || userInterest.includes(interest)
      )
    );
    score += partialMatches.length * 10;
    
    // Cap at 100
    return Math.min(score, 100);
  }

  /**
   * Calculate engagement score for a post
   * @param {Object} post - Post object
   * @returns {Number} - Engagement score (0-100)
   */
  static calculateEngagementScore(post) {
    let score = 0;
    
    // Votes (up to 40 points)
    score += Math.min(post.votes * 2, 40);
    
    // Solutions (up to 30 points)
    score += Math.min(post.solutions?.length * 10, 30);
    
    // Comments (up to 20 points)
    score += Math.min(post.comments?.length * 5, 20);
    
    // Solved bonus (10 points)
    if (post.isSolved) {
      score += 10;
    }
    
    return Math.min(score, 100);
  }

  /**
   * Calculate recency score (favors newer content)
   * @param {Date} postTimestamp - Post creation date
   * @returns {Number} - Recency score (0-100)
   */
  static calculateRecencyScore(postTimestamp) {
    const now = new Date();
    const postDate = new Date(postTimestamp);
    const hoursOld = (now - postDate) / (1000 * 60 * 60);
    
    // Fresh content (< 24 hours) gets highest score
    if (hoursOld < 24) {
      return 100 - (hoursOld / 24) * 20; // 80-100
    } else if (hoursOld < 168) { // < 1 week
      return 80 - ((hoursOld - 24) / 144) * 40; // 40-80
    } else if (hoursOld < 720) { // < 1 month
      return 40 - ((hoursOld - 168) / 552) * 30; // 10-40
    } else {
      return 10; // Old content gets minimum score
    }
  }

  /**
   * Calculate final recommendation score
   * @param {Object} post - Post object
   * @param {Array} userInterests - User's selected interests
   * @returns {Object} - Score breakdown and final score
   */
  static calculateFinalScore(post, userInterests) {
    const interestScore = this.calculateInterestScore(post, userInterests);
    const engagementScore = this.calculateEngagementScore(post);
    const recencyScore = this.calculateRecencyScore(post.timestamp);
    
    // Weighted average (interest is most important)
    const finalScore = (
      interestScore * 0.5 +      // 50% weight on interest matching
      engagementScore * 0.3 +    // 30% weight on engagement
      recencyScore * 0.2         // 20% weight on recency
    );
    
    return {
      interestScore,
      engagementScore,
      recencyScore,
      finalScore: Math.round(finalScore * 100) / 100
    };
  }

  /**
   * Filter posts by category to prevent category mixing
   * @param {Array} posts - All posts
   * @param {Array} userInterests - User's selected interests
   * @returns {Array} - Filtered posts with category separation
   */
  static filterByCategorySeparation(posts, userInterests) {
    if (!userInterests || userInterests.length === 0) return posts;
    
    // Map interests to their categories
    const interestCategories = {
      'business': 'Business & Money',
      'startups': 'Business & Money',
      'entrepreneurship': 'Business & Money',
      'marketing': 'Business & Money',
      'sales': 'Business & Money',
      'finance': 'Business & Money',
      'investing': 'Business & Money',
      'technology': 'Technology',
      'ai': 'Technology',
      'programming': 'Technology',
      'cybersecurity': 'Technology',
      'software-development': 'Technology',
      'data-science': 'Technology',
      'education': 'Learning & Education',
      'science': 'Learning & Education',
      'mathematics': 'Learning & Education',
      'languages': 'Learning & Education',
      'research': 'Learning & Education',
      'design': 'Creativity',
      'writing': 'Creativity',
      'photography': 'Creativity',
      'music': 'Creativity',
      'art': 'Creativity',
      'video-creation': 'Creativity',
      'health-wellness': 'Life',
      'fitness': 'Life',
      'food-cooking': 'Life',
      'travel': 'Life',
      'lifestyle': 'Life',
      'productivity': 'Life',
      'career': 'Career & People',
      'leadership': 'Career & People',
      'communication': 'Career & People',
      'personal-development': 'Career & People',
      'relationships': 'Career & People',
      'gaming': 'Entertainment',
      'movies-tv': 'Entertainment',
      'books': 'Entertainment',
      'sports': 'Entertainment'
    };
    
    // Get the categories user is interested in
    const userCategories = [...new Set(
      userInterests
        .map(interest => interestCategories[interest.toLowerCase()])
        .filter(category => category)
    )];
    
    // Filter posts to only show posts from user's interested categories
    return posts.filter(post => {
      const postCategory = post.category;
      return userCategories.includes(postCategory) || 
             userInterests.some(interest => 
               postCategory.toLowerCase().includes(interest.toLowerCase()) ||
               interest.toLowerCase().includes(postCategory.toLowerCase())
             );
    });
  }

  /**
   * Get personalized feed for a user
   * @param {String} userId - User's Firebase UID
   * @returns {Array} - Personalized and sorted posts
   */
  static async getPersonalizedFeed(userId) {
    try {
      // Get user's interests
      const user = await User.findOne({ firebaseUid: userId });
      const userInterests = user?.interests || [];
      
      console.log('Generating personalized feed for user:', userId);
      console.log('User interests:', userInterests);
      
      // Get all posts
      const allPosts = await Post.find().sort({ timestamp: -1 }).limit(100);
      
      // Filter by category separation (prevent category mixing)
      const categoryFilteredPosts = this.filterByCategorySeparation(allPosts, userInterests);
      console.log('Posts after category filtering:', categoryFilteredPosts.length);
      
      // Calculate scores for each post
      const scoredPosts = categoryFilteredPosts.map(post => {
        const scoreData = this.calculateFinalScore(post, userInterests);
        return {
          ...post.toObject(),
          id: post._id.toString(),
          recommendationScore: scoreData.finalScore,
          scoreBreakdown: scoreData
        };
      });
      
      // Sort by recommendation score (highest first)
      const sortedPosts = scoredPosts.sort((a, b) => 
        b.recommendationScore - a.recommendationScore
      );
      
      console.log('Top 5 post scores:', sortedPosts.slice(0, 5).map(p => ({
        id: p.id,
        category: p.category,
        score: p.recommendationScore
      })));
      
      return sortedPosts;
    } catch (error) {
      console.error('Error generating personalized feed:', error);
      // Fallback to recent posts if algorithm fails
      const fallbackPosts = await Post.find().sort({ timestamp: -1 }).limit(50);
      return fallbackPosts.map(post => ({
        ...post.toObject(),
        id: post._id.toString(),
        recommendationScore: 0
      }));
    }
  }

  /**
   * Get posts by specific category (for category-specific feeds)
   * @param {String} category - Category name
   * @param {String} userId - User's Firebase UID (for interest matching within category)
   * @returns {Array} - Category-filtered and sorted posts
   */
  static async getCategoryFeed(category, userId) {
    try {
      const user = await User.findOne({ firebaseUid: userId });
      const userInterests = user?.interests || [];
      
      // Get posts from specific category only
      const categoryPosts = await Post.find({ 
        category: { $regex: new RegExp(category, 'i') }
      }).sort({ timestamp: -1 }).limit(100);
      
      // Score posts within the category based on user interests
      const scoredPosts = categoryPosts.map(post => {
        const scoreData = this.calculateFinalScore(post, userInterests);
        return {
          ...post.toObject(),
          id: post._id.toString(),
          recommendationScore: scoreData.finalScore,
          scoreBreakdown: scoreData
        };
      });
      
      // Sort by recommendation score within the category
      return scoredPosts.sort((a, b) => 
        b.recommendationScore - a.recommendationScore
      );
    } catch (error) {
      console.error('Error generating category feed:', error);
      const fallbackPosts = await Post.find({ 
        category: { $regex: new RegExp(category, 'i') }
      }).sort({ timestamp: -1 }).limit(50);
      return fallbackPosts.map(post => ({
        ...post.toObject(),
        id: post._id.toString(),
        recommendationScore: 0
      }));
    }
  }
}

export default RecommendationAlgorithm;