/**
 * STEP 9 Integration Tests
 *
 * Verifies that schema discovery is properly integrated into the AI generation pipeline
 * without weakening security boundaries.
 *
 * Tests verify:
 * - Discovered schema can be passed to AI generation
 * - AI generation still works without discovered schema
 * - Schema discovery failure does not break query generation
 * - Discovered schema does NOT bypass validation
 * - Unknown collections are still rejected by validator
 * - Existing students queries still work
 * - No write operations can be introduced through discovered schema
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import generateQuery from '../services/aiQueryGenerator.js';
import validateQuery from '../services/queryValidator.js';
import executeQuery from '../services/queryExecutor.js';
import getDiscoveredSchema, { normalizeDiscoveredSchema } from '../services/schemaDiscovery.js';
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

console.log('=== STEP 9 Integration Tests ===\n');

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
// TEST 1: AI GENERATION WITHOUT DISCOVERED SCHEMA (Backward Compatibility)
// ============================================================================

console.log('\n--- AI GENERATION: WITHOUT DISCOVERED SCHEMA ---\n');

await asyncTest('Generate query without schema (backward compat)', async () => {
  const query = await generateQuery('Show all students');
  if (!query) {
    throw new Error('Query generation failed');
  }
  if (!query.collectionName || !query.operation) {
    throw new Error('Query missing required fields');
  }
});

await asyncTest('Generated query can be validated (without schema)', async () => {
  const query = await generateQuery('Show CS students');
  if (!query) {
    throw new Error('Query generation failed');
  }
  const validation = validateQuery(query);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.error}`);
  }
});

// ============================================================================
// TEST 2: AI GENERATION WITH DISCOVERED SCHEMA (New Feature)
// ============================================================================

console.log('\n--- AI GENERATION: WITH DISCOVERED SCHEMA ---\n');

await asyncTest('Generate query with schema parameter', async () => {
  const query = await generateQuery('Show all students', discoveredSchema);
  if (!query) {
    throw new Error('Query generation failed');
  }
  if (!query.collectionName || !query.operation) {
    throw new Error('Query missing required fields');
  }
});

await asyncTest('Generated query with schema can be validated', async () => {
  const query = await generateQuery('Show Computer Science students', discoveredSchema);
  if (!query) {
    throw new Error('Query generation failed');
  }
  const validation = validateQuery(query);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.error}`);
  }
});

// ============================================================================
// TEST 3: SCHEMA DISCOVERY FAILURE HANDLING (Graceful Degradation)
// ============================================================================

console.log('\n--- SCHEMA DISCOVERY: FAILURE HANDLING ---\n');

await asyncTest('Generation works when schema is null', async () => {
  const query = await generateQuery('Show students', null);
  if (!query) {
    throw new Error('Query generation failed with null schema');
  }
});

await asyncTest('Generation works when schema is undefined', async () => {
  const query = await generateQuery('Show students');
  if (!query) {
    throw new Error('Query generation failed with undefined schema');
  }
});

await asyncTest('Generation works when schema is invalid object', async () => {
  const query = await generateQuery('Show students', { invalid: 'schema' });
  if (!query) {
    throw new Error('Query generation failed with invalid schema');
  }
});

// ============================================================================
// TEST 4: VALIDATION AUTHORITY REMAINS HARDCODED (Security Boundary)
// ============================================================================

console.log('\n--- SECURITY: VALIDATION AUTHORITY UNCHANGED ---\n');

await asyncTest('Validator rejects unknown collection even with discovered schema', async () => {
  // Construct a query for a collection that doesn't exist in hardcoded schema
  const maliciousQuery = {
    collectionName: 'users', // This is NOT in databaseSchema.js
    operation: 'find',
    filter: {},
  };

  const validation = validateQuery(maliciousQuery);
  if (validation.valid) {
    throw new Error('Validator should reject unknown collection "users"');
  }
  if (!validation.error.includes('not allowed')) {
    throw new Error(`Validator error message unclear: ${validation.error}`);
  }
});

await asyncTest('Validator still blocks write operations with discovered schema', async () => {
  const writeQuery = {
    collectionName: 'students',
    operation: 'insert', // DANGEROUS: write operation
    data: { name: 'Hacker' },
  };

  const validation = validateQuery(writeQuery);
  if (validation.valid) {
    throw new Error('Validator should reject write operation "insert"');
  }
});

await asyncTest('Validator still blocks dangerous operators', async () => {
  const dangerousQuery = {
    collectionName: 'students',
    operation: 'find',
    filter: {
      $where: 'this.cgpa > 8.5', // DANGEROUS: arbitrary code
    },
  };

  const validation = validateQuery(dangerousQuery);
  if (validation.valid) {
    throw new Error('Validator should reject $where operator');
  }
});

// ============================================================================
// TEST 5: DISCOVERED SCHEMA DOES NOT WEAKEN SECURITY (Double Validation)
// ============================================================================

console.log('\n--- SECURITY: DISCOVERED SCHEMA CANNOT BYPASS VALIDATION ---\n');

await asyncTest('Discovered schema + malicious query still rejected', async () => {
  // Even if discovered schema lists a collection, unknown collections should still be rejected
  const query = {
    collectionName: 'nonexistent',
    operation: 'find',
    filter: {},
  };

  const validation = validateQuery(query);
  if (validation.valid) {
    throw new Error('Query for unknown collection should be rejected');
  }
});

// ============================================================================
// TEST 6: STUDENTS COLLECTION STILL WORKS (Backward Compatibility)
// ============================================================================

console.log('\n--- BACKWARD COMPATIBILITY: STUDENTS QUERIES ---\n');

await asyncTest('Students query generation still works', async () => {
  const query = await generateQuery('Show all students');
  if (!query || query.collectionName !== 'students') {
    throw new Error('Students query generation failed');
  }
});

await asyncTest('Students query validation still passes', async () => {
  const query = await generateQuery('Show Computer Science students', discoveredSchema);
  const validation = validateQuery(query);
  if (!validation.valid) {
    throw new Error(`Students query validation failed: ${validation.error}`);
  }
});

await asyncTest('Students query execution still works', async () => {
  const query = await generateQuery('Show all students');
  const validation = validateQuery(query);
  const result = await executeQuery(validation.query);
  if (!result.success) {
    throw new Error(`Students query execution failed: ${result.error}`);
  }
});

// ============================================================================
// TEST 7: SCHEMA DISCOVERY DOES NOT EXPOSE SENSITIVE DATA
// ============================================================================

console.log('\n--- SECURITY: NO SENSITIVE DATA EXPOSURE ---\n');

test(
  'Discovered schema does not contain MongoDB URI',
  !JSON.stringify(discoveredSchema).includes('mongodb://') &&
    !JSON.stringify(discoveredSchema).includes('mongodb+srv://')
);

test(
  'Discovered schema does not contain MONGO_URI env var',
  !JSON.stringify(discoveredSchema).includes('MONGO_URI')
);

test(
  'Discovered schema does not contain credentials',
  !JSON.stringify(discoveredSchema).includes('password') &&
    !JSON.stringify(discoveredSchema).includes('secret')
);

// ============================================================================
// TEST 8: SCHEMA DISCOVERY INTEGRATION FLOW (End-to-End)
// ============================================================================

console.log('\n--- INTEGRATION FLOW: SCHEMA → AI → VALIDATOR → EXECUTOR ---\n');

await asyncTest('Complete flow: discovery → generation → validation → execution', async () => {
  // Step 1: Discover schema
  const schema = await getDiscoveredSchema();
  if (!schema) {
    throw new Error('Schema discovery failed');
  }

  // Step 2: Generate query with schema
  const query = await generateQuery('Show all students', schema);
  if (!query) {
    throw new Error('Query generation failed');
  }

  // Step 3: Validate
  const validation = validateQuery(query);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.error}`);
  }

  // Step 4: Execute
  const result = await executeQuery(validation.query);
  if (!result.success) {
    throw new Error(`Execution failed: ${result.error}`);
  }

  if (typeof result.count !== 'number') {
    throw new Error('Result does not contain document count');
  }
});

await asyncTest('Schema is normalized before being passed to provider', async () => {
  // Ensure discovered schema can be JSON stringified (Sets converted to Arrays)
  const normalized = normalizeDiscoveredSchema(discoveredSchema);
  const stringified = JSON.stringify(normalized);
  if (!stringified) {
    throw new Error('Schema cannot be JSON stringified');
  }
  if (stringified.includes('[object Set]')) {
    throw new Error('Normalized schema still contains Set objects');
  }
});

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
  console.log('✅ All STEP 9 integration tests passed!');
} else {
  console.log(`❌ ${failed} test(s) failed`);
}
console.log('='.repeat(50) + '\n');

// Print all results
results.forEach((result) => console.log(result));

console.log('\n');

process.exit(failed > 0 ? 1 : 0);
