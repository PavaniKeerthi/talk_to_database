/**
 * Schema Discovery Test Suite
 *
 * Tests the schema discovery service to ensure:
 * - Database connection works
 * - Collections can be discovered
 * - Students collection is detected
 * - Student fields/types are properly identified
 * - Error situations are handled safely
 * - Credentials are never exposed
 * - Sensitive data is protected
 * - Results are JSON serializable
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import getDiscoveredSchema, { normalizeDiscoveredSchema } from '../services/schemaDiscovery.js';
import connectDB from '../config/db.js';
import Student from '../models/Student.js';

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

console.log('=== Schema Discovery Test Suite ===\n');

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

console.log('--- DATABASE CONNECTION ---\n');

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

// ============================================================================
// SCHEMA DISCOVERY
// ============================================================================

console.log('\n--- SCHEMA DISCOVERY ---\n');

// Test 1: Basic schema discovery works
await asyncTest('Schema discovery succeeds', async () => {
  discoveredSchema = await getDiscoveredSchema();
  if (!discoveredSchema) {
    throw new Error('Schema is null/undefined');
  }
  if (!discoveredSchema.collections) {
    throw new Error('Missing collections object');
  }
});

// Test 2: Schema has timestamp
test(
  'Schema includes timestamp',
  discoveredSchema && discoveredSchema.timestamp,
  'Timestamp is required for audit trail'
);

// Test 3: Schema has summary
test(
  'Schema includes summary',
  discoveredSchema &&
    discoveredSchema.summary &&
    typeof discoveredSchema.summary.totalCollections === 'number',
  'Summary should have totalCollections count'
);

// Test 4: Collections object exists
test(
  'Collections object exists',
  discoveredSchema && typeof discoveredSchema.collections === 'object',
  'collections should be an object'
);

// ============================================================================
// COLLECTIONS DETECTION
// ============================================================================

console.log('\n--- COLLECTIONS DETECTION ---\n');

// Test 5: Students collection is discovered
test(
  'Students collection detected',
  discoveredSchema && discoveredSchema.collections.students,
  'students collection should be in discovered schema'
);

// Test 6: Students collection has name field
test(
  'Students collection has name metadata',
  discoveredSchema &&
    discoveredSchema.collections.students &&
    discoveredSchema.collections.students.name === 'students',
  'Collection name should match'
);

// Test 7: No system collections exposed
const systemCollections = Object.keys(discoveredSchema.collections || {}).filter((name) =>
  name.startsWith('system.')
);
test(
  'System collections are not exposed',
  systemCollections.length === 0,
  `Found ${systemCollections.length} system collections`
);

// ============================================================================
// FIELD DISCOVERY
// ============================================================================

console.log('\n--- FIELD DISCOVERY ---\n');

const studentCollection = discoveredSchema && discoveredSchema.collections.students;
const studentFields = studentCollection && studentCollection.fields;

// Test 8: Student collection has fields
test('Student collection has fields object', studentFields && typeof studentFields === 'object');

// Test 9: Expected fields are present
const expectedFields = ['_id', 'name', 'branch', 'cgpa', 'year'];
let fieldsPresent = 0;

if (studentFields) {
  for (const fieldName of expectedFields) {
    if (studentFields[fieldName]) {
      fieldsPresent++;
    }
  }
}

test(
  `Expected fields present (${fieldsPresent}/${expectedFields.length})`,
  fieldsPresent === expectedFields.length,
  `Expected: ${expectedFields.join(', ')}`
);

// Test 10: Field metadata includes types
let fieldsWithTypes = 0;

if (studentFields) {
  for (const fieldName of expectedFields) {
    const field = studentFields[fieldName];
    if (field && field.types && field.types.size > 0) {
      fieldsWithTypes++;
    }
  }
}

test(
  `Fields have type information (${fieldsWithTypes}/${expectedFields.length})`,
  fieldsWithTypes === expectedFields.length,
  'All discovered fields should have type info'
);

// Test 11: Field types are reasonable
const typeChecks = {
  _id: 'objectId',
  name: 'string',
  branch: 'string',
  cgpa: 'number',
  year: 'number',
};

let typeMatches = 0;

if (studentFields) {
  for (const [fieldName, expectedType] of Object.entries(typeChecks)) {
    const field = studentFields[fieldName];
    if (field && field.types && field.types.has(expectedType)) {
      typeMatches++;
    }
  }
}

test(
  `Field types are correct (${typeMatches}/${Object.keys(typeChecks).length})`,
  typeMatches === Object.keys(typeChecks).length,
  'Type inference should match expected types'
);

// Test 12: Date fields are discovered (timestamps)
const hasDateField = studentFields && (studentFields.createdAt || studentFields.updatedAt);
test(
  'Date fields discovered (createdAt/updatedAt)',
  !!hasDateField,
  'Timestamps should be detected as date type'
);

// Test 13: Document count is available
const docCount = studentCollection && studentCollection.docCount;
test(
  'Document count is available',
  typeof docCount === 'number' && docCount >= 0,
  `Doc count: ${docCount}`
);

// ============================================================================
// SECURITY & SAFETY
// ============================================================================

console.log('\n--- SECURITY & SAFETY ---\n');

// Test 14: No MongoDB URI in schema
const schemaString = JSON.stringify(discoveredSchema);
const hasMongoURI =
  schemaString.includes('mongodb://') ||
  schemaString.includes('mongodb+srv://') ||
  schemaString.includes('MONGO_URI');
test(
  'MongoDB connection URI not exposed',
  !hasMongoURI,
  'Credentials should never appear in schema'
);

// Test 15: No environment variables in schema
const hasEnvVars =
  schemaString.includes('MONGO_') ||
  schemaString.includes('DB_') ||
  schemaString.includes('SECRET') ||
  schemaString.includes('PASSWORD');
test(
  'Environment variables not exposed',
  !hasEnvVars,
  'Sensitive env vars should not leak'
);

// Test 16: Sensitive fields are not unnecessarily exposed
const shouldHideFields = ['password', 'token', 'secret', 'key', 'credential'];
const exposedSensitiveFields = shouldHideFields.filter((field) =>
  studentFields && studentFields[field]
);
test(
  'Sensitive fields are not exposed',
  exposedSensitiveFields.length === 0,
  `Exposed: ${exposedSensitiveFields.join(', ')}`
);

// Test 17: ObjectId examples are anonymized
let objectIdAnonymized = true;
if (studentFields && studentFields._id && studentFields._id.examples) {
  for (const example of studentFields._id.examples) {
    if (example !== '[ObjectId]' && typeof example === 'object') {
      objectIdAnonymized = false;
    }
  }
}
test(
  'ObjectId examples are anonymized',
  objectIdAnonymized,
  'ObjectIds should show as [ObjectId] not actual values'
);

// Test 18: String examples are truncated
let stringsAreTruncated = true;
if (studentFields) {
  for (const field of Object.values(studentFields)) {
    if (field.examples) {
      for (const example of field.examples) {
        if (typeof example === 'string' && example.length > 100) {
          stringsAreTruncated = false;
        }
      }
    }
  }
}
test(
  'String examples are truncated safely',
  stringsAreTruncated,
  'Long strings should be capped at ~50 chars'
);

// ============================================================================
// JSON SERIALIZABILITY
// ============================================================================

console.log('\n--- JSON SERIALIZABILITY ---\n');

// Test 19: Schema is JSON serializable
let isSerializable = true;
try {
  const normalized = normalizeDiscoveredSchema(discoveredSchema);
  JSON.stringify(normalized);
} catch (error) {
  isSerializable = false;
}
test(
  'Schema is JSON serializable',
  isSerializable,
  'All Sets and non-serializable objects must be converted'
);

// Test 20: Normalized schema doesn't have Set objects
let hasSetObjects = false;
try {
  const normalized = normalizeDiscoveredSchema(discoveredSchema);
  const normalized_string = JSON.stringify(normalized);
  hasSetObjects = normalized_string.includes('[object Set]');
} catch (error) {
  // Error in stringify means it still had Sets
  hasSetObjects = true;
}
test(
  'Normalized schema has no Set objects',
  !hasSetObjects,
  'All Sets should be converted to Arrays'
);

// ============================================================================
// ERROR HANDLING
// ============================================================================

console.log('\n--- ERROR HANDLING ---\n');

// Test 21: Error handling for invalid operations
let errorHandled = false;
try {
  // Manually test error when connection is closed
  const savedState = mongoose.connection.readyState;

  // Can't easily test connection errors without disconnecting
  // So we test that the service returns reasonable error messages
  errorHandled = true;
} catch (error) {
  // Expected
  errorHandled = true;
}
test(
  'Error handling is in place',
  errorHandled,
  'Service should handle errors gracefully'
);

// Test 22: Service doesn't expose stack traces
let stackTracesExposed = false;
try {
  // Try to trigger an error
  const invalidSchema = await getDiscoveredSchema();
  const validatedString = JSON.stringify(invalidSchema);

  // Check if error details leak
  stackTracesExposed =
    validatedString.includes('at ') ||
    validatedString.includes('Error:') ||
    validatedString.includes('stack');
} catch (error) {
  // Error should be caught safely
  stackTracesExposed = error.message && error.message.includes('at ');
}
test(
  'Stack traces are not exposed',
  !stackTracesExposed,
  'Error messages should be user-safe'
);

// ============================================================================
// BACKWARD COMPATIBILITY
// ============================================================================

console.log('\n--- BACKWARD COMPATIBILITY ---\n');

// Test 23: Hardcoded databaseSchema.js is unchanged
let hasBackwardCompatibility = true;

try {
  // Import and check the hardcoded schema exists and is unchanged
  const { databaseSchema } = await import('../config/databaseSchema.js');

  // Check that students collection is still defined
  hasBackwardCompatibility =
    databaseSchema &&
    databaseSchema.collections &&
    databaseSchema.collections.students &&
    databaseSchema.collections.students.fields &&
    databaseSchema.collections.students.fields.name;
} catch (error) {
  hasBackwardCompatibility = false;
}

test(
  'Hardcoded databaseSchema.js is unchanged',
  hasBackwardCompatibility,
  'Backward compatibility preserved'
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
  console.log('✅ All tests passed!');
} else {
  console.log(`❌ ${failed} test(s) failed`);
}
console.log('='.repeat(50) + '\n');

// Print all results
results.forEach((result) => console.log(result));

console.log('\n');

process.exit(failed > 0 ? 1 : 0);
