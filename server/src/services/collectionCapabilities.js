/**
 * Collection Capabilities Service
 *
 * Provides a unified view of collection capabilities:
 * - discovered: Collection exists in MongoDB
 * - queryable: Collection is whitelisted for queries
 * - executable: Collection has a Mongoose model for execution
 *
 * CRITICAL SECURITY NOTES:
 * - This is INFORMATIONAL ONLY
 * - Does NOT change validation logic
 * - Does NOT enable new collections in queryValidator
 * - Does NOT enable new models in queryExecutor
 * - Validation still uses hardcoded databaseSchema.js
 * - Executor still uses hardcoded model mapping
 * - Discovered-only collections are explicitly marked NOT executable
 *
 * Architecture:
 *
 * databaseSchema.js (queryable + executable)
 *        ↓
 * Hardcoded whitelist: {students: true}
 *
 * schemaDiscovery.js (discovered)
 *        ↓
 * MongoDB inspection: {students, products, orders, ...}
 *
 * collectionCapabilities.js (THIS MODULE)
 *        ↓
 * Merged view:
 *   students: {discovered: true, queryable: true, executable: true}
 *   products: {discovered: true, queryable: false, executable: false}
 *   orders:   {discovered: true, queryable: false, executable: false}
 *
 * Usage by AI layer (INFORMATIONAL):
 *   "I can see products exists, but it's not queryable yet"
 *
 * Usage by validation layer (UNCHANGED):
 *   Still only allows hardcoded collections
 */

import databaseSchema from '../config/databaseSchema.js';
import { isCollectionRegistered, getRegisteredCollections } from './modelResolver.js';

/**
 * Get unified capabilities for all collections
 *
 * Merges hardcoded databaseSchema with discovered schema to provide
 * a complete capability view.
 *
 * @param {Object} discoveredSchema - Schema from schemaDiscovery.getDiscoveredSchema()
 * @returns {Object} - Capabilities object: {collectionName: {discovered, queryable, executable}}
 */
export async function getCollectionCapabilities(discoveredSchema) {
  const capabilities = {};

  // Start with hardcoded executable collections
  const executableCollections = Object.keys(databaseSchema.collections);

  // Build capabilities from executable collections
  for (const collectionName of executableCollections) {
    const isDiscovered =
      discoveredSchema && discoveredSchema.collections && discoveredSchema.collections[collectionName]
        ? true
        : false;

    const hasModel = isCollectionExecutable(collectionName);

    capabilities[collectionName] = {
      name: collectionName,
      discovered: isDiscovered,
      queryable: true, // Hardcoded whitelist
      executable: hasModel, // Has Mongoose model
      hasModel: hasModel,
    };
  }

  // Add discovered-only collections (not queryable, not executable)
  if (discoveredSchema && discoveredSchema.collections) {
    for (const collectionName of Object.keys(discoveredSchema.collections)) {
      // Skip if already added (from executable)
      if (capabilities[collectionName]) {
        continue;
      }

      // Skip system collections
      if (collectionName.startsWith('system.')) {
        continue;
      }

      capabilities[collectionName] = {
        name: collectionName,
        discovered: true,
        queryable: false, // Not in hardcoded whitelist
        executable: false, // No Mongoose model
        hasModel: false,
        reason: 'Not in hardcoded whitelist. Cannot be queried or executed.',
      };
    }
  }

  return capabilities;
}

/**
 * Get capabilities for a single collection
 *
 * @param {string} collectionName - Collection to check
 * @param {Object} discoveredSchema - Discovered schema (optional)
 * @returns {Object} - Capability object for the collection or null
 */
export async function getCollectionCapability(collectionName, discoveredSchema) {
  const capabilities = await getCollectionCapabilities(discoveredSchema);
  return capabilities[collectionName] || null;
}

/**
 * Check if a collection is queryable
 *
 * Uses hardcoded databaseSchema, not discovered schema.
 * This is the security boundary - only hardcoded collections are queryable.
 *
 * @param {string} collectionName - Collection to check
 * @returns {boolean} - True if queryable
 */
export function isCollectionQueryable(collectionName) {
  // CRITICAL: Uses hardcoded databaseSchema only
  // Discovered collections are NOT automatically queryable
  return databaseSchema.isCollectionAllowed(collectionName) === true;
}

/**
 * Check if a collection has an executable Mongoose model
 *
 * Uses hardcoded model mapping, not dynamic models.
 * Only hardcoded collections have models.
 *
 * @param {string} collectionName - Collection to check
 * @returns {boolean} - True if has model
 */
export function isCollectionExecutable(collectionName) {
  // Uses static model registry from modelResolver
  // No dynamic model loading
  return isCollectionRegistered(collectionName);
}

/**
 * Check if a collection is discovered in MongoDB
 *
 * Requires the discovered schema.
 *
 * @param {string} collectionName - Collection to check
 * @param {Object} discoveredSchema - Schema from schemaDiscovery
 * @returns {boolean} - True if discovered
 */
export function isCollectionDiscovered(collectionName, discoveredSchema) {
  if (!discoveredSchema || !discoveredSchema.collections) {
    return false;
  }

  return discoveredSchema.collections[collectionName] !== undefined;
}

/**
 * Get all queryable collections
 *
 * Returns only hardcoded, queryable collections.
 *
 * @returns {Array<string>} - Collection names
 */
export function getQueryableCollections() {
  return Object.keys(databaseSchema.collections).filter((name) => databaseSchema.isCollectionAllowed(name));
}

/**
 * Get all executable collections
 *
 * Returns only collections with Mongoose models.
 *
 * @returns {Array<string>} - Collection names
 */
export function getExecutableCollections() {
  return getRegisteredCollections();
}

/**
 * Get all discovered collections (if schema provided)
 *
 * Returns collections found in MongoDB.
 *
 * @param {Object} discoveredSchema - Schema from schemaDiscovery
 * @returns {Array<string>} - Collection names
 */
export function getDiscoveredCollections(discoveredSchema) {
  if (!discoveredSchema || !discoveredSchema.collections) {
    return [];
  }

  return Object.keys(discoveredSchema.collections).filter((name) => !name.startsWith('system.'));
}

/**
 * Summarize capabilities for logging/debugging
 *
 * @param {Object} capabilities - Capabilities object from getCollectionCapabilities()
 * @returns {Object} - Summary
 */
export function summarizeCapabilities(capabilities) {
  const queryable = [];
  const discoveredOnly = [];
  const unknown = [];

  for (const [name, cap] of Object.entries(capabilities)) {
    if (cap.queryable) {
      queryable.push(name);
    } else if (cap.discovered) {
      discoveredOnly.push(name);
    } else {
      unknown.push(name);
    }
  }

  return {
    queryable,
    discoveredOnly,
    unknown,
    summary: {
      totalQueryable: queryable.length,
      totalDiscoveredOnly: discoveredOnly.length,
      totalUnknown: unknown.length,
    },
  };
}

export default {
  getCollectionCapabilities,
  getCollectionCapability,
  isCollectionQueryable,
  isCollectionExecutable,
  isCollectionDiscovered,
  getQueryableCollections,
  getExecutableCollections,
  getDiscoveredCollections,
  summarizeCapabilities,
};
