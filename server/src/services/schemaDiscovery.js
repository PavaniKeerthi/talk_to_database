/**
 * Schema Discovery Service
 *
 * Inspects the connected MongoDB database to discover available collections
 * and their field structure.
 *
 * CRITICAL SECURITY NOTES:
 * - This is an INFORMATION GATHERING service only
 * - Does NOT allow arbitrary MongoDB operations
 * - Never exposes credentials, connection strings, or internal metadata
 * - Should NOT be used to bypass the hardcoded databaseSchema.js
 * - Returned schema is for AI context ONLY
 * - Validation and execution still use databaseSchema.js
 *
 * Architecture:
 *
 * Discovered Schema (informational)
 *        ↓
 * AI understands available options
 *        ↓
 * Structured Query
 *        ↓
 * Hardcoded databaseSchema.js Validator (AUTHORITY)
 *        ↓
 * Hardcoded queryExecutor (uses Mongoose models)
 *        ↓
 * MongoDB
 */

import mongoose from 'mongoose';

/**
 * Get the discovered database schema
 *
 * Inspects the currently connected MongoDB database and returns metadata
 * about available collections and their fields.
 *
 * @returns {Promise<Object>} - Discovered schema structure
 * @throws {Error} - If MongoDB is not connected or inspection fails
 */
export const getDiscoveredSchema = async () => {
  // Ensure we have an active connection
  if (!mongoose.connection.readyState === 1) {
    throw new Error('MongoDB connection is not established');
  }

  try {
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error('MongoDB database object is not available');
    }

    // Get list of all collections in the database
    const collections = await db.listCollections().toArray();

    if (!collections || !Array.isArray(collections)) {
      throw new Error('Failed to list collections');
    }

    const discoveredSchema = {
      timestamp: new Date().toISOString(),
      collections: {},
      summary: {
        totalCollections: collections.length,
      },
    };

    // Inspect each collection
    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;

      // Skip system collections (start with 'system.')
      if (collectionName.startsWith('system.')) {
        continue;
      }

      try {
        const fields = await discoverCollectionFields(db, collectionName);

        discoveredSchema.collections[collectionName] = {
          name: collectionName,
          fields: fields,
          docCount: await getDocumentCount(db, collectionName),
        };
      } catch (error) {
        // If discovery fails for a collection, record the error but continue
        discoveredSchema.collections[collectionName] = {
          name: collectionName,
          error: 'Failed to discover schema',
          docCount: null,
        };
      }
    }

    // Update summary
    discoveredSchema.summary.successfulCollections = Object.values(
      discoveredSchema.collections
    ).filter((c) => !c.error).length;

    discoveredSchema.summary.failedCollections = Object.values(
      discoveredSchema.collections
    ).filter((c) => c.error).length;

    return discoveredSchema;
  } catch (error) {
    const safeError = new Error('Schema discovery failed');
    safeError.originalError = error.message || error.toString();
    throw safeError;
  }
};

/**
 * Discover fields in a collection
 *
 * Examines sample documents to determine field names and infer types.
 * Does NOT execute arbitrary queries or expose sensitive data.
 *
 * @param {Object} db - MongoDB database object
 * @param {string} collectionName - Name of the collection to inspect
 * @returns {Promise<Object>} - Field metadata
 * @private
 */
async function discoverCollectionFields(db, collectionName) {
  const collection = db.collection(collectionName);

  // Use aggregation pipeline to safely inspect fields
  // $sample to get random documents, then $project to extract field names
  const sampleSize = 10; // Inspect up to 10 documents
  const pipeline = [{ $sample: { size: Math.min(sampleSize, 100) } }];

  const sampleDocs = await collection.aggregate(pipeline).toArray();

  if (!sampleDocs || sampleDocs.length === 0) {
    return {}; // Empty collection
  }

  const fields = {};

  // Analyze all sample documents to find fields and types
  for (const doc of sampleDocs) {
    analyzeDocumentFields(doc, fields);
  }

  return fields;
}

