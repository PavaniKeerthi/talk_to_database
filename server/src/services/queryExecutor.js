/**
 * Query Executor
 * 
 * Safe execution layer for validated structured queries.
 * 
 * Security principles:
 * - ALWAYS validate queries before execution
 * - Never dynamically access collections
 * - Only read operations (find, count)
 * - No eval(), Function(), or code execution
 * - Return safe error messages (no stack traces, credentials, secrets)
 * 
 * Architecture:
 * queryValidator.js → queryExecutor.js → MongoDB
 *                    (this module)
 */

import mongoose from 'mongoose';
import validateQuery from './queryValidator.js';
import Student from '../models/Student.js';

/**
 * Execute a structured query against MongoDB
 * 
 * @param {Object} query - The structured query object to execute
 * @returns {Promise<Object>} - Response object with success/error status
 */
export const executeQuery = async (query) => {
  const startTime = Date.now();

  try {
    // Step 1: Validate the query (CRITICAL - never skip this)
    const validationResult = validateQuery(query);

    if (!validationResult.valid) {
      // Validation failed - DO NOT query MongoDB
      return {
        success: false,
        errorType: 'VALIDATION_ERROR',
        error: validationResult.error,
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Step 2: Extract the validated/sanitized query
    const validatedQuery = validationResult.query;

    // Step 3: Get the Model for the collection
    const Model = getModelForCollection(validatedQuery.collectionName);

    if (!Model) {
      return {
        success: false,
        errorType: 'UNSUPPORTED_COLLECTION',
        error: `Collection "${validatedQuery.collectionName}" is not supported for queries.`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Step 4: Execute based on operation type
    let result;

    switch (validatedQuery.operation) {
      case 'find':
        result = await executeFindQuery(Model, validatedQuery);
        break;

      case 'count':
        result = await executeCountQuery(Model, validatedQuery);
        break;

      case 'aggregate':
        result = await executeAggregateQuery(Model, validatedQuery);
        break;

      default:
        return {
          success: false,
          errorType: 'UNSUPPORTED_OPERATION',
          error: `Operation "${validatedQuery.operation}" is not supported.`,
          executionTimeMs: Date.now() - startTime,
        };
    }

    // Step 5: Return success response with execution time
    return {
      success: true,
      operation: validatedQuery.operation,
      collectionName: validatedQuery.collectionName,
      data: result.data,
      count: result.count,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    // Step 6: Handle unexpected database errors safely
    console.error('Query execution error:', error.message);

    return {
      success: false,
      errorType: 'DATABASE_ERROR',
      error: 'An error occurred while executing the query.',
      executionTimeMs: Date.now() - startTime,
    };
  }
};

/**
 * Get the Mongoose Model for a collection name
 * 
 * This prevents dynamic access to arbitrary collections.
 * Only explicitly whitelisted collections are allowed.
 * 
 * @param {string} collectionName - The name of the collection
 * @returns {Object|null} - The Mongoose Model or null if not found
 */
function getModelForCollection(collectionName) {
  // Hardcoded mapping - no dynamic access
  const models = {
    students: Student,
  };

  return models[collectionName] || null;
}

/**
 * Execute a find query
 * 
 * @param {Object} Model - The Mongoose Model
 * @param {Object} query - The validated query object
 * @returns {Promise<Object>} - {data: [...], count: number}
 */
async function executeFindQuery(Model, query) {
  let mongoQuery = Model.find(query.filter || {});

  // Apply optional query modifiers if they exist
  if (query.projection && Object.keys(query.projection).length > 0) {
    // Build projection object for Mongoose
    mongoQuery = mongoQuery.select(query.projection);
  }

  if (query.sort && Object.keys(query.sort).length > 0) {
    mongoQuery = mongoQuery.sort(query.sort);
  }

  if (query.skip !== undefined && query.skip > 0) {
    mongoQuery = mongoQuery.skip(query.skip);
  }

  if (query.limit !== undefined) {
    mongoQuery = mongoQuery.limit(query.limit);
  }

  // Use lean() for better performance on read-only queries
  mongoQuery = mongoQuery.lean();

  // Execute the query
  const documents = await mongoQuery.exec();

  return {
    data: documents,
    count: documents.length,
  };
}

/**
 * Execute a count query
 * 
 * @param {Object} Model - The Mongoose Model
 * @param {Object} query - The validated query object
 * @returns {Promise<Object>} - {data: count, count: count}
 */
async function executeCountQuery(Model, query) {
  const count = await Model.countDocuments(query.filter || {});

  return {
    data: count,
    count: count,
  };
}

/**
 * Execute an aggregate query
 * 
 * For now, aggregation pipelines require additional validation that
 * isn't yet implemented in queryValidator.js.
 * 
 * TODO: When aggregation pipeline validation is added to queryValidator,
 * implement this method to safely execute aggregation stages.
 * 
 * @param {Object} Model - The Mongoose Model
 * @param {Object} query - The validated query object
 * @returns {Promise<Object>} - Error response
 */
async function executeAggregateQuery(Model, query) {
  throw new Error(
    'Aggregate queries require additional pipeline validation. Not yet implemented.'
  );
}

export default executeQuery;
