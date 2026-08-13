/**
 * Query Controller
 * 
 * Handles HTTP requests for structured query execution and natural language queries.
 */

import executeQuery from '../services/queryExecutor.js';
import { lookupCachedQuery, storeQuery, recordCacheHit } from '../services/queryCache.js';

/**
 * POST /api/query/execute
 * 
 * Execute a validated structured query directly.
 * For development/testing purposes.
 * 
 * Request body:
 * {
 *   "query": {
 *     "collectionName": "students",
 *     "operation": "find",
 *     "filter": {...},
 *     ...
 *   }
 * }
 */
export const executeStructuredQuery = async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Missing "query" field in request body.',
      });
    }

    // Execute the query using the existing executor
    const result = await executeQuery(query);

    // Return result directly
    return res.status(200).json(result);
  } catch (error) {
    console.error('Query execution error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while executing query.',
    });
  }
};

/**
 * POST /api/query/ask
 * 
 * Ask a natural language question.
 * Normalizes the question and checks cache.
 * 
 * If cache HIT: returns the structured query (no execution yet without user confirmation).
 * If cache MISS: reports the miss.
 * 
 * Does NOT execute queries - that's a separate step.
 * Does NOT generate queries with AI yet.
 * 
 * Request body:
 * {
 *   "question": "Show CS students with CGPA above 8.5"
 * }
 */
export const askQuestion = async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({
        error: 'Missing "question" field in request body.',
      });
    }

    // Lookup in cache
    const cacheResult = await lookupCachedQuery(question);

    if (cacheResult.hit) {
      // Cache hit: return the cached structured query
      return res.status(200).json({
        success: true,
        cacheHit: true,
        question: question,
        normalizedQuestion: cacheResult.normalizedQuestion,
        structuredQuery: cacheResult.structuredQuery,
        message: 'Query found in cache. Use /api/query/execute to run it.',
      });
    } else {
      // Cache miss: report for future AI generation
      return res.status(200).json({
        success: true,
        cacheHit: false,
        question: question,
        normalizedQuestion: cacheResult.normalizedQuestion,
        message:
          'Query not found in cache. An AI layer will generate the query in the next phase.',
      });
    }
  } catch (error) {
    console.error('Cache lookup error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while looking up cache.',
    });
  }
};

/**
 * GET /api/query-history
 * 
 * View recent queries from history.
 */
export const getQueryHistory = async (req, res) => {
  try {
    const QueryHistory = (await import('../models/QueryHistory.js')).default;
    const limit = parseInt(req.query.limit) || 10;

    const queries = await QueryHistory.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      count: queries.length,
      queries: queries,
    });
  } catch (error) {
    console.error('History fetch error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve query history.',
    });
  }
};

/**
 * GET /api/query-history/stats
 * 
 * Get cache statistics.
 */
export const getQueryStats = async (req, res) => {
  try {
    const QueryHistory = (await import('../models/QueryHistory.js')).default;
    const stats = await QueryHistory.getCacheStats();

    return res.status(200).json({
      success: true,
      stats: stats,
    });
  } catch (error) {
    console.error('Stats fetch error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics.',
    });
  }
};