/**
 * Analyze a single document to extract field information
 *
 * @param {Object} doc - Document to analyze
 * @param {Object} fields - Accumulator for field metadata
 * @private
 */
function analyzeDocumentFields(doc, fields) {
  if (!doc || typeof doc !== 'object') {
    return;
  }

  for (const [key, value] of Object.entries(doc)) {
    // Skip internal MongoDB fields (but _id is informational)
    if (key.startsWith('__')) {
      continue;
    }

    if (!fields[key]) {
      fields[key] = {
        name: key,
        types: new Set(),
        examples: [],
        nullable: false,
      };
    }

    const fieldMetadata = fields[key];
    const valueType = inferType(value);

    if (valueType) {
      fieldMetadata.types.add(valueType);
    }

    if (value === null || value === undefined) {
      fieldMetadata.nullable = true;
    }

    // Keep a few examples (but don't expose sensitive values)
    if (fieldMetadata.examples.length < 2 && value !== null && value !== undefined) {
      fieldMetadata.examples.push(sanitizeExampleValue(value, valueType));
    }
  }
}

/**
 * Infer the MongoDB/JavaScript type of a value
 *
 * @param {*} value - The value to inspect
 * @returns {string|null} - Type name or null
 * @private
 */
function inferType(value) {
  if (value === null) return null;
  if (value === undefined) return null;

  // ObjectId
  if (value.constructor && value.constructor.name === 'ObjectId') {
    return 'objectId';
  }

  // Date
  if (value instanceof Date) {
    return 'date';
  }

  // Array
  if (Array.isArray(value)) {
    return 'array';
  }

  // Number
  if (typeof value === 'number') {
    return 'number';
  }

  // Boolean
  if (typeof value === 'boolean') {
    return 'boolean';
  }

  // String
  if (typeof value === 'string') {
    return 'string';
  }

  // Object
  if (typeof value === 'object') {
    return 'object';
  }

  return null;
}

/**
 * Sanitize an example value for display
 *
 * Removes sensitive data, limits string length, etc.
 *
 * @param {*} value - Value to sanitize
 * @param {string} type - The type of the value
 * @returns {*} - Sanitized value
 * @private
 */
function sanitizeExampleValue(value, type) {
  if (type === 'string') {
    // Truncate long strings
    return value.length > 50 ? value.substring(0, 50) + '...' : value;
  }

  if (type === 'objectId') {
    return '[ObjectId]';
  }

  if (type === 'date') {
    return value.toISOString ? value.toISOString() : String(value);
  }

  if (type === 'array') {
    return `[Array of ${Array.isArray(value) ? value.length : 0} items]`;
  }

  if (type === 'object') {
    return '[Object]';
  }

  return value;
}

/**
 * Get the document count for a collection
 *
 * @param {Object} db - MongoDB database object
 * @param {string} collectionName - Name of the collection
 * @returns {Promise<number|null>} - Document count or null on error
 * @private
 */
async function getDocumentCount(db, collectionName) {
  try {
    const collection = db.collection(collectionName);
    return await collection.estimatedDocumentCount();
  } catch (error) {
    return null;
  }
}

/**
 * Convert discovered schema to a safe JSON representation
 *
 * Ensures all Set objects are converted to Arrays for JSON serialization.
 *
 * @param {Object} schema - Discovered schema
 * @returns {Object} - Schema safe for JSON serialization
 * @private
 */
export function normalizeDiscoveredSchema(schema) {
  const normalized = JSON.parse(JSON.stringify(schema, (key, value) => {
    // Convert Sets to Arrays
    if (value instanceof Set) {
      return Array.from(value);
    }
    return value;
  }));

  // Second pass: convert types Sets in collections
  for (const collectionName in normalized.collections) {
    const collection = normalized.collections[collectionName];
    if (collection.fields) {
      for (const fieldName in collection.fields) {
        const field = collection.fields[fieldName];
        if (field.types && !Array.isArray(field.types)) {
          field.types = Array.from(field.types);
        }
      }
    }
  }

  return normalized;
}

export default getDiscoveredSchema;
