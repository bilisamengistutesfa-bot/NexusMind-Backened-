import Post from '../models/Post.js';
import User from '../models/User.js';

/**
 * Advanced Search Engine for NexusMind
 * Provides comprehensive search across all content types with relevance scoring
 */

class SearchEngine {
  /**
   * Calculate relevance score for a search result
   * @param {Object} item - The item to score (user or post)
   * @param {String} query - The search query
   * @param {String} type - The type of item ('user' or 'post')
   * @returns {Number} - Relevance score (0-100)
   */
  static calculateRelevanceScore(item, query, type) {
    const normalizedQuery = query.toLowerCase();
    let score = 0;

    if (type === 'user') {
      // Name matching (highest weight)
      if (item.name?.toLowerCase().includes(normalizedQuery)) {
        score += 40;
        if (item.name.toLowerCase() === normalizedQuery) score += 20; // Exact match bonus
      }

      // Username matching
      if (item.username?.toLowerCase().includes(normalizedQuery)) {
        score += 30;
        if (item.username.toLowerCase() === normalizedQuery) score += 15;
      }

      // Bio matching
      if (item.bio?.toLowerCase().includes(normalizedQuery)) {
        score += 20;
      }

      // Expertise matching
      if (item.expertise?.some(exp => exp.toLowerCase().includes(normalizedQuery))) {
        score += 15;
      }

      // Interest matching
      if (item.interests?.some(interest => interest.toLowerCase().includes(normalizedQuery))) {
        score += 10;
      }

      // Reputation boost (higher reputation = more relevant)
      score += Math.min(item.reputation || 0, 10);

    } else if (type === 'post') {
      // Title matching (highest weight)
      if (item.title?.toLowerCase().includes(normalizedQuery)) {
        score += 35;
        if (item.title.toLowerCase() === normalizedQuery) score += 15;
      }

      // Content matching
      if (item.content?.toLowerCase().includes(normalizedQuery)) {
        score += 25;
        // Count occurrences for multi-occurrence boost
        const occurrences = (item.content.toLowerCase().match(new RegExp(normalizedQuery, 'g')) || []).length;
        score += Math.min(occurrences * 5, 15);
      }

      // Category matching
      if (item.category?.toLowerCase().includes(normalizedQuery)) {
        score += 20;
      }

      // Interest tags matching
      if (item.interests?.some(interest => interest.toLowerCase().includes(normalizedQuery))) {
        score += 15;
      }

      // Author name matching
      if (item.userName?.toLowerCase().includes(normalizedQuery)) {
        score += 10;
      }

      // Engagement boost (popular posts are more relevant)
      const engagementScore = (item.votes || 0) * 0.5 + (item.solutions?.length || 0) * 2;
      score += Math.min(engagementScore, 15);

      // Recency boost (newer posts are slightly more relevant)
      const daysSincePost = (Date.now() - new Date(item.timestamp)) / (1000 * 60 * 60 * 24);
      if (daysSincePost < 1) score += 10;
      else if (daysSincePost < 7) score += 5;
      else if (daysSincePost < 30) score += 2;
    }

    return Math.min(score, 100);
  }

  /**
   * Search across all content types
   * @param {String} query - Search query
   * @param {Object} options - Search options
   * @returns {Object} - Search results with users, posts, and metadata
   */
  static async searchAll(query, options = {}) {
    const {
      limit = 20,
      type = 'all', // 'all', 'users', 'posts'
      category = null,
      sortBy = 'relevance' // 'relevance', 'recent', 'popular'
    } = options;

    const normalizedQuery = query.toLowerCase().trim();
    
    if (!normalizedQuery) {
      return {
        users: [],
        posts: [],
        total: 0,
        query,
        suggestions: this.getSearchSuggestions(query)
      };
    }

    let users = [];
    let posts = [];

    // Search users
    if (type === 'all' || type === 'users') {
      try {
        const userQuery = {
          $or: [
            { name: { $regex: normalizedQuery, $options: 'i' } },
            { username: { $regex: normalizedQuery, $options: 'i' } },
            { bio: { $regex: normalizedQuery, $options: 'i' } },
            { interests: { $in: [new RegExp(normalizedQuery, 'i')] } },
            { expertise: { $in: [new RegExp(normalizedQuery, 'i')] } }
          ]
        };

        const rawUsers = await User.find(userQuery)
          .select('-firebaseUid -email -password')
          .limit(limit);

        users = rawUsers.map(user => ({
          ...user.toObject(),
          id: user._id.toString(),
          relevanceScore: this.calculateRelevanceScore(user, query, 'user')
        }));
      } catch (error) {
        console.error('Error searching users:', error);
      }
    }

    // Search posts
    if (type === 'all' || type === 'posts') {
      try {
        const postQuery = {
          $or: [
            { title: { $regex: normalizedQuery, $options: 'i' } },
            { content: { $regex: normalizedQuery, $options: 'i' } },
            { category: { $regex: normalizedQuery, $options: 'i' } },
            { interests: { $in: [new RegExp(normalizedQuery, 'i')] } },
            { userName: { $regex: normalizedQuery, $options: 'i' } }
          ]
        };

        // Add category filter if specified
        if (category) {
          postQuery.category = { $regex: new RegExp(category, 'i') };
        }

        const rawPosts = await Post.find(postQuery)
          .sort({ timestamp: -1 })
          .limit(limit);

        posts = rawPosts.map(post => ({
          ...post.toObject(),
          id: post._id.toString(),
          relevanceScore: this.calculateRelevanceScore(post, query, 'post')
        }));
      } catch (error) {
        console.error('Error searching posts:', error);
      }
    }

    // Sort results based on preference
    if (sortBy === 'relevance') {
      users.sort((a, b) => b.relevanceScore - a.relevanceScore);
      posts.sort((a, b) => b.relevanceScore - a.relevanceScore);
    } else if (sortBy === 'recent') {
      posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } else if (sortBy === 'popular') {
      posts.sort((a, b) => (b.votes || 0) - (a.votes || 0));
    }

    // Filter low relevance results
    users = users.filter(user => user.relevanceScore > 10);
    posts = posts.filter(post => post.relevanceScore > 10);

    return {
      users: users.slice(0, limit),
      posts: posts.slice(0, limit),
      total: users.length + posts.length,
      query,
      suggestions: this.getSearchSuggestions(query)
    };
  }

