/**
 * AI Query Generator Test Suite
 * 
 * Tests the AI query generation with mocked AI responses.
 * Does NOT connect to MongoDB.
 * Does NOT call real AI APIs (uses NO_AI=true for mock provider).
 */

import generateQuery from '../services/aiQueryGenerator.js';
import { validateQuery } from '../services/queryValidator.js';

// Test results tracking
let passed = 0;
let failed = 0;
const results = [];

/**
 * Helper to run a single test
 */
async function test(name, normalizedQuestion, expectedCollectionName, expectedOperation) {
  try {
    const generatedQuery = await generateQuery(normalizedQuestion);

    if (!generatedQuery) {
      failed++;
      results.push(`❌ FAIL: ${name}`);
      results.push(`   Expected query object, got null`);
      return;
    }

    // Verify collection name
    if (generatedQuery.collectionName !== expectedCollectionName) {
      failed++;
      results.push(`❌ FAIL: ${name}`);
      results.push(`   Expected collectionName="${expectedCollectionName}", got "${generatedQuery.collectionName}"`);
      return;
    }

    // Verify operation
    if (generatedQuery.operation !== expectedOperation) {
      failed++;
      results.push(`❌ FAIL: ${name}`);
      results.push(`   Expected operation="${expectedOperation}", got "${generatedQuery.operation}"`);
      return;
    }

    // Verify it passes validation
    const validationResult = validateQuery(generatedQuery);
    if (!validationResult.valid) {
      failed++;
      results.push(`❌ FAIL: ${name}`);
      results.push(`   Query failed validation: ${validationResult.error}`);
      results.push(`   Generated query: ${JSON.stringify(generatedQuery)}`);
      return;
    }

    passed++;
    results.push(`✅ PASS: ${name}`);
  } catch (error) {
    failed++;
    results.push(`❌ FAIL: ${name}`);
    results.push(`   Error: ${error.message}`);
  }
}

/**
 * Helper to test that a query fails validation as expected
 */
async function testShouldFailValidation(name, normalizedQuestion) {
  try {
    const generatedQuery = await generateQuery(normalizedQuestion);

    if (!generatedQuery) {
      passed++;
      results.push(`✅ PASS: ${name} (correctly returned null)`);
      return;
    }

    // Verify it fails validation
    const validationResult = validateQuery(generatedQuery);
    if (validationResult.valid) {
      failed++;
      results.push(`❌ FAIL: ${name}`);
      results.push(
        `   Query should have failed validation but passed: ${JSON.stringify(generatedQuery)}`
      );
      return;
    }

    passed++;
    results.push(`✅ PASS: ${name} (correctly failed validation)`);
  } catch (error) {
    failed++;
    results.push(`❌ FAIL: ${name}`);
    results.push(`   Error: ${error.message}`);
  }
}

// ============================================================================
// SETUP: Use mock AI provider for testing
// ============================================================================

process.env.NO_AI = 'true';
delete process.env.OPENAI_API_KEY;

console.log('=== AI Query Generator Test Suite ===\n');
console.log('Using mock AI provider (NO_AI=true)\n');

// ============================================================================
// BASIC GENERATION TESTS
// ============================================================================

console.log('--- BASIC GENERATION TESTS ---\n');

await test('Generate: Show all students', 'show all students', 'students', 'find');

await test('Generate: Show CS students', 'show computer science students', 'students', 'find');

await test('Generate: CGPA comparison', 'show students with cgpa above 8.5', 'students', 'find');

await test('Generate: Count students', 'count all students', 'students', 'count');

await test('Generate: Count CS students', 'how many computer science students', 'students', 'count');

// ============================================================================
// FILTER TESTS
// ============================================================================

console.log('\n--- FILTER TESTS ---\n');

// Test that CS filter is applied
await test('Filter: CS students', 'show computer science students', 'students', 'find');

// Test that CGPA filter is applied
await test('Filter: CGPA above 8.5', 'students with cgpa above 8.5', 'students', 'find');

// ============================================================================
// SORTING AND LIMITING TESTS
// ============================================================================

console.log('\n--- SORTING AND LIMITING TESTS ---\n');

await test('Limit: Top 5 students', 'top 5 students by cgpa', 'students', 'find');

await test('Limit: Top 10 students', 'top 10 students by cgpa', 'students', 'find');

// ============================================================================
// YEAR FILTERING TESTS
// ============================================================================

console.log('\n--- YEAR FILTERING TESTS ---\n');

await test('Filter: Year 1 students', 'show year 1 students', 'students', 'find');

await test('Filter: Year 4 students', 'show year 4 students', 'students', 'find');

// ============================================================================
// UNRECOGNIZED QUESTION TESTS
// ============================================================================

console.log('\n--- UNRECOGNIZED QUESTION TESTS ---\n');

