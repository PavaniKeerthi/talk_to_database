/**
 * STEP 11: Model Resolver Tests
 *
 * Verifies that the model resolver:
 * - Safely resolves registered models
 * - Rejects unknown/unregistered collections
 * - Prevents dynamic model loading and prototype pollution
 * - Maintains security boundaries with validator and executor
 * - Preserves all existing Student query behavior
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import resolveModel, {
  getRegisteredCollections,
  isCollectionRegistered,
} from '../services/modelResolver.js';
import validateQuery from '../services/queryValidator.js';
import executeQuery from '../services/queryExecutor.js';
import connectDB from '../config/db.js';

dotenv.config();

// Test tracking
let passed = 0;
let failed = 0;
const results = [];

/**
 * Helper to run a single test
 */
function test(name, condition, details = '') {
  if (condition) {
    passed++;
    results.push(`✅ PASS: ${name}`);
  } else {
    failed++;
    results.push(`❌ FAIL: ${name}`);
    if (details) {
      results.push(`   ${details}`);
    }
  }
}

/**
 * Helper to run async test
 */
async function asyncTest(name, fn) {
  try {
    await fn();
    passed++;
    results.push(`✅ PASS: ${name}`);
  } catch (error) {
    failed++;
    results.push(`❌ FAIL: ${name}`);
    results.push(`   Error: ${error.message}`);
  }
}

console.log('=== STEP 11: Model Resolver Tests ===\n');

// ============================================================================
// DATABASE CONNECTION & SETUP
// ============================================================================

console.log('--- DATABASE CONNECTION & SETUP ---\n');

let dbConnected = false;

try {
  await connectDB();
  dbConnected = true;
  test('Database connection successful', true);
} catch (error) {
  test('Database connection successful', false, `Connection failed: ${error.message}`);
}

if (!dbConnected) {
  console.log('\n❌ Cannot proceed with tests - database not connected\n');
  console.log(`RESULTS: ${passed}/${passed + failed} tests passed\n`);
  process.exit(1);
}

// ============================================================================
// TEST 1: STUDENTS MODEL RESOLUTION
// ============================================================================

console.log('\n--- STUDENTS MODEL RESOLUTION ---\n');

await asyncTest('Students model resolves successfully', async () => {
  const model = resolveModel('students');
  if (!model) {
    throw new Error('Students model should be resolved');
  }
  if (typeof model !== 'function' && typeof model !== 'object') {
    throw new Error('Resolved model should be a constructor/object');
  }
});

await asyncTest('Resolved students model can query database', async () => {
  const model = resolveModel('students');
  const result = await model.findOne().lean().exec();
  // Result can be null if no students exist, but query should succeed
  // We just verify the model responds to Mongoose methods
  test('Model has findOne method', typeof model.findOne === 'function');
});

// ============================================================================
// TEST 2: UNKNOWN COLLECTIONS
// ============================================================================

console.log('\n--- UNKNOWN COLLECTIONS ---\n');

await asyncTest('Unknown collection returns null', async () => {
  const model = resolveModel('products');
  if (model !== null) {
    throw new Error('Unknown collection should return null');
  }
});

await asyncTest('Another unknown collection returns null', async () => {
  const model = resolveModel('orders');
  if (model !== null) {
    throw new Error('Unknown collection should return null');
  }
});

await asyncTest('Empty collection name returns null', async () => {
  const model = resolveModel('');
  if (model !== null) {
    throw new Error('Empty collection name should return null');
  }
});

await asyncTest('Whitespace collection name returns null', async () => {
  const model = resolveModel('   ');
  if (model !== null) {
    throw new Error('Whitespace collection name should return null');
  }
});

// ============================================================================
// TEST 3: MALICIOUS INPUTS (PROTOTYPE POLLUTION / INJECTION)
// ============================================================================

console.log('\n--- SECURITY: MALICIOUS INPUTS ---\n');