  /**
   * Get search suggestions based on query
   * @param {String} query - Current search query
   * @returns {Array} - Array of suggestion strings
   */
  static getSearchSuggestions(query) {
    const suggestions = [];
    const normalizedQuery = query.toLowerCase();

    // Common search patterns
    const patterns = [
      'how to',
      'best way to',
      'tips for',
      'guide to',
      'learn',
      'career',
      'business',
      'health',
      'technology',
      'education'
    ];

    if (normalizedQuery.length < 2) {
      return patterns.map(p => `${p} ${query}`);
    }

    // Generate contextual suggestions
    if (normalizedQuery.startsWith('how to')) {
      suggestions.push(`${query} for beginners`, `${query} step by step`, `${query} tips`);
    } else if (normalizedQuery.startsWith('best')) {
      suggestions.push(`${query} in 2024`, `${query} for professionals`, `${query} tools`);
    } else if (normalizedQuery.startsWith('learn')) {
      suggestions.push(`${query} online`, `${query} fast`, `${query} from experts`);
    } else {
      suggestions.push(`${query} solutions`, `${query} advice`, `${query} guide`);
    }

    return suggestions.slice(0, 5);
  }

  /**
   * Get trending search terms based on recent search activity
   * @returns {Array} - Array of trending terms with metadata
   */
  static async getTrendingSearches() {
    // This would typically come from analytics/search logs
    // For now, return simulated trending data
    const trending = [
      { term: 'artificial intelligence', searches: 15420, growth: 25 },
      { term: 'remote work tips', searches: 12350, growth: 18 },
      { term: 'mental health awareness', searches: 11200, growth: 22 },
      { term: 'career development', searches: 10800, growth: 15 },
      { term: 'side business ideas', searches: 9800, growth: 20 },
      { term: 'productivity hacks', searches: 9200, growth: 17 },
      { term: 'learning new skills', searches: 8700, growth: 19 },
      { term: 'creative problem solving', searches: 7800, growth: 16 },
    ];

    return trending.sort((a, b) => b.growth - a.growth);
  }

  /**
   * Get popular categories based on post count and activity
   * @returns {Array} - Array of popular categories with metadata
   */
  static async getPopularCategories() {
    try {
      const categoryStats = await Post.aggregate([
        {
          $group: {
            _id: '$category',
            postCount: { $sum: 1 },
            totalVotes: { $sum: '$votes' },
            totalSolutions: { $sum: { $size: '$solutions' } },
            latestPost: { $max: '$timestamp' }
          }
        },
        {
          $sort: { postCount: -1 }
        },
        {
          $limit: 10
        }
      ]);

      return categoryStats.map(stat => ({
        name: stat._id,
        postCount: stat.postCount,
        engagement: stat.totalVotes + (stat.totalSolutions * 2),
        activity: this.calculateActivityScore(stat.latestPost),
        growth: Math.floor(Math.random() * 20) + 5 // Simulated growth
      }));
    } catch (error) {
      console.error('Error getting popular categories:', error);
      return [];
    }
  }

  /**
   * Calculate activity score based on recency
   * @param {Date} timestamp - Latest post timestamp
   * @returns {Number} - Activity score (0-100)
   */
  static calculateActivityScore(timestamp) {
    const now = new Date();
    const postDate = new Date(timestamp);
    const hoursSincePost = (now - postDate) / (1000 * 60 * 60);

    if (hoursSincePost < 1) return 100;
    if (hoursSincePost < 24) return 80;
    if (hoursSincePost < 168) return 60; // 1 week
    if (hoursSincePost < 720) return 40; // 1 month
    return 20;
  }

  /**
   * Advanced search with filters
   * @param {String} query - Search query
   * @param {Object} filters - Search filters
   * @returns {Object} - Filtered search results
   */
  static async advancedSearch(query, filters = {}) {
    const {
      categories = [],
      dateRange = null,
      minVotes = 0,
      hasSolutions = false,
      userId = null
    } = filters;

    const baseResults = await this.searchAll(query, { type: 'posts' });

    let filteredPosts = baseResults.posts;

    // Apply category filter
    if (categories.length > 0) {
      filteredPosts = filteredPosts.filter(post =>
        categories.some(cat => post.category?.toLowerCase().includes(cat.toLowerCase()))
      );
    }

    // Apply date range filter
    if (dateRange) {
      const now = new Date();
      const startDate = new Date();
      
      switch (dateRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      filteredPosts = filteredPosts.filter(post =>
        new Date(post.timestamp) >= startDate
      );
    }

    // Apply minimum votes filter
    if (minVotes > 0) {
      filteredPosts = filteredPosts.filter(post => (post.votes || 0) >= minVotes);
    }

    // Apply solutions filter
    if (hasSolutions) {
      filteredPosts = filteredPosts.filter(post => post.solutions?.length > 0);
    }

    // Apply user filter
    if (userId) {
      filteredPosts = filteredPosts.filter(post => post.userId === userId);
    }

    return {
      ...baseResults,
      posts: filteredPosts,
      total: filteredPosts.length
    };
  }
}

export default SearchEngine;