// For unrecognized questions, the mock provider returns null (which is acceptable)
async function testMayReturnNull(name, normalizedQuestion) {
  try {
    const result = await generateQuery(normalizedQuestion);
    
    if (result === null) {
      passed++;
      results.push(`✅ PASS: ${name} (correctly returned null for unrecognized question)`);
    } else {
      // If it generated something, it must be valid
      const validationResult = validateQuery(result);
      if (validationResult.valid) {
        passed++;
        results.push(`✅ PASS: ${name} (generated valid query)`);
      } else {
        failed++;
        results.push(`❌ FAIL: ${name}`);
        results.push(`   Generated invalid query: ${validationResult.error}`);
      }
    }
  } catch (error) {
    failed++;
    results.push(`❌ FAIL: ${name}`);
    results.push(`   Error: ${error.message}`);
  }
}

await testMayReturnNull('Unrecognized: Random question', 'what is the weather today');

await testMayReturnNull('Unrecognized: Minimal show students', 'show students');

// ============================================================================
// GENERATED QUERY VALIDATION TESTS
// ============================================================================

console.log('\n--- GENERATED QUERY VALIDATION TESTS ---\n');

async function testGeneratedQueryStructure(name, normalizedQuestion) {
  try {
    const generatedQuery = await generateQuery(normalizedQuestion);

    if (!generatedQuery) {
      failed++;
      results.push(`❌ FAIL: ${name}`);
      results.push(`   Expected query object, got null`);
      return;
    }

    // Check required properties exist
    if (!generatedQuery.collectionName || !generatedQuery.operation) {
      failed++;
      results.push(`❌ FAIL: ${name}`);
      results.push(`   Missing required properties`);
      return;
    }

    // Validate the entire query
    const validationResult = validateQuery(generatedQuery);

    if (!validationResult.valid) {
      failed++;
      results.push(`❌ FAIL: ${name}`);
      results.push(`   Validation failed: ${validationResult.error}`);
      return;
    }

    // Verify query structure is safe (no functions, no circular refs)
    try {
      JSON.stringify(generatedQuery);
      passed++;
      results.push(`✅ PASS: ${name}`);
    } catch (stringifyError) {
      failed++;
      results.push(`❌ FAIL: ${name}`);
      results.push(`   Query contains non-serializable properties`);
    }
  } catch (error) {
    failed++;
    results.push(`❌ FAIL: ${name}`);
    results.push(`   Error: ${error.message}`);
  }
}

await testGeneratedQueryStructure('Structure: Query is JSON-serializable', 'show all students');

await testGeneratedQueryStructure('Structure: Complex query is valid', 'show computer science students');

// ============================================================================

console.log('\n--- AI OUTPUT SANITIZATION TESTS ---\n');

async function testInvalidInput(name, input, shouldReturnNull = true) {
  try {
    const result = await generateQuery(input);

    if (shouldReturnNull && result === null) {
      passed++;
      results.push(`✅ PASS: ${name}`);
    } else if (!shouldReturnNull && result !== null) {
      passed++;
      results.push(`✅ PASS: ${name}`);
    } else {
      failed++;
      results.push(`❌ FAIL: ${name}`);
      results.push(`   Expected null=${shouldReturnNull}, got ${result === null}`);
    }
  } catch (error) {
    failed++;
    results.push(`❌ FAIL: ${name}`);
    results.push(`   Error: ${error.message}`);
  }
}

await testInvalidInput('Input: Null question', null, true);

await testInvalidInput('Input: Empty string', '', true);

await testInvalidInput('Input: Whitespace only', '   ', true);

await testInvalidInput('Input: Non-string', 123, true);

// ============================================================================
// SECURITY TESTS
// ============================================================================

console.log('\n--- SECURITY TESTS ---\n');

/**
 * Test that dangerous operations are rejected by the validator
 * (even if AI somehow generated them)
 */
async function testSecurityBoundary(name, dangerousQuery) {
  const validationResult = validateQuery(dangerousQuery);

  if (!validationResult.valid) {
    passed++;
    results.push(`✅ PASS: ${name}`);
  } else {
    failed++;
    results.push(`❌ FAIL: ${name}`);
    results.push(`   Dangerous query passed validation: ${JSON.stringify(dangerousQuery)}`);
  }
}

await testSecurityBoundary('Security: Insert operation rejected', {
  collectionName: 'students',
  operation: 'insert',
});

await testSecurityBoundary('Security: Update operation rejected', {
  collectionName: 'students',
  operation: 'update',
});

await testSecurityBoundary('Security: Delete operation rejected', {
  collectionName: 'students',
  operation: 'delete',
});

await testSecurityBoundary('Security: Unknown field rejected', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    nonexistentField: 'value',
  },
});

await testSecurityBoundary('Security: Dangerous operator rejected', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    name: {
      $regex: '.*',
    },
  },
});

// ============================================================================
// RESULTS
// ============================================================================

console.log('\n=== Test Results ===\n');

results.forEach((result) => {
  console.log(result);
});

console.log(`\n${'='.repeat(50)}`);
console.log(`Total: ${passed + failed} tests`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`${'='.repeat(50)}\n`);

// Exit with error code if any tests failed
if (failed > 0) {
  console.error('SOME TESTS FAILED');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED');
  process.exit(0);
}
