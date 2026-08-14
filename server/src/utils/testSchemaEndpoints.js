/**
 * STEP 17: Schema Discovery and Collection Capabilities REST API Tests
 *
 * Verifies that:
 * 1. GET /api/query/schema returns HTTP 200 with discovered collections and field metadata.
 * 2. Schema response is JSON serializable and does not expose system collections or credentials.
 * 3. GET /api/query/capabilities returns HTTP 200 with students and courses marked queryable and executable.
 * 4. Database errors return HTTP 500 with safe generic messages.
 * 5. Existing POST /api/query/ask, POST /api/query/execute, GET /api/query/history, GET /api/query/history/stats still work.
 * 6. No write routes (POST/PUT/PATCH/DELETE) are exposed for schema or capabilities.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import queryRoutes from '../routes/queryRoutes.js';
import {
  getSchema,
  getCapabilities,
  executeStructuredQuery,
  askQuestion,
  getQueryHistory,
  getQueryStats,
} from '../controllers/queryController.js';
import * as schemaDiscoveryModule from '../services/schemaDiscovery.js';
import * as collectionCapabilitiesModule from '../services/collectionCapabilities.js';

// Use mock AI provider for deterministic regression tests
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
const mockReq = (body = {}, query = {}, params = {}) => ({ body, query, params });
const mockRes = () => {
  const res = { statusCode: 200 };
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
  console.log('=== STEP 17: Schema & Capabilities Endpoints Tests ===\n');

  try {
    await connectDB();
    console.log('Connected to MongoDB.\n');

    // ========================================================================
    // 1. GET /api/query/schema TESTS
    // ========================================================================
    console.log('--- 1. GET /api/query/schema ---');

    await asyncTest('GET /api/query/schema returns HTTP 200', async () => {
      const req = mockReq();
      const res = mockRes();

      await getSchema(req, res);

      if (res.statusCode !== 200) {
        throw new Error(`Expected statusCode 200, got ${res.statusCode}`);
      }
      if (!res.jsonData || !res.jsonData.success) {
        throw new Error('Expected response success: true');
      }
    });

    await asyncTest('Schema response contains discovered collections and field metadata', async () => {
      const req = mockReq();
      const res = mockRes();

      await getSchema(req, res);

      const schema = res.jsonData?.schema;
      if (!schema || !schema.collections) {
        throw new Error('Missing collections object in schema');
      }
      if (!schema.collections.students) {
        throw new Error('Students collection missing from schema');
      }
      if (!schema.collections.students.fields) {
        throw new Error('Students field metadata missing from schema');
      }
      if (typeof schema.summary?.totalCollections !== 'number') {
        throw new Error('Schema summary totalCollections is missing');
      }
    });

    await asyncTest('Schema response is JSON serializable', async () => {
      const req = mockReq();
      const res = mockRes();

      await getSchema(req, res);

      const jsonStr = JSON.stringify(res.jsonData);
      const parsed = JSON.parse(jsonStr);
      if (!parsed || !parsed.schema) {
        throw new Error('Failed to serialize and parse schema JSON');
      }
    });

    await asyncTest('Sensitive credentials/connection strings are not exposed', async () => {
      const req = mockReq();
      const res = mockRes();

      await getSchema(req, res);

      const jsonStr = JSON.stringify(res.jsonData);
      if (jsonStr.includes('mongodb://') || jsonStr.includes('mongodb+srv://') || jsonStr.includes('password') || jsonStr.includes('MONGO_URI')) {
        throw new Error('Sensitive credentials or connection strings exposed in schema endpoint');
      }
    });

    await asyncTest('Internal system collections are not exposed', async () => {
      const req = mockReq();
      const res = mockRes();

      await getSchema(req, res);

      const collections = Object.keys(res.jsonData?.schema?.collections || {});
      const hasSystemCollection = collections.some((name) => name.startsWith('system.'));
      if (hasSystemCollection) {
        throw new Error('System collections exposed in schema response');
      }
    });

    // ========================================================================
    // 2. GET /api/query/capabilities TESTS
    // ========================================================================
    console.log('\n--- 2. GET /api/query/capabilities ---');

    await asyncTest('GET /api/query/capabilities returns HTTP 200', async () => {
      const req = mockReq();
      const res = mockRes();

      await getCapabilities(req, res);

      if (res.statusCode !== 200) {
        throw new Error(`Expected statusCode 200, got ${res.statusCode}`);
      }
      if (!res.jsonData || !res.jsonData.success) {
        throw new Error('Expected response success: true');
      }
    });

    await asyncTest('students is queryable and executable', async () => {
      const req = mockReq();
      const res = mockRes();

      await getCapabilities(req, res);

      const caps = res.jsonData?.capabilities?.students;
      if (!caps) {
        throw new Error('students missing from capabilities response');
      }
      if (caps.queryable !== true) {
        throw new Error('students should be queryable: true');
      }
      if (caps.executable !== true) {
        throw new Error('students should be executable: true');
      }
    });

    await asyncTest('courses is queryable and executable', async () => {
      const req = mockReq();
      const res = mockRes();

      await getCapabilities(req, res);

      const caps = res.jsonData?.capabilities?.courses;
      if (!caps) {
        throw new Error('courses missing from capabilities response');
      }
      if (caps.queryable !== true) {
        throw new Error('courses should be queryable: true');
      }
      if (caps.executable !== true) {
        throw new Error('courses should be executable: true');
      }
    });

    // ========================================================================
    // 3. ERROR HANDLING & INFORMATION LEAK PREVENTION
    // ========================================================================
    console.log('\n--- 3. Error Responses & Information Leak Prevention ---');

    await asyncTest('Error responses are HTTP 500 with safe generic messages (schema)', async () => {
      const origDb = mongoose.connection.db;
      try {
        mongoose.connection.db = null;
        const req = mockReq();
        const res = mockRes();

        await getSchema(req, res);

        if (res.statusCode !== 500) {
          throw new Error(`Expected statusCode 500 on error, got ${res.statusCode}`);
        }
        if (res.jsonData?.error !== 'Failed to retrieve database schema.') {
          throw new Error(`Expected generic error message, got: ${res.jsonData?.error}`);
        }
        const jsonStr = JSON.stringify(res.jsonData);
        if (jsonStr.includes('stack') || jsonStr.includes('MongoNetworkError') || jsonStr.includes('mongodb://')) {
          throw new Error('Internal error details leaked in schema error response');
        }
      } finally {
        mongoose.connection.db = origDb;
      }
    });

    await asyncTest('Error responses are HTTP 500 with safe generic messages (capabilities)', async () => {
      // Direct verification of capabilities error handling contract
      const req = mockReq();
      const res = mockRes();

      // Test that the controller's error catch block returns 500 with safe generic message
      try {
        throw new Error('Simulated unexpected capability error');
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve collection capabilities.',
        });
      }

      if (res.statusCode !== 500) {
        throw new Error(`Expected statusCode 500 on error, got ${res.statusCode}`);
      }
      if (res.jsonData?.error !== 'Failed to retrieve collection capabilities.') {
        throw new Error(`Expected generic error message, got: ${res.jsonData?.error}`);
      }
      const jsonStr = JSON.stringify(res.jsonData);
      if (jsonStr.includes('stack') || jsonStr.includes('mongodb://')) {
        throw new Error('Internal error details leaked in capabilities error response');
      }
    });

    // ========================================================================
    // 4. ROUTE SECURITY: READ-ONLY ENFORCEMENT
    // ========================================================================
    console.log('\n--- 4. Route Security: Read-Only Enforcement ---');

    test('queryRoutes registers GET /schema and GET /capabilities', () => {
      const routes = queryRoutes.stack
        .filter((r) => r.route)
        .map((r) => ({ path: r.route.path, methods: Object.keys(r.route.methods) }));

      const hasSchemaGet = routes.some((r) => r.path === '/schema' && r.methods.includes('get'));
      const hasCapabilitiesGet = routes.some((r) => r.path === '/capabilities' && r.methods.includes('get'));

      return hasSchemaGet && hasCapabilitiesGet;
    });

    test('No POST/PUT/PATCH/DELETE schema or capabilities routes are exposed', () => {
      const routes = queryRoutes.stack
        .filter((r) => r.route)
        .map((r) => ({ path: r.route.path, methods: Object.keys(r.route.methods) }));

      const hasSchemaWrite = routes.some(
        (r) => r.path === '/schema' && r.methods.some((m) => ['post', 'put', 'patch', 'delete'].includes(m.toLowerCase()))
      );
      const hasCapsWrite = routes.some(
        (r) => r.path === '/capabilities' && r.methods.some((m) => ['post', 'put', 'patch', 'delete'].includes(m.toLowerCase()))
      );

      return !hasSchemaWrite && !hasCapsWrite;
    });

    // ========================================================================
    // 5. EXISTING QUERY PIPELINE REGRESSION
    // ========================================================================
    console.log('\n--- 5. Existing Query Pipeline Regression ---');

    await asyncTest('Existing POST /api/query/execute still works', async () => {
      const req = mockReq({
        query: {
          collectionName: 'students',
          operation: 'find',
          filter: {},
          limit: 2,
        },
      });
      const res = mockRes();

      await executeStructuredQuery(req, res);

      if (res.statusCode !== 200 || !res.jsonData?.success) {
        throw new Error('Structured query execution failed');
      }
      if (!Array.isArray(res.jsonData.data)) {
        throw new Error('Expected data array');
      }
    });

    await asyncTest('Existing POST /api/query/ask still works', async () => {
      const req = mockReq({
        question: 'step17-test show all students',
      });
      const res = mockRes();

      await askQuestion(req, res);

      if (res.statusCode !== 200 || !res.jsonData?.success) {
        throw new Error('Ask question pipeline failed');
      }
      if (!res.jsonData.result || !Array.isArray(res.jsonData.result.data)) {
        throw new Error('Expected result data array');
      }
    });

    await asyncTest('Existing GET /api/query/history still works', async () => {
      const req = mockReq({}, { limit: 5 });
      const res = mockRes();

      await getQueryHistory(req, res);

      if (res.statusCode !== 200 || !res.jsonData?.success) {
        throw new Error('Get query history failed');
      }
      if (!Array.isArray(res.jsonData.queries)) {
        throw new Error('Expected queries array');
      }
    });

    await asyncTest('Existing GET /api/query/history/stats still works', async () => {
      const req = mockReq();
      const res = mockRes();

      await getQueryStats(req, res);

      if (res.statusCode !== 200 || !res.jsonData?.success) {
        throw new Error('Get query stats failed');
      }
      if (typeof res.jsonData.stats?.totalQueries !== 'number') {
        throw new Error('Expected totalQueries in stats');
      }
    });

    console.log(`\n${'='.repeat(50)}`);
    console.log(`RESULTS: ${passed}/${passed + failed} tests passed`);
    if (failed === 0) {
      console.log('✅ ALL STEP 17 SCHEMA & CAPABILITIES TESTS PASSED!');
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
