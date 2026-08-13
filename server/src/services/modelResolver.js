/**
 * Model Resolver Service
 *
 * Safely resolves Mongoose models for explicitly configured collections.
 *
 * SECURITY PRINCIPLES:
 * - Static explicit registry only (no dynamic loading)
 * - Never uses eval(), Function(), or dynamic imports
 * - Never calls mongoose.model(collectionName) directly
 * - Validates collection names before lookup
 * - Returns null safely if not found
 * - Prevents prototype pollution attacks
 *
 * ARCHITECTURE:
 * modelResolver.js (STEP 11) - safe static registry
 *        ↓
 * collectionCapabilities.js (STEP 10) - informational view
 *        ↓
 * queryValidator.js (STEP 1-7) - validates queryable collections
 *
 * This is DIFFERENT from validation:
 * - Validator checks: "Is this collection in databaseSchema.collections?"
 * - Resolver checks: "Do we have a Mongoose model for this collection?"
 *
 * Currently both only support 'students', but in STEP 12+ they could differ.
 * Example: A collection could be "queryable" but not yet have a "model" registered.
 */

import Student from '../models/Student.js';

/**
 * Static registry of collection → Mongoose model mappings
 *
 * This is the ONLY place where executable models are defined.
 * To add a new executable collection:
 * 1. Create/import the Mongoose model
 * 2. Add it to this registry
 * 3. Update databaseSchema.js to allow it in validation
 * 4. Update tests
 * 5. NO OTHER CODE MODIFICATIONS NEEDED
 *
 * @type {Object}
 */
const MODEL_REGISTRY = {
  students: Student,
  // Future: other collections can be added here explicitly
  // products: Product,
  // orders: Order,
};

/**
 * Safely resolve a Mongoose model for a collection name
 *
 * @param {string} collectionName - The collection name to resolve
 * @returns {Object|null} - The Mongoose Model, or null if not registered
 * @throws {Error} - Only if input validation fails (e.g., non-string)
 */
export function resolveModel(collectionName) {
  // Input validation - must be a string
  if (typeof collectionName !== 'string') {
    return null; // Safely reject non-string input
  }

  if (collectionName.trim() === '') {
    return null; // Safely reject empty string
  }

  // Lookup in static registry using hasOwnProperty to prevent prototype pollution
  // This ensures we only return models that were explicitly added to MODEL_REGISTRY,
  // not inherited properties like __proto__, constructor, or prototype
  if (!Object.prototype.hasOwnProperty.call(MODEL_REGISTRY, collectionName)) {
    return null;
  }

  const model = MODEL_REGISTRY[collectionName];

  // Return model or null (never undefined to be explicit)
  return model || null;
}

/**
 * Get all collection names that have registered models
 *
 * @returns {Array<string>} - List of collection names
 */
export function getRegisteredCollections() {
  return Object.keys(MODEL_REGISTRY);
}

/**
 * Check if a collection has a registered model
 *
 * @param {string} collectionName - Collection to check
 * @returns {boolean} - True if model is registered
 */
export function isCollectionRegistered(collectionName) {
  if (typeof collectionName !== 'string') {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(MODEL_REGISTRY, collectionName);
}

export default resolveModel;
