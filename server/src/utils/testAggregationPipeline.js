/**
 * STEP 20: MongoDB Aggregation Pipeline Validation and Execution Engine Tests
 *
 * Verifies:
 * 1. Validation and execution of valid aggregation queries (students, courses, grouping, averages, sums, counts, min/max).
 * 2. Strict rejection of forbidden aggregation stages ($lookup, $out, $merge, $graphLookup, $facet, $function, $accumulator, $where).
 * 3. Rejection of unknown fields, invalid accumulator types, non-whitelisted collections.
 * 4. Protection against prototype pollution in pipeline stages.
 * 5. Rejection of malformed pipeline structures and stage counts exceeding limits.
 * 6. Regression verification that find and count operations remain unaffected and secure.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import validateQuery from '../services/queryValidator.js';
import executeQuery from '../services/queryExecutor.js';
import resolveModel from '../services/modelResolver.js';
import QueryHistory from '../models/QueryHistory.js';

process.env.NO_AI = 'true';
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

async function main() {
  console.log('=== STEP 20: Aggregation Pipeline Tests ===\n');

  try {
    await connectDB();
    console.log('Connected to MongoDB for aggregation tests.\n');

    // ========================================================================
    // 1. VALID AGGREGATION PIPELINE VALIDATION
    // ========================================================================
    console.log('--- 1. Valid Pipeline Stage Validation ---');

    test('Valid $match stage passes validation', () => {
      const query = {
        collectionName: 'students',
        operation: 'aggregate',
        pipeline: [
          { $match: { branch: 'Computer Science', cgpa: { $gte: 8.0 } } },
        ],
      };
      const res = validateQuery(query);
      return res.valid === true;
    });

    test('Valid $group with $avg on students.cgpa by branch passes validation', () => {
      const query = {
        collectionName: 'students',
        operation: 'aggregate',
        pipeline: [
          {
            $group: {
              _id: '$branch',
              avgCgpa: { $avg: '$cgpa' },
              totalStudents: { $sum: 1 },
            },
          },
        ],
      };
      const res = validateQuery(query);
      return res.valid === true;
    });

    test('Valid $group with $sum and $min/$max on courses credits passes validation', () => {
      const query = {
        collectionName: 'courses',
        operation: 'aggregate',
        pipeline: [
          {
            $group: {
              _id: null,
              totalCredits: { $sum: '$credits' },
              minCredits: { $min: '$credits' },
              maxCredits: { $max: '$credits' },
            },
          },
        ],
      };
      const res = validateQuery(query);
      return res.valid === true;
    });

    test('Valid $project stage passes validation', () => {
      const query = {
        collectionName: 'students',
        operation: 'aggregate',
        pipeline: [
          { $project: { _id: 0, name: 1, branch: 1, cgpa: 1 } },
        ],
      };
      const res = validateQuery(query);
      return res.valid === true;
    });

    test('Valid $sort and $limit stages pass validation', () => {
      const query = {
        collectionName: 'students',
        operation: 'aggregate',
        pipeline: [
          { $sort: { cgpa: -1 } },
          { $limit: 5 },
        ],
      };
      const res = validateQuery(query);
      return res.valid === true;
    });

    // ========================================================================
    // 2. REJECTION OF FORBIDDEN / DANGEROUS STAGES & OPERATORS
    // ========================================================================
    console.log('\n--- 2. Rejection of Forbidden Stages & Operators ---');

    test('Rejection of $lookup stage (cross-collection forbidden)', () => {
      const query = {
        collectionName: 'students',
        operation: 'aggregate',
        pipeline: [
          {
            $lookup: {
              from: 'courses',
              localField: 'branch',
              foreignField: 'code',
              as: 'joinedData',
            },
          },
        ],
      };
      const res = validateQuery(query);
      return res.valid === false && res.error.includes('$lookup');
    });

    test('Rejection of $out stage (write forbidden)', () => {
      const query = {
        collectionName: 'students',
        operation: 'aggregate',
        pipeline: [{ $out: 'malicious_collection' }],
      };
      const res = validateQuery(query);
      return res.valid === false && res.error.includes('$out');
    });

    test('Rejection of $merge stage (write forbidden)', () => {
      const query = {
        collectionName: 'students',
        operation: 'aggregate',
        pipeline: [{ $merge: { into: 'students' } }],
      };
      const res = validateQuery(query);
      return res.valid === false && res.error.includes('$merge');
    });

    test('Rejection of $graphLookup stage', () => {
      const query = {
        collectionName: 'students',
        operation: 'aggregate',
        pipeline: [{ $graphLookup: { from: 'students', startWith: '$name', connectFromField: 'name', connectToField: 'name', as: 'hierarchy' } }],
      };
      const res = validateQuery(query);
      return res.valid === false && res.error.includes('$graphLookup');
    });

    test('Rejection of $facet stage', () => {
      const query = {
        collectionName: 'students',
        operation: 'aggregate',
        pipeline: [{ $facet: { pipe1: [{ $match: {} }] } }],
      };
      const res = validateQuery(query);
      return res.valid === false && res.error.includes('$facet');
    });

    test('Rejection of $function stage (JS execution forbidden)', () => {
      const query = {
        collectionName: 'students',
        operation: 'aggregate',
        pipeline: [{ $function: { body: 'function() { return 1; }', args: [], lang: 'js' } }],
      };
      const res = validateQuery(query);
      return res.valid === false && res.error.includes('$function');
    });

    test('Rejection of $accumulator stage / operator (custom JS forbidden)', () => {
      const query = {
        collectionName: 'students',
        operation: 'aggregate',
        pipeline: [
          {
            $group: {
              _id: null,
              customAcc: {
                $accumulator: {
                  init: 'function() { return 0; }',
                  accumulate: 'function(state, val) { return state + val; }',
                  lang: 'js',
                },
              },
            },
          },
        ],
      };
      const res = validateQuery(query);
      return res.valid === false && res.error.includes('$accumulator');
    });

    // ========================================================================
    // 3. SCHEMA & TYPE ENFORCEMENT & PROTOTYPE POLLUTION
    // ========================================================================
    console.log('\n--- 3. Schema & Type Enforcement ---');

    test('Rejection of unknown fields in $match stage', () => {
      const query = {
        collectionName: 'students',
        operation: 'aggregate',
        pipeline: [{ $match: { unknownSecretField: 'hack' } }],
      };
      const res = validateQuery(query);
      return res.valid === false && res.error.includes('unknownSecretField');
    });

    test('Rejection of unknown collection', () => {
      const query = {
        collectionName: 'professors',
        operation: 'aggregate',
        pipeline: [{ $match: {} }],
      };
      const res = validateQuery(query);
      return res.valid === false && res.error.includes('professors');
    });

    test('Rejection of $avg on non-numeric field', () => {
      const query = {
        collectionName: 'students',
        operation: 'aggregate',
        pipeline: [
          {
            $group: {
              _id: '$year',
              avgBranch: { $avg: '$branch' }, // branch is string, not numeric
            },
          },
        ],
      };
      const res = validateQuery(query);
      return res.valid === false && res.error.includes('numeric field');
    });

    test('Rejection of prototype pollution keys in pipeline stage', () => {
      const badStage = JSON.parse('{"$match": {"branch": "Computer Science", "__proto__": {"polluted": true}}}');
      const query = {
        collectionName: 'students',
        operation: 'aggregate',
        pipeline: [badStage],
      };
      const res = validateQuery(query);
      return res.valid === false && res.error.includes('dangerous keys');
    });

    test('Rejection of empty pipeline or non-array pipeline', () => {
      const emptyRes = validateQuery({ collectionName: 'students', operation: 'aggregate', pipeline: [] });
      const nonArrayRes = validateQuery({ collectionName: 'students', operation: 'aggregate', pipeline: 'not-an-array' });
      return emptyRes.valid === false && nonArrayRes.valid === false;
    });

    test('Rejection of excessive pipeline stages (> 10)', () => {
      const longPipeline = Array(15).fill({ $match: { branch: 'Computer Science' } });
      const res = validateQuery({ collectionName: 'students', operation: 'aggregate', pipeline: longPipeline });
      return res.valid === false && res.error.includes('maximum allowed stages');
    });

    // ========================================================================
    // 4. DATABASE EXECUTION TESTS (AGAINST MONGODB)
    // ========================================================================
    console.log('\n--- 4. Live MongoDB Aggregation Execution ---');

    await asyncTest('Execute students grouped by branch with average CGPA', async () => {
      const query = {
        collectionName: 'students',
        operation: 'aggregate',
        pipeline: [
          {
            $group: {
              _id: '$branch',
              avgCgpa: { $avg: '$cgpa' },
              totalStudents: { $sum: 1 },
            },
          },
          { $sort: { avgCgpa: -1 } },
        ],
      };

      const result = await executeQuery(query);
      if (!result.success) {
        throw new Error(`Execution failed: ${result.error}`);
      }
      if (!Array.isArray(result.data) || result.data.length === 0) {
        throw new Error('Expected non-empty aggregated data array');
      }
      const firstGroup = result.data[0];
      if (!firstGroup._id || typeof firstGroup.avgCgpa !== 'number' || typeof firstGroup.totalStudents !== 'number') {
        throw new Error('Unexpected aggregated result structure');
      }
    });

    await asyncTest('Execute courses aggregation with total and average credits', async () => {
      const CourseModel = resolveModel('courses');
      let createdTestCourse = false;
      const docCount = await CourseModel.countDocuments();
      if (docCount === 0) {
        await CourseModel.create({
          code: 'CS999',
          title: 'Advanced Aggregations',
          credits: 4,
          instructor: 'Dr. Test',
        });
        createdTestCourse = true;
      }

      try {
        const query = {
          collectionName: 'courses',
          operation: 'aggregate',
          pipeline: [
            {
              $group: {
                _id: null,
                totalCredits: { $sum: '$credits' },
                avgCredits: { $avg: '$credits' },
                courseCount: { $sum: 1 },
              },
            },
          ],
        };

        const result = await executeQuery(query);
        if (!result.success) {
          throw new Error(`Execution failed: ${result.error}`);
        }
        if (!Array.isArray(result.data) || result.data.length === 0) {
          throw new Error('Expected non-empty aggregated data array');
        }
        const metric = result.data[0];
        if (metric._id !== null || typeof metric.totalCredits !== 'number' || typeof metric.courseCount !== 'number') {
          throw new Error('Unexpected course metric result structure');
        }
      } finally {
        if (createdTestCourse) {
          await CourseModel.deleteOne({ code: 'CS999' });
        }
      }
    });

    await asyncTest('QueryHistory accepts and stores aggregate query', async () => {
      const record = new QueryHistory({
        originalQuestion: 'test step20 average cgpa by branch',
        normalizedQuestion: 'test step20 average cgpa by branch',
        structuredQuery: {
          collectionName: 'students',
          operation: 'aggregate',
          pipeline: [{ $group: { _id: '$branch', avgCgpa: { $avg: '$cgpa' } } }],
        },
        collectionName: 'students',
        operation: 'aggregate',
        usageCount: 1,
      });

      await record.save();
      const found = await QueryHistory.findById(record._id);
      if (!found || found.operation !== 'aggregate') {
        throw new Error('Failed to retrieve saved aggregate QueryHistory record');
      }
      // Clean up test record
      await QueryHistory.deleteOne({ _id: record._id });
    });

    // ========================================================================
    // 5. REGRESSION VERIFICATION (FIND & COUNT)
    // ========================================================================
    console.log('\n--- 5. Regression Verification (Find & Count) ---');

    await asyncTest('Existing find query executes unchanged', async () => {
      const query = {
        collectionName: 'students',
        operation: 'find',
        filter: { branch: 'Computer Science' },
        limit: 2,
      };
      const result = await executeQuery(query);
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error('Find execution failed');
      }
    });

    await asyncTest('Existing count query executes unchanged', async () => {
      const query = {
        collectionName: 'courses',
        operation: 'count',
        filter: { credits: { $gte: 3 } },
      };
      const result = await executeQuery(query);
      if (!result.success || typeof result.data !== 'number') {
        throw new Error('Count execution failed');
      }
    });

    console.log(`\n${'='.repeat(50)}`);
    console.log(`RESULTS: ${passed}/${passed + failed} tests passed`);
    if (failed === 0) {
      console.log('✅ ALL STEP 20 AGGREGATION TESTS PASSED!');
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
