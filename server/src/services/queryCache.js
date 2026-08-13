/**
 * Query Cache Service
 * 
 * Stores and retrieves structured queries from history.
 * Uses normalized questions to match similar queries.
 */

import normalizeQuestion from './questionNormalizer.js';
import QueryHistory from '../models/QueryHistory.js';

/**
 * Lookup a cached query by question
 * 
 * @param {string} question - The user's question
 * @returns {Promise<Object>} - {hit: true, ...} or {hit: false, ...}
 */
export const lookupCachedQuery = async (question) => {
  const normalizedQuestion = normalizeQuestion(question);

  if (!normalizedQuestion) {
    return {
      hit: false,
      normalizedQuestion: null,
      error: 'Invalid question format',
    };
  }

  try {
    const found = await QueryHistory.findByNormalizedQuestion(normalizedQuestion);

    if (found) {
      return {
        hit: true,
        normalizedQuestion: normalizedQuestion,
        structuredQuery: found.structuredQuery,
        historyId: found._id,
        historyRecord: found,
      };
    }

    return {
      hit: false,
      normalizedQuestion: normalizedQuestion,
    };
  } catch (error) {
    console.error('Cache lookup error:', error.message);
    return {
      hit: false,
      normalizedQuestion: normalizedQuestion,
      error: error.message,
    };
  }
};

/**
 * Store a structured query in history
 * 
 * @param {string} question - Original question
 * @param {Object} structuredQuery - The validated structured query
 * @param {Object} executionMetadata - Optional {resultCount, executionTimeMs}
 * @returns {Promise<Object>} - Stored QueryHistory document
 */
export const storeQuery = async (question, structuredQuery, executionMetadata = {}) => {
  const normalizedQuestion = normalizeQuestion(question);

  if (!normalizedQuestion) {
    throw new Error('Invalid question format');
  }

  try {
    // Check if query already exists
    const existing = await QueryHistory.findByNormalizedQuestion(normalizedQuestion);

    if (existing) {
      // Update existing record
      return await existing.recordExecution(
        executionMetadata.resultCount,
        executionMetadata.executionTimeMs
      );
    }

    // Create new record
    const newRecord = new QueryHistory({
      originalQuestion: question,
      normalizedQuestion: normalizedQuestion,
      structuredQuery: structuredQuery,
      collectionName: structuredQuery.collectionName,
      operation: structuredQuery.operation,
      usageCount: 1,
      cacheHits: 0,
      cacheMisses: 1,
      lastResultCount: executionMetadata.resultCount || null,
      lastExecutionTimeMs: executionMetadata.executionTimeMs || null,
    });

    const saved = await newRecord.save();
    return saved;
  } catch (error) {
    console.error('Store query error:', error.message);
    throw error;
  }
};

/**
 * Record a cache hit and increment statistics
 * 
 * @param {Object} historyRecord - The QueryHistory document
 * @returns {Promise<Object>} - Updated record
 */
export const recordCacheHit = async (historyRecord) => {
  if (!historyRecord) {
    throw new Error('Invalid history record');
  }

  try {
    return await historyRecord.recordCacheHit();
  } catch (error) {
    console.error('Record cache hit error:', error.message);
    throw error;
  }
};

export default {
  lookupCachedQuery,
  storeQuery,
  recordCacheHit,
};
