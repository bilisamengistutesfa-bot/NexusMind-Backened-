import express from 'express';
import User from '../models/User.js';
import Post from '../models/Post.js';
import { verifyFirebaseToken } from '../middleware/auth.js';
import SearchEngine from '../utils/searchEngine.js';

const router = express.Router();

// Global search with advanced relevance scoring
router.get('/', verifyFirebaseToken, async (req, res) => {
  try {
    const { q, type, category, sortBy } = req.query;
    
    if (!q) {
      return res.json({ 
        users: [], 
        posts: [], 
        groups: [],
        trending: await SearchEngine.getTrendingSearches(),
        popularCategories: await SearchEngine.getPopularCategories()
      });
    }

    const query = q.trim();
    const options = {
      type: type || 'all',
      category: category || null,
      sortBy: sortBy || 'relevance',
      limit: 20
    };

    // Use advanced search engine
    const searchResults = await SearchEngine.searchAll(query, options);

    res.json({ 
      users: searchResults.users,
      posts: searchResults.posts,
      groups: [],
      total: searchResults.total,
      suggestions: searchResults.suggestions,
      trending: await SearchEngine.getTrendingSearches(),
      popularCategories: await SearchEngine.getPopularCategories()
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Advanced search with filters
router.post('/advanced', verifyFirebaseToken, async (req, res) => {
  try {
    const { query, filters } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const searchResults = await SearchEngine.advancedSearch(query, filters);

    res.json(searchResults);
  } catch (error) {
    console.error('Advanced search error:', error);
    res.status(500).json({ error: 'Advanced search failed' });
  }
});

// Get trending searches
router.get('/trending', verifyFirebaseToken, async (req, res) => {
  try {
    const trending = await SearchEngine.getTrendingSearches();
    res.json(trending);
  } catch (error) {
    console.error('Get trending error:', error);
    res.status(500).json({ error: 'Failed to get trending searches' });
  }
});

// Get popular categories
router.get('/categories', verifyFirebaseToken, async (req, res) => {
  try {
    const categories = await SearchEngine.getPopularCategories();
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to get popular categories' });
  }
});

export default router;
