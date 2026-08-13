/**
 * STEP 10: Collection Capabilities Foundation Tests
 *
 * Verifies that the collection capabilities abstraction layer:
 * - Provides unified capability view (discovered, queryable, executable)
 * - Does NOT change validation logic
 * - Does NOT change execution logic
 * - Maintains security boundaries
 * - Explicitly marks discovered-only collections as NOT queryable/executable
 * - Fails safely with missing/malformed input
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import getDiscoveredSchema from '../services/schemaDiscovery.js';
import validateQuery from '../services/queryValidator.js';
import executeQuery from '../services/queryExecutor.js';
import {
  getCollectionCapabilities,
  getCollectionCapability,
  isCollectionQueryable,
  isCollectionExecutable,
  isCollectionDiscovered,
  getQueryableCollections,
  getExecutableCollections,
  getDiscoveredCollections,
  summarizeCapabilities,
} from '../services/collectionCapabilities.js';
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

console.log('=== STEP 10: Collection Capabilities Foundation Tests ===\n');

// ============================================================================
// DATABASE CONNECTION & SETUP
// ============================================================================

console.log('--- DATABASE CONNECTION & SETUP ---\n');

let dbConnected = false;
let discoveredSchema = null;

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

// Get discovered schema for use in tests
try {
  discoveredSchema = await getDiscoveredSchema();
  test('Discovered schema retrieved', !!discoveredSchema);
} catch (error) {
  test('Discovered schema retrieved', false, `Discovery failed: ${error.message}`);
}

// ============================================================================
// TEST 1: STUDENTS COLLECTION REMAINS FULLY CAPABLE
// ============================================================================

console.log('\n--- STUDENTS COLLECTION: FULL CAPABILITY ---\n');

await asyncTest('Students is queryable', async () => {
  const result = isCollectionQueryable('students');
  if (!result) {
    throw new Error('Students should be queryable');
  }
});

await asyncTest('Students is executable', async () => {
  const result = isCollectionExecutable('students');
  if (!result) {
    throw new Error('Students should be executable');
  }
});

await asyncTest('Students is in queryable list', async () => {
  const queryable = getQueryableCollections();
  if (!queryable.includes('students')) {
    throw new Error('Students not in queryable list');
  }
});

await asyncTest('Students is in executable list', async () => {
  const executable = getExecutableCollections();
  if (!executable.includes('students')) {
    throw new Error('Students not in executable list');
  }
});

await asyncTest('Students capability has all properties', async () => {
  const cap = await getCollectionCapability('students', discoveredSchema);
  if (!cap) {
    throw new Error('No capability returned for students');
  }
  if (!cap.discovered || !cap.queryable || !cap.executable || !cap.hasModel) {
    throw new Error(
      `Students capability incomplete: ${JSON.stringify(cap)}`
    );
  }
});

// ============================================================================
// TEST 2: STUDENTS QUERIES STILL WORK (VALIDATION UNCHANGED)
// ============================================================================

console.log('\n--- STUDENTS QUERIES: VALIDATION UNCHANGED ---\n');

await asyncTest('Validator accepts students query', async () => {
  const query = {
    collectionName: 'students',
    operation: 'find',
    filter: {},
  };

  const result = validateQuery(query);
  if (!result.valid) {
    throw new Error(`Validation failed: ${result.error}`);
  }
});

await asyncTest('Validator still rejects unknown collections', async () => {
  const query = {
    collectionName: 'products',
    operation: 'find',
    filter: {},
  };

  const result = validateQuery(query);
  if (result.valid) {
    throw new Error('Validator should reject unknown collection');
  }
  if (!result.error.includes('not allowed')) {
    throw new Error(`Error message unclear: ${result.error}`);
  }
});

await asyncTest('Executor accepts validated students query', async () => {
  const query = {
    collectionName: 'students',
    operation: 'find',
    filter: {},
    limit: 1,
  };

  const result = await executeQuery(query);
  if (!result.success) {
    throw new Error(`Execution failed: ${result.error}`);
  }
});

// ============================================================================
// TEST 3: DISCOVERED-ONLY COLLECTIONS ARE MARKED NOT QUERYABLE/EXECUTABLE
// ============================================================================

console.log('\n--- DISCOVERED-ONLY COLLECTIONS: EXPLICITLY NOT EXECUTABLE ---\n');

let discoveredOnly = [];
if (discoveredSchema && discoveredSchema.collections) {
  discoveredOnly = Object.keys(discoveredSchema.collections).filter(
    (name) => name !== 'students' && !name.startsWith('system.')
  );
}

if (discoveredOnly.length > 0) {
  const testCollection = discoveredOnly[0];

  await asyncTest(
    `Discovered-only collection "${testCollection}" is not queryable`,
    async () => {
      const result = isCollectionQueryable(testCollection);
      if (result) {
        throw new Error(`${testCollection} should not be queryable`);
      }
    }
  );

  await asyncTest(
    `Discovered-only collection "${testCollection}" is not executable`,
    async () => {
      const result = isCollectionExecutable(testCollection);
      if (result) {
        throw new Error(`${testCollection} should not be executable`);
      }
    }
  );

  await asyncTest(
    `Discovered-only collection "${testCollection}" capability shows not executable`,
    async () => {
      const cap = await getCollectionCapability(testCollection, discoveredSchema);
      if (!cap) {
        throw new Error('No capability returned');
      }
      if (cap.discovered !== true) {
        throw new Error(`${testCollection} should be marked discovered`);
      }
      if (cap.queryable !== false) {
        throw new Error(`${testCollection} should NOT be marked queryable`);
      }
      if (cap.executable !== false) {
        throw new Error(`${testCollection} should NOT be marked executable`);
      }
      if (cap.hasModel !== false) {
        throw new Error(`${testCollection} should NOT have a model`);
      }
      if (!cap.reason) {
        throw new Error('Reason should be provided for non-executable collection');
      }
    }
  );

  await asyncTest(
    `Validator still rejects queries for "${testCollection}"`,
    async () => {
      const query = {
        collectionName: testCollection,
        operation: 'find',
        filter: {},
      };

      const result = validateQuery(query);
      if (result.valid) {
        throw new Error(`Validator should reject ${testCollection}`);
      }
    }
  );

  await asyncTest(
    `Execution fails for "${testCollection}" (validator blocks first)`,
    async () => {
      // This tests that executor has no model for the collection
      // Note: validator catches it first with "not allowed", which is correct
      const query = {
        collectionName: testCollection,
        operation: 'find',
        filter: {},
      };

      const result = await executeQuery(query);
      if (result.success) {
        throw new Error(`Execution should fail for ${testCollection}`);
      }
      // Validator blocks it first with "not allowed", then executor would also fail
      if (!result.error.includes('not allowed') && !result.error.includes('not supported')) {
        throw new Error(`Error unclear: ${result.error}`);
      }
    }
  );
} else {
  // No discovered-only collections in test database
  test('Note: No discovered-only collections to test (students is the only one)', true);
}

// ============================================================================
// TEST 4: CAPABILITY MERGING AND SUMMARIZATION
// ============================================================================

console.log('\n--- CAPABILITY MERGING & SUMMARIZATION ---\n');

await asyncTest('getCollectionCapabilities returns proper structure', async () => {
  const capabilities = await getCollectionCapabilities(discoveredSchema);
  if (!capabilities || typeof capabilities !== 'object') {
    throw new Error('Invalid capabilities object');
  }
  if (!capabilities.students) {
    throw new Error('Students missing from capabilities');
  }
});

await asyncTest('Discovered collections list is accurate', async () => {
  const discovered = getDiscoveredCollections(discoveredSchema);
  if (!Array.isArray(discovered)) {
    throw new Error('Discovered list is not an array');
  }
  if (!discovered.includes('students')) {
    throw new Error('Students should be in discovered list');
  }
  // Verify no system collections
  if (discovered.some((name) => name.startsWith('system.'))) {
    throw new Error('System collections should be filtered');
  }
});

await asyncTest('Capability summary is accurate', async () => {
  const capabilities = await getCollectionCapabilities(discoveredSchema);
  const summary = summarizeCapabilities(capabilities);
  if (!summary.queryable || !Array.isArray(summary.queryable)) {
    throw new Error('Summary missing queryable array');
  }
  if (!summary.queryable.includes('students')) {
    throw new Error('Students should be in queryable summary');
  }
  if (summary.summary.totalQueryable < 1) {
    throw new Error('Should have at least 1 queryable collection');
  }
});

// ============================================================================
// TEST 5: FAIL-CLOSED BEHAVIOR
// ============================================================================

console.log('\n--- FAIL-CLOSED BEHAVIOR ---\n');

await asyncTest('Handles null discovered schema gracefully', async () => {
  const capabilities = await getCollectionCapabilities(null);
  if (!capabilities || !capabilities.students) {
    throw new Error('Should still return students even with null schema');
  }
  if (!capabilities.students.queryable) {
    throw new Error('Students should still be queryable with null schema');
  }
});

await asyncTest('Handles undefined discovered schema gracefully', async () => {
  const capabilities = await getCollectionCapabilities(undefined);
  if (!capabilities || !capabilities.students) {
    throw new Error('Should still return students even with undefined schema');
  }
});

await asyncTest('Handles empty discovered schema gracefully', async () => {
  const emptySchema = { collections: {}, summary: {} };
  const capabilities = await getCollectionCapabilities(emptySchema);
  if (!capabilities || !capabilities.students) {
    throw new Error('Should still return students even with empty discovered schema');
  }
});

await asyncTest('Unknown collection returns null capability', async () => {
  const cap = await getCollectionCapability('nonexistent_xyz', discoveredSchema);
  if (cap !== null && cap !== undefined) {
    throw new Error('Unknown collection should return null capability');
  }
});

// ============================================================================
// TEST 6: NO CREDENTIALS EXPOSED
// ============================================================================

console.log('\n--- SECURITY: NO CREDENTIALS EXPOSED ---\n');

await asyncTest('Capabilities do not contain connection info', async () => {
  const capabilities = await getCollectionCapabilities(discoveredSchema);
  const capString = JSON.stringify(capabilities);

  if (capString.includes('mongodb://') || capString.includes('mongodb+srv://')) {
    throw new Error('Connection string found in capabilities');
  }
  if (capString.includes('MONGO_URI') || capString.includes('PASSWORD')) {
    throw new Error('Credentials found in capabilities');
  }
});

// ============================================================================
// TEST 7: VALIDATORS AND EXECUTOR BEHAVIOR UNCHANGED
// ============================================================================

console.log('\n--- VALIDATION: VALIDATOR/EXECUTOR UNCHANGED ---\n');

test(
  'Validator still uses hardcoded schema check',
  validateQuery({
    collectionName: 'students',
    operation: 'find',
  }).valid === true
);

test(
  'Validator still rejects invalid operations',
  validateQuery({
    collectionName: 'students',
    operation: 'insert',
  }).valid === false
);

test(
  'Validator still blocks write operations',
  validateQuery({
    collectionName: 'students',
    operation: 'delete',
  }).valid === false
);

test(
  'Validator still blocks dangerous operators',
  validateQuery({
    collectionName: 'students',
    operation: 'find',
    filter: { $where: 'true' },
  }).valid === false
);

// ============================================================================
// DISCONNECT
// ============================================================================

try {
  await mongoose.disconnect();
} catch (error) {
  // Ignore disconnect errors
}

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(50));
console.log(`RESULTS: ${passed}/${passed + failed} tests passed`);
if (failed === 0) {
  console.log('✅ All STEP 10 foundation tests passed!');
} else {
  console.log(`❌ ${failed} test(s) failed`);
}
console.log('='.repeat(50) + '\n');

// Print all results
results.forEach((result) => console.log(result));

console.log('\n');

process.exit(failed > 0 ? 1 : 0);
