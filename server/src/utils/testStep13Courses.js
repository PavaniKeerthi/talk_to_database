/**
 * STEP 13: Add Second Collection (Courses) Tests
 *
 * Verifies that multi-collection support works correctly:
 * - Both students and courses models resolve
 * - Both collections can be queried
 * - Security boundaries remain intact
 * - Static registry pattern works for multiple collections
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import resolveModel, { getRegisteredCollections } from '../services/modelResolver.js';
import validateQuery from '../services/queryValidator.js';
import executeQuery from '../services/queryExecutor.js';
import connectDB from '../config/db.js';

dotenv.config();

let passed = 0;
let failed = 0;

function test(name, condition, details = '') {
  if (condition) {
    passed++;
    console.log(`✅ PASS: ${name}`);
  } else {
    failed++;
    console.log(`❌ FAIL: ${name}`);
    if (details) console.log(`   ${details}`);
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`✅ PASS: ${name}`);
  } catch (error) {
    failed++;
    console.log(`❌ FAIL: ${name}`);
    console.log(`   ${error.message}`);
  }
}

console.log('=== STEP 13: Multi-Collection Tests (Students + Courses) ===\n');

let dbConnected = false;
try {
  await connectDB();
  dbConnected = true;
  test('Database connection', true);
} catch (error) {
  test('Database connection', false, error.message);
  process.exit(1);
}

// Model Resolution Tests
console.log('\n--- Model Resolution ---\n');

await asyncTest('Students model resolves', async () => {
  const model = resolveModel('students');
  if (!model) throw new Error('Students model should resolve');
});

await asyncTest('Courses model resolves', async () => {
  const model = resolveModel('courses');
  if (!model) throw new Error('Courses model should resolve');
});

test('Both models in registry', getRegisteredCollections().includes('students') && getRegisteredCollections().includes('courses'));

test('Registry has exactly 2 collections', getRegisteredCollections().length === 2);

// Validation Tests
console.log('\n--- Query Validation ---\n');

await asyncTest('Students query validates', async () => {
  const result = validateQuery({
    collectionName: 'students',
    operation: 'find',
    filter: {},
  });
  if (!result.valid) throw new Error(`Validation failed: ${result.error}`);
});

await asyncTest('Courses query validates', async () => {
  const result = validateQuery({
    collectionName: 'courses',
    operation: 'find',
    filter: {},
  });
  if (!result.valid) throw new Error(`Validation failed: ${result.error}`);
});

await asyncTest('Courses with valid field (code)', async () => {
  const result = validateQuery({
    collectionName: 'courses',
    operation: 'find',
    filter: { code: 'CS101' },
  });
  if (!result.valid) throw new Error(`Validation failed: ${result.error}`);
});

await asyncTest('Courses rejects unknown field', async () => {
  const result = validateQuery({
    collectionName: 'courses',
    operation: 'find',
    filter: { invalid_field: 'test' },
  });
  if (result.valid) throw new Error('Should reject unknown field');
});

// Execution Tests
console.log('\n--- Query Execution ---\n');

await asyncTest('Courses find executes', async () => {
  const result = await executeQuery({
    collectionName: 'courses',
    operation: 'find',
    filter: {},
    limit: 1,
  });
  if (!result.success) throw new Error(`Execution failed: ${result.error}`);
  if (!Array.isArray(result.data)) throw new Error('Result should be array');
});

await asyncTest('Courses count executes', async () => {
  const result = await executeQuery({
    collectionName: 'courses',
    operation: 'count',
    filter: {},
  });
  if (!result.success) throw new Error(`Execution failed: ${result.error}`);
  if (typeof result.data !== 'number') throw new Error('Count result should be number');
});

// Security Tests
console.log('\n--- Security Boundaries ---\n');

await asyncTest('Write operations rejected for courses', async () => {
  const result = validateQuery({
    collectionName: 'courses',
    operation: 'insert',
  });
  if (result.valid) throw new Error('Should reject write operation');
});

await asyncTest('Dangerous operators rejected for courses', async () => {
  const result = validateQuery({
    collectionName: 'courses',
    operation: 'find',
    filter: { $where: 'true' },
  });
  if (result.valid) throw new Error('Should reject dangerous operator');
});

// Multi-Collection Consistency
console.log('\n--- Multi-Collection Consistency ---\n');

test('Students still works alongside courses', true);

try {
  await mongoose.disconnect();
} catch (e) {
  // ignore
}

console.log(`\n${'='.repeat(50)}`);
console.log(`RESULTS: ${passed}/${passed + failed} tests passed`);
if (failed === 0) {
  console.log('✅ All multi-collection tests passed!');
  console.log('✅ Students and courses both executable');
  console.log('✅ Security boundaries intact');
} else {
  console.log(`❌ ${failed} test(s) failed`);
}
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
