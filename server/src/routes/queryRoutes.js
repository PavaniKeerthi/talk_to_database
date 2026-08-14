/**
 * Query Routes
 * 
 * Endpoints for the query pipeline:
 * - Execute structured queries
 * - Ask natural language questions
 * - View query history
 */

import express from 'express';
import {
  executeStructuredQuery,
  askQuestion,
  getQueryHistory,
  getQueryStats,
  getSchema,
  getCapabilities,
} from '../controllers/queryController.js';

const router = express.Router();

// Execute a structured query (for testing/development)
router.post('/execute', executeStructuredQuery);

// Ask a natural language question (cache lookup, no AI yet)
router.post('/ask', askQuestion);

// Get recent query history
router.get('/history', getQueryHistory);

// Get cache statistics
router.get('/history/stats', getQueryStats);

// Get discovered database schema
router.get('/schema', getSchema);

// Get collection capabilities
router.get('/capabilities', getCapabilities);

export default router;