await asyncTest('__proto__ does not resolve', async () => {
  const model = resolveModel('__proto__');
  if (model !== null) {
    throw new Error('__proto__ should not resolve');
  }
});

await asyncTest('constructor does not resolve', async () => {
  const model = resolveModel('constructor');
  if (model !== null) {
    throw new Error('constructor should not resolve');
  }
});

await asyncTest('prototype does not resolve', async () => {
  const model = resolveModel('prototype');
  if (model !== null) {
    throw new Error('prototype should not resolve');
  }
});

await asyncTest('__constructor__ does not resolve', async () => {
  const model = resolveModel('__constructor__');
  if (model !== null) {
    throw new Error('__constructor__ should not resolve');
  }
});

await asyncTest('eval-like strings do not resolve', async () => {
  const model = resolveModel('eval');
  if (model !== null) {
    throw new Error('eval string should not resolve');
  }
});

await asyncTest('Function-like strings do not resolve', async () => {
  const model = resolveModel('Function');
  if (model !== null) {
    throw new Error('Function string should not resolve');
  }
});

// ============================================================================
// TEST 4: INVALID INPUT TYPES
// ============================================================================

console.log('\n--- INVALID INPUT TYPES ---\n');

await asyncTest('Non-string input returns null', async () => {
  const model = resolveModel(123);
  if (model !== null) {
    throw new Error('Non-string input should return null');
  }
});

await asyncTest('Object input returns null', async () => {
  const model = resolveModel({ name: 'students' });
  if (model !== null) {
    throw new Error('Object input should return null');
  }
});

await asyncTest('Array input returns null', async () => {
  const model = resolveModel(['students']);
  if (model !== null) {
    throw new Error('Array input should return null');
  }
});

await asyncTest('Null input returns null', async () => {
  const model = resolveModel(null);
  if (model !== null) {
    throw new Error('Null input should return null');
  }
});

await asyncTest('Undefined input returns null', async () => {
  const model = resolveModel(undefined);
  if (model !== null) {
    throw new Error('Undefined input should return null');
  }
});

// ============================================================================
// TEST 5: REGISTRY QUERIES
// ============================================================================

console.log('\n--- REGISTRY QUERIES ---\n');

await asyncTest('getRegisteredCollections returns array', async () => {
  const collections = getRegisteredCollections();
  if (!Array.isArray(collections)) {
    throw new Error('getRegisteredCollections should return array');
  }
});

await asyncTest('getRegisteredCollections includes students', async () => {
  const collections = getRegisteredCollections();
  if (!collections.includes('students')) {
    throw new Error('Registered collections should include students');
  }
});

await asyncTest('isCollectionRegistered returns true for students', async () => {
  const result = isCollectionRegistered('students');
  if (result !== true) {
    throw new Error('Students should be registered');
  }
});

await asyncTest('isCollectionRegistered returns false for unknown', async () => {
  const result = isCollectionRegistered('unknown');
  if (result !== false) {
    throw new Error('Unknown collection should not be registered');
  }
});

// ============================================================================
// TEST 6: EXECUTOR INTEGRATION (MODEL RESOLUTION IN CONTEXT)
// ============================================================================

console.log('\n--- EXECUTOR INTEGRATION ---\n');

await asyncTest('Valid student query executes successfully', async () => {
  const query = {
    collectionName: 'students',
    operation: 'find',
    filter: {},
  };

  const result = await executeQuery(query);
  if (!result.success) {
    throw new Error(`Query should succeed: ${result.error}`);
  }
  if (!Array.isArray(result.data)) {
    throw new Error('Result data should be array');
  }
});

await asyncTest('Query for unknown collection fails before execution', async () => {
  const query = {
    collectionName: 'products',
    operation: 'find',
    filter: {},
  };

  const result = await executeQuery(query);
  if (result.success) {
    throw new Error('Query for unknown collection should fail');
  }
  // Error should be from validator (not allowed), not executor (no model)
  if (!result.error.includes('not allowed')) {
    throw new Error(`Error should mention not allowed: ${result.error}`);
  }
});

