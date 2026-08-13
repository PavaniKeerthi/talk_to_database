/**
 * Query API Tests
 * 
 * Tests the HTTP API endpoints for query execution and cache.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { executeStructuredQuery, askQuestion } from '../controllers/queryController.js';
import { storeQuery } from '../services/queryCache.js';
import connectDB from '../config/db.js';
import QueryHistory from '../models/QueryHistory.js';

dotenv.config();

let passed = 0;
let failed = 0;

// Mock request/response objects
const mockReq = (body = {}) => ({ body });
const mockRes = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.jsonData = data;
    return res;
  };
  return res;
};

async function test(name, fn) {
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

async function main() {
  console.log('=== Query API Tests ===\n');

  try {
    await connectDB();

    // Clean up test data
    await QueryHistory.deleteMany({
      originalQuestion: { $regex: 'api-test' },
    });

    // Test 1: Execute structured query (find all)
    await test('POST /api/query/execute - Find all students', async () => {
      const req = mockReq({
        query: {
          collectionName: 'students',
          operation: 'find',
          filter: {},
        },
      });
      const res = mockRes();

      await executeStructuredQuery(req, res);

      if (!res.jsonData || !res.jsonData.success) {
        throw new Error('Query execution failed');
      }
      if (res.jsonData.count !== 10) {
        throw new Error(`Expected 10 students, got ${res.jsonData.count}`);
      }
    });

    // Test 2: Execute structured query with filter
    await test('POST /api/query/execute - CGPA filter', async () => {
      const req = mockReq({
        query: {
          collectionName: 'students',
          operation: 'find',
          filter: {
            cgpa: { $gt: 8.5 },
          },
        },
      });
      const res = mockRes();

      await executeStructuredQuery(req, res);

      if (!res.jsonData || !res.jsonData.success) {
        throw new Error('Query execution failed');
      }
      if (res.jsonData.count < 1) {
        throw new Error('Expected at least 1 student with CGPA > 8.5');
      }
    });

    // Test 3: Execute invalid query (should fail validation)
    await test('POST /api/query/execute - Invalid query rejected', async () => {
      const req = mockReq({
        query: {
          collectionName: 'students',
          operation: 'find',
          filter: {
            $where: "this.cgpa > 8.5",
          },
        },
      });
      const res = mockRes();

      await executeStructuredQuery(req, res);

      if (res.jsonData.success !== false) {
        throw new Error('Invalid query should be rejected');
      }
    });

    // Test 4: Ask question (cache miss)
    await test('POST /api/query/ask - Cache miss', async () => {
      const req = mockReq({
        question: 'api-test show cs students',
      });
      const res = mockRes();

      await askQuestion(req, res);

      if (!res.jsonData || !res.jsonData.success) {
        throw new Error('Question handler failed');
      }
      if (res.jsonData.cacheHit !== false) {
        throw new Error('Expected cache miss for new question');
      }
    });

    // Test 5: Store query in cache
    await test('Store query in cache', async () => {
      const query = {
        collectionName: 'students',
        operation: 'find',
        filter: { branch: 'computer science' },
      };

      await storeQuery('api-test show cs students', query, {
        resultCount: 4,
        executionTimeMs: 8,
      });
    });

    // Test 6: Ask question (cache hit)
    await test('POST /api/query/ask - Cache hit', async () => {
      const req = mockReq({
        question: 'api-test show cs students',
      });
      const res = mockRes();

      await askQuestion(req, res);

      if (!res.jsonData || !res.jsonData.success) {
        throw new Error('Question handler failed');
      }
      if (res.jsonData.cacheHit !== true) {
        throw new Error('Expected cache hit after storing query');
      }
    });

    // Test 7: Missing request body
    await test('POST /api/query/execute - Missing query field', async () => {
      const req = mockReq({});
      const res = mockRes();

      await executeStructuredQuery(req, res);

      if (res.statusCode !== 400) {
        throw new Error('Should return 400 for missing query');
      }
    });

    // Test 8: Count operation
    await test('POST /api/query/execute - Count operation', async () => {
      const req = mockReq({
        query: {
          collectionName: 'students',
          operation: 'count',
          filter: { cgpa: { $gte: 8 } },
        },
      });
      const res = mockRes();

      await executeStructuredQuery(req, res);

      if (!res.jsonData || !res.jsonData.success) {
        throw new Error('Count execution failed');
      }
      if (typeof res.jsonData.data !== 'number') {
        throw new Error('Count should return a number');
      }
    });

    // Clean up test data
    await QueryHistory.deleteMany({
      originalQuestion: { $regex: 'api-test' },
    });

    console.log(`\n${'='.repeat(50)}`);
    console.log(`Total: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);
    console.log('='.repeat(50));

    if (failed === 0) {
      console.log('\n✅ ALL API TESTS PASSED');
    }
  } catch (error) {
    console.error('Test error:', error.message);
    failed++;
  } finally {
    await mongoose.disconnect();
    process.exit(failed === 0 ? 0 : 1);
  }
}

main();
