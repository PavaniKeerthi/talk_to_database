/**
 * STEP 15: Multi-Collection Caching and End-to-End API Integration Tests
 *
 * Verifies that:
 * 1. QueryHistory accepts 'students' and 'courses' records and rejects unknown collections.
 * 2. Courses queries can be executed directly via API (/api/query/execute).
 * 3. Courses natural language questions work end-to-end via API (/api/query/ask) with cache miss -> store -> cache hit.
 * 4. QueryHistory and stats include courses queries.
 * 5. collectionCapabilities includes courses in executable collections.
 * 6. Students behavior remains completely intact.
 * 7. Security boundaries (write operations and dangerous operators) remain strictly enforced.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import QueryHistory from '../models/QueryHistory.js';
import {
  executeStructuredQuery,
  askQuestion,
  getQueryHistory,
  getQueryStats,
} from '../controllers/queryController.js';
import {
  isCollectionExecutable,
  isCollectionQueryable,
  getExecutableCollections,
  getCollectionCapabilities,
} from '../services/collectionCapabilities.js';
import validateQuery from '../services/queryValidator.js';

// Use mock AI provider for deterministic query generation
process.env.NO_AI = 'true';
delete process.env.OPENAI_API_KEY;

dotenv.config();

let passed = 0;
let failed = 0;
const results = [];

function test(name, condition, details = '') {
  if (condition) {
    passed++;
    results.push(`✅ PASS: ${name}`);
    console.log(`✅ PASS: ${name}`);
  } else {
    failed++;
    results.push(`❌ FAIL: ${name}`);
    console.log(`❌ FAIL: ${name}`);
    if (details) {
      results.push(`   ${details}`);
      console.log(`   ${details}`);
    }
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    passed++;
    results.push(`✅ PASS: ${name}`);
    console.log(`✅ PASS: ${name}`);
  } catch (error) {
    failed++;
    results.push(`❌ FAIL: ${name}`);
    results.push(`   Error: ${error.message}`);
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${error.message}`);
  }
}

// Mock HTTP request / response helpers
const mockReq = (body = {}, query = {}) => ({ body, query });
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

async function main() {
  console.log('=== STEP 15 Integration Tests ===\n');

  try {
    await connectDB();
    console.log('Connected to MongoDB for STEP 15 tests.\n');

    // Clean up any existing test records
    await QueryHistory.deleteMany({
      originalQuestion: { $regex: 'step15-test' },
    });

    // ========================================================================
    // 1. QUERY HISTORY SCHEMA TESTS
    // ========================================================================
    console.log('--- 1. QueryHistory Whitelist Validation ---');

    await asyncTest('QueryHistory students record accepted', async () => {
      const record = new QueryHistory({
        originalQuestion: 'step15-test students question',
        normalizedQuestion: 'step15-test students question',
        structuredQuery: {
          collectionName: 'students',
          operation: 'find',
          filter: {},
        },
        collectionName: 'students',
        operation: 'find',
      });
      const saved = await record.save();
      if (!saved || saved.collectionName !== 'students') {
        throw new Error('Failed to save QueryHistory record for students');
      }
    });

    await asyncTest('QueryHistory courses record accepted', async () => {
      const record = new QueryHistory({
        originalQuestion: 'step15-test courses question',
        normalizedQuestion: 'step15-test courses question',
        structuredQuery: {
          collectionName: 'courses',
          operation: 'find',
          filter: { credits: 4 },
        },
        collectionName: 'courses',
        operation: 'find',
      });
      const saved = await record.save();
      if (!saved || saved.collectionName !== 'courses') {
        throw new Error('Failed to save QueryHistory record for courses');
      }
    });

    await asyncTest('QueryHistory unknown collection rejected', async () => {
      const record = new QueryHistory({
        originalQuestion: 'step15-test invalid collection question',
        normalizedQuestion: 'step15-test invalid collection question',
        structuredQuery: {
          collectionName: 'unauthorized_collection',
          operation: 'find',
          filter: {},
        },
        collectionName: 'unauthorized_collection',
        operation: 'find',
      });

      let threw = false;
      try {
        await record.save();
      } catch (err) {
        threw = true;
      }
      if (!threw) {
        throw new Error('QueryHistory should reject unauthorized collectionName');
      }
    });

    // ========================================================================
    // 2. COLLECTION CAPABILITIES TESTS
    // ========================================================================
    console.log('\n--- 2. Collection Capabilities Synchronization ---');

    test('collectionCapabilities includes courses as executable', isCollectionExecutable('courses'));
    test('collectionCapabilities includes students as executable', isCollectionExecutable('students'));
    test('collectionCapabilities rejects unknown collection as executable', !isCollectionExecutable('unknown_collection'));
    test('collectionCapabilities includes courses as queryable', isCollectionQueryable('courses'));
    test('getExecutableCollections contains both students and courses',
      getExecutableCollections().includes('students') && getExecutableCollections().includes('courses')
    );

    await asyncTest('getCollectionCapabilities returns valid structure for courses', async () => {
      const capabilities = await getCollectionCapabilities();
      if (!capabilities.courses) {
        throw new Error('courses collection missing from capabilities');
      }
      if (!capabilities.courses.executable || !capabilities.courses.hasModel) {
        throw new Error('courses collection should be marked executable with model');
      }
    });

    // ========================================================================
    // 3. API STRUCTURED QUERY EXECUTION TESTS
    // ========================================================================
    console.log('\n--- 3. API Structured Query Execution (/api/query/execute) ---');

    await asyncTest('courses find execution through API', async () => {
      const req = mockReq({
        query: {
          collectionName: 'courses',
          operation: 'find',
          filter: {},
        },
      });
      const res = mockRes();

      await executeStructuredQuery(req, res);

      if (!res.jsonData || !res.jsonData.success) {
        throw new Error(`Execution failed: ${res.jsonData?.error}`);
      }
      if (res.jsonData.collectionName !== 'courses') {
        throw new Error(`Expected collectionName courses, got ${res.jsonData.collectionName}`);
      }
      if (!Array.isArray(res.jsonData.data) || typeof res.jsonData.count !== 'number') {
        throw new Error('Expected data to be an array and count to be a number');
      }
    });

    await asyncTest('courses count execution through API', async () => {
      const req = mockReq({
        query: {
          collectionName: 'courses',
          operation: 'count',
          filter: { credits: 4 },
        },
      });
      const res = mockRes();

      await executeStructuredQuery(req, res);

      if (!res.jsonData || !res.jsonData.success) {
        throw new Error(`Count execution failed: ${res.jsonData?.error}`);
      }
      if (typeof res.jsonData.data !== 'number') {
        throw new Error(`Expected number count, got ${typeof res.jsonData.data}`);
      }
    });

    // ========================================================================
    // 4. API NATURAL LANGUAGE ASKING & CACHING LIFECYCLE TESTS
    // ========================================================================
    console.log('\n--- 4. API Natural Language & Caching Lifecycle (/api/query/ask) ---');

    const courseTestQuestion = 'step15-test show courses with 4 credits';

    await asyncTest('course /api/query/ask cache miss', async () => {
      const req = mockReq({ question: courseTestQuestion });
      const res = mockRes();

      await askQuestion(req, res);

      if (!res.jsonData || !res.jsonData.success) {
        throw new Error(`Ask failed: ${res.jsonData?.error}`);
      }
      if (res.jsonData.cacheHit !== false) {
        throw new Error('Expected cacheHit: false on first ask');
      }
      if (res.jsonData.query?.collectionName !== 'courses') {
        throw new Error(`Expected query.collectionName to be courses, got ${res.jsonData.query?.collectionName}`);
      }
      if (!Array.isArray(res.jsonData.result?.data)) {
        throw new Error('Expected result.data array');
      }
    });

    await asyncTest('successful cache storage', async () => {
      const stored = await QueryHistory.findByNormalizedQuestion(courseTestQuestion);
      if (!stored) {
        throw new Error('Course query was not stored in QueryHistory cache');
      }
      if (stored.collectionName !== 'courses') {
        throw new Error(`Expected stored collectionName courses, got ${stored.collectionName}`);
      }
    });

    await asyncTest('repeated course question produces cache hit', async () => {
      const req = mockReq({ question: courseTestQuestion });
      const res = mockRes();

      await askQuestion(req, res);

      if (!res.jsonData || !res.jsonData.success) {
        throw new Error(`Repeated ask failed: ${res.jsonData?.error}`);
      }
      if (res.jsonData.cacheHit !== true) {
        throw new Error('Expected cacheHit: true on repeated question');
      }
      if (res.jsonData.query?.collectionName !== 'courses') {
        throw new Error('Expected cached query to have collectionName courses');
      }
      if (!Array.isArray(res.jsonData.result?.data)) {
        throw new Error('Expected cached execution data array');
      }
    });

    // ========================================================================
    // 5. QUERY HISTORY & STATS TESTS
    // ========================================================================
    console.log('\n--- 5. Query History & Stats Endpoints ---');

    await asyncTest('history/stats include course queries', async () => {
      const reqHistory = mockReq({}, { limit: 10 });
      const resHistory = mockRes();
      await getQueryHistory(reqHistory, resHistory);

      if (!resHistory.jsonData || !resHistory.jsonData.success) {
        throw new Error('Failed to fetch query history');
      }

      const hasCourseQuery = resHistory.jsonData.queries.some(
        (q) => q.collectionName === 'courses'
      );
      if (!hasCourseQuery) {
        throw new Error('Query history does not contain course queries');
      }

      const reqStats = mockReq();
      const resStats = mockRes();
      await getQueryStats(reqStats, resStats);

      if (!resStats.jsonData || !resStats.jsonData.success) {
        throw new Error('Failed to fetch query stats');
      }
      if (resStats.jsonData.stats.totalQueries < 1) {
        throw new Error('Total queries in stats should be >= 1');
      }
    });

    // ========================================================================
    // 6. REGRESSION & STUDENTS BEHAVIOR TESTS
    // ========================================================================
    console.log('\n--- 6. Regression: Students Pipeline Unchanged ---');

    const studentTestQuestion = 'step15-test show cs students';

    await asyncTest('students behavior remains unchanged', async () => {
      // Miss path
      const req1 = mockReq({ question: studentTestQuestion });
      const res1 = mockRes();
      await askQuestion(req1, res1);

      if (!res1.jsonData || !res1.jsonData.success || res1.jsonData.cacheHit !== false) {
        throw new Error('Student query initial ask failed');
      }
      if (res1.jsonData.query?.collectionName !== 'students') {
        throw new Error('Expected collectionName students');
      }

      // Hit path
      const req2 = mockReq({ question: studentTestQuestion });
      const res2 = mockRes();
      await askQuestion(req2, res2);

      if (!res2.jsonData || !res2.jsonData.success || res2.jsonData.cacheHit !== true) {
        throw new Error('Student query cache hit failed');
      }
    });

    // ========================================================================
    // 7. SECURITY BOUNDARIES TESTS
    // ========================================================================
    console.log('\n--- 7. Security Boundaries Validation ---');

    await asyncTest('write operations remain rejected', async () => {
      const insertQuery = {
        collectionName: 'courses',
        operation: 'insert',
        filter: {},
      };
      const result = validateQuery(insertQuery);
      if (result.valid) {
        throw new Error('Validator must reject write operation (insert)');
      }

      const deleteQuery = {
        collectionName: 'students',
        operation: 'delete',
        filter: {},
      };
      const result2 = validateQuery(deleteQuery);
      if (result2.valid) {
        throw new Error('Validator must reject write operation (delete)');
      }
    });

    await asyncTest('dangerous operators remain rejected', async () => {
      const whereQuery = {
        collectionName: 'courses',
        operation: 'find',
        filter: {
          $where: 'this.credits > 3',
        },
      };
      const result = validateQuery(whereQuery);
      if (result.valid) {
        throw new Error('Validator must reject $where operator');
      }

      const functionQuery = {
        collectionName: 'students',
        operation: 'find',
        filter: {
          $function: { body: 'function() { return true; }' },
        },
      };
      const result2 = validateQuery(functionQuery);
      if (result2.valid) {
        throw new Error('Validator must reject $function operator');
      }
    });

    // Clean up test records
    await QueryHistory.deleteMany({
      originalQuestion: { $regex: 'step15-test' },
    });

    console.log(`\n${'='.repeat(50)}`);
    console.log(`RESULTS: ${passed}/${passed + failed} tests passed`);
    if (failed === 0) {
      console.log('✅ ALL STEP 15 INTEGRATION TESTS PASSED!');
    } else {
      console.log(`❌ ${failed} test(s) failed`);
    }
    console.log('='.repeat(50));
  } catch (error) {
    console.error('Fatal test error:', error);
    failed++;
  } finally {
    try {
      await mongoose.disconnect();
    } catch (e) {
      // ignore
    }
    process.exit(failed === 0 ? 0 : 1);
  }
}

main();
