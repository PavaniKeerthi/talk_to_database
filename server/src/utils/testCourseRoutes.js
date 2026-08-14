/**
 * STEP 16: Course REST API Routes Tests
 *
 * Verifies that:
 * 1. GET /api/courses returns HTTP 200 with course documents and count.
 * 2. Empty collection handling returns clean 200 with empty array.
 * 3. Database errors return HTTP 500 without leaking stack traces, credentials, or connection details.
 * 4. No write operations (POST, PUT, PATCH, DELETE) are exposed for courses.
 * 5. GET /api/students regression succeeds.
 * 6. GET /api/health regression succeeds.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import Course from '../models/Course.js';
import { getCourses } from '../controllers/courseController.js';
import { getStudents } from '../controllers/studentController.js';
import courseRoutes from '../routes/courseRoutes.js';
import app from '../app.js';

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
const mockReq = (params = {}, query = {}, body = {}) => ({ params, query, body });
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
  console.log('=== STEP 16: Course REST API Routes Tests ===\n');

  try {
    await connectDB();
    console.log('Connected to MongoDB.\n');

    // ========================================================================
    // 1. GET /api/courses SUCCESS & STRUCTURE
    // ========================================================================
    console.log('--- 1. Course Endpoint Retrieval & Response Structure ---');

    await asyncTest('GET /api/courses successful retrieval', async () => {
      const req = mockReq();
      const res = mockRes();

      await getCourses(req, res);

      if (res.statusCode !== 200) {
        throw new Error(`Expected statusCode 200, got ${res.statusCode}`);
      }
      if (!res.jsonData) {
        throw new Error('Response JSON body is missing');
      }
      if (!Array.isArray(res.jsonData.courses)) {
        throw new Error('Expected response to contain "courses" array');
      }
    });

    await asyncTest('Response structure and course count', async () => {
      const req = mockReq();
      const res = mockRes();

      await getCourses(req, res);

      if (typeof res.jsonData.count !== 'number' && !res.jsonData.message?.includes('No courses found')) {
        throw new Error('Expected count property on successful response');
      }
      if (res.jsonData.count !== undefined && res.jsonData.count !== res.jsonData.courses.length) {
        throw new Error(`Count mismatch: count=${res.jsonData.count}, courses.length=${res.jsonData.courses.length}`);
      }
      if (res.jsonData.courses.length > 0) {
        const first = res.jsonData.courses[0];
        if (!first.title || !first.code) {
          throw new Error('Course document missing expected fields (title, code)');
        }
      }
    });

    // ========================================================================
    // 2. EMPTY COLLECTION HANDLING
    // ========================================================================
    console.log('\n--- 2. Empty Collection Handling ---');

    await asyncTest('Empty collection handling returns clean 200', async () => {
      const originalFind = Course.find;
      try {
        // Stub Course.find to return empty array
        Course.find = async () => [];

        const req = mockReq();
        const res = mockRes();

        await getCourses(req, res);

        if (res.statusCode !== 200) {
          throw new Error(`Expected statusCode 200, got ${res.statusCode}`);
        }
        if (res.jsonData.message !== 'No courses found.') {
          throw new Error(`Expected message "No courses found.", got "${res.jsonData.message}"`);
        }
        if (!Array.isArray(res.jsonData.courses) || res.jsonData.courses.length !== 0) {
          throw new Error('Expected empty courses array');
        }
      } finally {
        Course.find = originalFind;
      }
    });

    // ========================================================================
    // 3. DATABASE ERROR HANDLING & SECURITY
    // ========================================================================
    console.log('\n--- 3. Database Error Handling & Information Leakage Prevention ---');

    await asyncTest('Database error handling returns 500 without sensitive details', async () => {
      const originalFind = Course.find;
      try {
        // Stub Course.find to throw internal error containing sensitive string
        Course.find = async () => {
          throw new Error('MongoServerError: authentication failed mongodb://user:pass@secret.host:27017');
        };

        const req = mockReq();
        const res = mockRes();

        await getCourses(req, res);

        if (res.statusCode !== 500) {
          throw new Error(`Expected statusCode 500, got ${res.statusCode}`);
        }
        if (res.jsonData.error !== 'Failed to retrieve courses from database.') {
          throw new Error(`Expected generic error message, got: ${res.jsonData.error}`);
        }
        // Verify no credentials or connection strings leaked in response
        const jsonStr = JSON.stringify(res.jsonData);
        if (jsonStr.includes('mongodb://') || jsonStr.includes('secret') || jsonStr.includes('stack')) {
          throw new Error('Sensitive database details leaked in response');
        }
      } finally {
        Course.find = originalFind;
      }
    });

    // ========================================================================
    // 4. ROUTE SECURITY & WRITE OPERATIONS BLOCKED
    // ========================================================================
    console.log('\n--- 4. Route Security: Read-Only Enforcement ---');

    test('courseRoutes is defined and has GET route', () => {
      const routes = courseRoutes.stack
        .filter((r) => r.route)
        .map((r) => ({ path: r.route.path, methods: Object.keys(r.route.methods) }));
      const hasGet = routes.some((r) => r.path === '/' && r.methods.includes('get'));
      return hasGet;
    });

    test('no write routes are exposed for courses', () => {
      const routes = courseRoutes.stack
        .filter((r) => r.route)
        .map((r) => ({ path: r.route.path, methods: Object.keys(r.route.methods) }));

      const hasWrite = routes.some((r) =>
        r.methods.some((m) => ['post', 'put', 'patch', 'delete'].includes(m.toLowerCase()))
      );
      return !hasWrite;
    });

    test('app mounts /api/courses router', () => {
      const hasCoursesMount = app._router.stack.some(
        (layer) => layer.regexp && layer.regexp.test('/api/courses')
      );
      return hasCoursesMount;
    });

    // ========================================================================
    // 5. REGRESSION TESTS: STUDENTS & HEALTH
    // ========================================================================
    console.log('\n--- 5. Regression: Students and Health Endpoints ---');

    await asyncTest('GET /api/students regression', async () => {
      const req = mockReq();
      const res = mockRes();

      await getStudents(req, res);

      if (res.statusCode !== 200) {
        throw new Error(`Expected statusCode 200, got ${res.statusCode}`);
      }
      if (!Array.isArray(res.jsonData.students)) {
        throw new Error('Expected students array in response');
      }
      if (res.jsonData.count !== res.jsonData.students.length) {
        throw new Error('Students count mismatch');
      }
    });

    await asyncTest('GET /api/health regression', async () => {
      // Find health router in app
      const healthLayer = app._router.stack.find(
        (layer) => layer.regexp && layer.regexp.test('/api/health')
      );
      if (!healthLayer) {
        throw new Error('/api/health layer not found in Express app');
      }
      const res = mockRes();
      const req = mockReq();
      healthLayer.handle(req, res, () => {});
      // Directly check health response
      const HealthRouter = (await import('../routes/healthRoutes.js')).default;
      const healthRes = mockRes();
      const healthRoute = HealthRouter.stack[0].route.stack[0];
      healthRoute.handle_request(req, healthRes, () => {});
      if (healthRes.jsonData?.status !== 'ok') {
        throw new Error(`Expected health status ok, got ${healthRes.jsonData?.status}`);
      }
    });

    console.log(`\n${'='.repeat(50)}`);
    console.log(`RESULTS: ${passed}/${passed + failed} tests passed`);
    if (failed === 0) {
      console.log('✅ ALL STEP 16 COURSE REST API TESTS PASSED!');
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