await asyncTest('Validator still rejects non-student collections', async () => {
  const query = {
    collectionName: 'products',
    operation: 'find',
    filter: {},
  };

  const validation = validateQuery(query);
  if (validation.valid) {
    throw new Error('Query for unknown collection should fail validation');
  }
});

// ============================================================================
// TEST 7: EXISTING STUDENT BEHAVIOR PRESERVED
// ============================================================================

console.log('\n--- EXISTING STUDENT BEHAVIOR PRESERVED ---\n');

await asyncTest('Find with filter still works', async () => {
  const query = {
    collectionName: 'students',
    operation: 'find',
    filter: { year: 1 },
  };

  const result = await executeQuery(query);
  if (!result.success) {
    throw new Error(`Query should succeed: ${result.error}`);
  }
});

await asyncTest('Count operation still works', async () => {
  const query = {
    collectionName: 'students',
    operation: 'count',
    filter: {},
  };

  const result = await executeQuery(query);
  if (!result.success) {
    throw new Error(`Count should succeed: ${result.error}`);
  }
  if (typeof result.data !== 'number') {
    throw new Error('Count result should be number');
  }
});

await asyncTest('Projection still works', async () => {
  const query = {
    collectionName: 'students',
    operation: 'find',
    filter: {},
    projection: { name: 1, cgpa: 1 },
    limit: 1,
  };

  const result = await executeQuery(query);
  if (!result.success) {
    throw new Error(`Query should succeed: ${result.error}`);
  }
});

await asyncTest('Sort still works', async () => {
  const query = {
    collectionName: 'students',
    operation: 'find',
    filter: {},
    sort: { cgpa: -1 },
    limit: 1,
  };

  const result = await executeQuery(query);
  if (!result.success) {
    throw new Error(`Query should succeed: ${result.error}`);
  }
});

// ============================================================================
// TEST 8: SECURITY BOUNDARIES REMAIN INTACT
// ============================================================================

console.log('\n--- SECURITY BOUNDARIES INTACT ---\n');

await asyncTest('Validator still blocks write operations', async () => {
  const query = {
    collectionName: 'students',
    operation: 'insert',
    filter: { name: 'John' },
  };

  const result = await executeQuery(query);
  if (result.success) {
    throw new Error('Write operation should be rejected');
  }
  if (!result.error.includes('insert')) {
    throw new Error(`Error should mention insert: ${result.error}`);
  }
});

await asyncTest('Validator still blocks dangerous operators', async () => {
  const query = {
    collectionName: 'students',
    operation: 'find',
    filter: { $where: "this.cgpa > 8" },
  };

  const result = await executeQuery(query);
  if (result.success) {
    throw new Error('$where operator should be rejected');
  }
  if (!result.error.includes('$where')) {
    throw new Error(`Error should mention $where: ${result.error}`);
  }
});

await asyncTest('Validator still enforces field validation', async () => {
  const query = {
    collectionName: 'students',
    operation: 'find',
    filter: { _id: '507f1f77bcf86cd799439011' },
  };

  const result = await executeQuery(query);
  if (result.success) {
    throw new Error('Filter on _id should be rejected');
  }
});

// ============================================================================
// CLEANUP AND RESULTS
// ============================================================================

console.log('\n--- DISCONNECTING ---\n');

try {
  await mongoose.disconnect();
  test('Disconnected from MongoDB', true);
} catch (error) {
  test('Disconnected from MongoDB', false, error.message);
}

console.log('\n' + '='.repeat(50));
console.log(`RESULTS: ${passed}/${passed + failed} tests passed`);
console.log('='.repeat(50));

if (failed > 0) {
  console.log('\n❌ Some tests failed\n');
  results.forEach((r) => console.log(r));
  process.exit(1);
} else {
  console.log('\n✅ All STEP 11 model resolver tests passed!\n');
  results.forEach((r) => console.log(r));
  process.exit(0);
}
