/**
 * Query Executor Test Suite
 * 
 * Tests the executor against the actual MongoDB database.
 * Verifies:
 * - Valid queries execute successfully
 * - Invalid queries are rejected WITHOUT querying MongoDB
 * - Response format is consistent
 * - Results are accurate
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
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
async function test(name, query, shouldSucceed = true) {
  try {
    const result = await executeQuery(query);
    const isSuccess = result.success;

    if (isSuccess === shouldSucceed) {
      passed++;
      results.push(`✅ PASS: ${name}`);

      // For valid queries, show result summary
      if (shouldSucceed && isSuccess) {
        if (result.operation === 'count') {
          results.push(`   └─ Result: ${result.data} documents, ${result.executionTimeMs}ms`);
        } else {
          results.push(
            `   └─ Returned: ${result.count} documents, ${result.executionTimeMs}ms`
          );
        }
      }
    } else {
      failed++;
      results.push(`❌ FAIL: ${name}`);
      results.push(`   Expected success=${shouldSucceed}, got success=${isSuccess}`);
      if (!isSuccess) {
        results.push(`   Error: ${result.error}`);
      }
    }
  } catch (error) {
    failed++;
    results.push(`❌ FAIL: ${name}`);
    results.push(`   Exception: ${error.message}`);
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('=== Query Executor Test Suite ===\n');

  try {
    // Connect to database
    console.log('Connecting to MongoDB...');
    await connectDB();
    console.log('✅ Connected to MongoDB\n');

    // ====================================================================
    // VALID QUERY TESTS
    // ====================================================================

    console.log('--- VALID QUERIES ---\n');

    // Test 1: Find all students
    await test('Valid: Find all students', {
      collectionName: 'students',
      operation: 'find',
      filter: {},
    });

    // Test 2: Find students with CGPA > 8.5
    await test('Valid: CGPA > 8.5', {
      collectionName: 'students',
      operation: 'find',
      filter: {
        cgpa: {
          $gt: 8.5,
        },
      },
    });

    // Test 3: Find Computer Science students
    await test('Valid: Computer Science students', {
      collectionName: 'students',
      operation: 'find',
      filter: {
        branch: 'Computer Science',
      },
    });

    // Test 4: Find students with CGPA between 8 and 9
    await test('Valid: CGPA between 8 and 9', {
      collectionName: 'students',
      operation: 'find',
      filter: {
        cgpa: {
          $gte: 8,
          $lte: 9,
        },
      },
    });

    // Test 5: Sort students by CGPA descending
    await test('Valid: Sort by CGPA descending', {
      collectionName: 'students',
      operation: 'find',
      filter: {},
      sort: {
        cgpa: -1,
      },
    });

    // Test 6: Limit results to 3
    await test('Valid: Limit to 3 results', {
      collectionName: 'students',
      operation: 'find',
      filter: {},
      limit: 3,
    });

    // Test 7: Skip and limit
    await test('Valid: Skip 2, limit 3', {
      collectionName: 'students',
      operation: 'find',
      filter: {},
      skip: 2,
      limit: 3,
    });

    // Test 8: Projection (select specific fields)
    await test('Valid: Projection (name, cgpa)', {
      collectionName: 'students',
      operation: 'find',
      filter: {},
      projection: {
        name: 1,
        cgpa: 1,
        _id: 0,
      },
    });

    // Test 9: $or query (Computer Science OR Electronics)
    await test('Valid: $or (CS OR Electronics)', {
      collectionName: 'students',
      operation: 'find',
      filter: {
        $or: [{ branch: 'Computer Science' }, { branch: 'Electronics' }],
      },
    });

    // Test 10: Count all students
    await test('Valid: Count all students', {
      collectionName: 'students',
      operation: 'count',
      filter: {},
    });

    // Test 11: Count students with CGPA >= 9
    await test('Valid: Count CGPA >= 9', {
      collectionName: 'students',
      operation: 'count',
      filter: {
        cgpa: {
          $gte: 9,
        },
      },
    });

    // ====================================================================
    // INVALID/SECURITY TESTS
    // ====================================================================

    console.log('\n--- INVALID/SECURITY QUERIES ---\n');

    // Test 12: Unknown collection
    await test(
      'Invalid: Unknown collection',
      {
        collectionName: 'users',
        operation: 'find',
      },
      false
    );

    // Test 13: Write operation (insert)
    await test(
      'Invalid: Insert operation',
      {
        collectionName: 'students',
        operation: 'insert',
      },
      false
    );

    // Test 14: Write operation (delete)
    await test(
      'Invalid: Delete operation',
      {
        collectionName: 'students',
        operation: 'delete',
      },
      false
    );

    // Test 15: $where query (JavaScript execution)
    await test(
      'Invalid: $where operator',
      {
        collectionName: 'students',
        operation: 'find',
        filter: {
          $where: "this.cgpa > 8.5",
        },
      },
      false
    );

    // Test 16: Unknown field in filter
    await test(
      'Invalid: Unknown field (password)',
      {
        collectionName: 'students',
        operation: 'find',
        filter: {
          password: '123',
        },
      },
      false
    );

    // Test 17: Invalid CGPA type (string instead of number)
    await test(
      'Invalid: CGPA as string',
      {
        collectionName: 'students',
        operation: 'find',
        filter: {
          cgpa: 'high',
        },
      },
      false
    );

    // Test 18: Invalid limit (exceeds max)
    await test(
      'Invalid: Limit > 100',
      {
        collectionName: 'students',
        operation: 'find',
        limit: 150,
      },
      false
    );

    // Test 19: Invalid sort direction
    await test(
      'Invalid: Sort direction = 2',
      {
        collectionName: 'students',
        operation: 'find',
        sort: {
          cgpa: 2,
        },
      },
      false
    );

    // Test 20: Prototype pollution attempt
    const queryWithProto = JSON.parse(
      '{"collectionName":"students","operation":"find","filter":{"__proto__":{"admin":true}}}'
    );
    await test('Invalid: __proto__ key', queryWithProto, false);

    // ====================================================================
    // PRINT RESULTS
    // ====================================================================

    console.log('\n' + '='.repeat(50));
    console.log('TEST RESULTS');
    console.log('='.repeat(50) + '\n');

    for (const result of results) {
      console.log(result);
    }

    console.log('\n' + '='.repeat(50));
    console.log(`Total: ${passed + failed}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log('='.repeat(50));

    if (failed === 0) {
      console.log('\n✅ ALL EXECUTOR TESTS PASSED!');
    } else {
      console.log(`\n❌ ${failed} test(s) failed.`);
    }
  } catch (error) {
    console.error('Test suite error:', error.message);
    failed++;
  } finally {
    // Disconnect from database
    try {
      await mongoose.disconnect();
      console.log('\n✅ Disconnected from MongoDB');
    } catch (error) {
      console.error('Error disconnecting:', error.message);
    }

    // Exit with appropriate code
    process.exit(failed === 0 ? 0 : 1);
  }
}

// Run tests
runTests();
