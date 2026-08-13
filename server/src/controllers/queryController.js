/**
 * Query Controller
 * 
 * Handles HTTP requests for structured query execution and natural language queries.
 * 
 * STEP 7: Integrated AI Query Generator
 * STEP 9: Integrated Schema Discovery (informational context for AI)
 * 
 * Flow for natural language questions:
 * 1. Validate input
 * 2. Normalize question
 * 3. Check query cache
 * 4. If cache HIT: execute cached query
 * 5. If cache MISS: discover schema → generate query with AI → validate → execute
 * 6. Store successful queries in cache
 */

import executeQuery from '../services/queryExecutor.js';
import validateQuery from '../services/queryValidator.js';
import { normalizeQuestion } from '../services/questionNormalizer.js';
import { lookupCachedQuery, storeQuery, recordCacheHit } from '../services/queryCache.js';
import generateQuery from '../services/aiQueryGenerator.js';
import getDiscoveredSchema from '../services/schemaDiscovery.js';

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
 * 
 * Flow:
 * 1. Validate question
 * 2. Normalize question
 * 3. Check query cache
 * 4. If cache HIT:
 *    - Execute the cached query
 *    - Return results
 *    - Record cache hit
 * 5. If cache MISS:
 *    - Generate query with AI
 *    - Validate AI output (CRITICAL SECURITY STEP)
 *    - If validation fails, return error without executing
 *    - If validation succeeds, execute query
 *    - Store query in cache
 *    - Return results
 * 
 * Request body:
 * {
 *   "question": "Show CS students with CGPA above 8.5"
 * }
 */
export const askQuestion = async (req, res) => {
  try {
    const { question } = req.body;

    // Step 1: Validate question
    if (!question || typeof question !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid "question" field. Must be a string.',
      });
    }

    // Step 2: Normalize the question
    const normalizedQuestion = normalizeQuestion(question);

    if (!normalizedQuestion) {
      return res.status(400).json({
        success: false,
        error: 'Question could not be normalized.',
      });
    }

    // Step 3: Check query cache
    const cacheResult = await lookupCachedQuery(question);

    if (cacheResult.hit) {
      // CACHE HIT PATH
      console.log(`Cache hit for: "${normalizedQuestion}"`);

      // Execute the cached query
      const executionResult = await executeQuery(cacheResult.structuredQuery);

      if (!executionResult.success) {
        return res.status(200).json({
          success: false,
          cacheHit: true,
          question: question,
          normalizedQuestion: normalizedQuestion,
          query: cacheResult.structuredQuery,
          error: executionResult.error,
          executionTimeMs: executionResult.executionTimeMs,
        });
      }

      // Record the cache hit in history
      await recordCacheHit(cacheResult.historyRecord);

      return res.status(200).json({
        success: true,
        cacheHit: true,
        question: question,
        normalizedQuestion: normalizedQuestion,
        query: cacheResult.structuredQuery,
        result: {
          success: true,
          operation: executionResult.operation,
          collectionName: executionResult.collectionName,
          data: executionResult.data,
          count: executionResult.count,
          executionTimeMs: executionResult.executionTimeMs,
        },
      });
    } else {
      // CACHE MISS PATH
      console.log(`Cache miss for: "${normalizedQuestion}". Generating with AI...`);

      // Step 3a: Try to discover schema for AI context (informational only)
      let discoveredSchema = null;
      try {
        discoveredSchema = await getDiscoveredSchema();
      } catch (error) {
        // Schema discovery is optional; AI can still generate without it
        console.warn(`Schema discovery failed: ${error.message}. Proceeding without schema context.`);
        // Don't expose error details to client
      }

      // Step 4a: Generate query with AI (optionally using discovered schema as context)
      const aiGeneratedQuery = await generateQuery(normalizedQuestion, discoveredSchema);

      if (!aiGeneratedQuery) {
        return res.status(200).json({
          success: false,
          cacheHit: false,
          question: question,
          normalizedQuestion: normalizedQuestion,
          error: 'AI could not generate a query. Try rephrasing your question.',
        });
      }

      // Step 4b: Validate AI-generated query (CRITICAL SECURITY STEP)
      // This ensures AI cannot generate dangerous queries
      const validationResult = validateQuery(aiGeneratedQuery);

      if (!validationResult.valid) {
        // Validation failed - DO NOT execute
        console.warn(
          `AI validation failed for: "${normalizedQuestion}". Reason: ${validationResult.error}`
        );

        return res.status(200).json({
          success: false,
          cacheHit: false,
          question: question,
          normalizedQuestion: normalizedQuestion,
          generatedQuery: aiGeneratedQuery,
          error: `Generated query failed validation: ${validationResult.error}`,
          message:
            'The AI-generated query did not pass security validation. This is a safety measure.',
        });
      }

      // Step 4c: Execute the validated query
      const sanitizedQuery = validationResult.query;
      const executionResult = await executeQuery(sanitizedQuery);

      if (!executionResult.success) {
        return res.status(200).json({
          success: false,
          cacheHit: false,
          question: question,
          normalizedQuestion: normalizedQuestion,
          query: sanitizedQuery,
          error: executionResult.error,
          executionTimeMs: executionResult.executionTimeMs,
        });
      }

      // Step 4d: Store the successful query in cache
      try {
        await storeQuery(question, sanitizedQuery, {
          resultCount: executionResult.count,
          executionTimeMs: executionResult.executionTimeMs,
        });
      } catch (storeError) {
        console.error('Failed to store query in cache:', storeError.message);
        // Don't fail the response, just log the error
      }

      return res.status(200).json({
        success: true,
        cacheHit: false,
        question: question,
        normalizedQuestion: normalizedQuestion,
        query: sanitizedQuery,
        result: {
          success: true,
          operation: executionResult.operation,
          collectionName: executionResult.collectionName,
          data: executionResult.data,
          count: executionResult.count,
          executionTimeMs: executionResult.executionTimeMs,
        },
      });
    }
  } catch (error) {
    console.error('Query processing error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while processing question.',
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
