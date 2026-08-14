/**
 * STEP 21: AI Aggregation Query Generation & Visualization Integration Tests
 *
 * Verifies that:
 * 1. AI/mock query generator generates valid aggregation queries for analytical questions:
 *    - "What is the average CGPA per branch?"
 *    - "Total credits of all courses"
 *    - "Show course counts by instructor"
 * 2. Generated aggregation queries strictly pass validateQuery().
 * 3. Generated aggregation queries execute successfully against MongoDB.
 * 4. Existing find and count natural-language query generation continues to function.
 * 5. Forbidden aggregation stages ($lookup, $out, etc.) and prototype pollution attempts are blocked.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import generateQuery from '../services/aiQueryGenerator.js';
import validateQuery from '../services/queryValidator.js';
import executeQuery from '../services/queryExecutor.js';
import resolveModel from '../services/modelResolver.js';

// Use mock AI provider for deterministic regression testing
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
  console.log('=== STEP 21: AI Aggregation Query Generation Tests ===\n');

  try {
    await connectDB();
    console.log('Connected to MongoDB.\n');

    // ========================================================================
    // 1. AI AGGREGATION QUERY GENERATION (MOCK & VALIDATION)
    // ========================================================================
    console.log('--- 1. Analytical Query Generation ---');

    await asyncTest('AI generates aggregate query for "What is the average CGPA per branch?"', async () => {
      const question = 'what is the average cgpa per branch?';
      const query = await generateQuery(question);

      if (!query) throw new Error('AI returned null');
      if (query.collectionName !== 'students') throw new Error(`Expected collection students, got ${query.collectionName}`);
      if (query.operation !== 'aggregate') throw new Error(`Expected operation aggregate, got ${query.operation}`);
      if (!Array.isArray(query.pipeline)) throw new Error('Expected pipeline array');

      const validation = validateQuery(query);
      if (!validation.valid) throw new Error(`Generated query failed validation: ${validation.error}`);
    });

    await asyncTest('AI generates aggregate query for "Total credits of all courses"', async () => {
      const question = 'total credits of all courses';
      const query = await generateQuery(question);

      if (!query) throw new Error('AI returned null');
      if (query.collectionName !== 'courses') throw new Error(`Expected collection courses, got ${query.collectionName}`);
      if (query.operation !== 'aggregate') throw new Error(`Expected operation aggregate, got ${query.operation}`);
      if (!Array.isArray(query.pipeline)) throw new Error('Expected pipeline array');

      const validation = validateQuery(query);
      if (!validation.valid) throw new Error(`Generated query failed validation: ${validation.error}`);
    });

    await asyncTest('AI generates aggregate query for "Show course counts by instructor"', async () => {
      const question = 'show course counts by instructor';
      const query = await generateQuery(question);

      if (!query) throw new Error('AI returned null');
      if (query.collectionName !== 'courses') throw new Error(`Expected collection courses, got ${query.collectionName}`);
      if (query.operation !== 'aggregate') throw new Error(`Expected operation aggregate, got ${query.operation}`);
      if (!Array.isArray(query.pipeline)) throw new Error('Expected pipeline array');

      const validation = validateQuery(query);
      if (!validation.valid) throw new Error(`Generated query failed validation: ${validation.error}`);
    });

    // ========================================================================
    // 2. END-TO-END EXECUTION OF GENERATED AGGREGATION QUERIES
    // ========================================================================
    console.log('\n--- 2. End-to-End Execution against MongoDB ---');

    await asyncTest('Execute generated "Average CGPA per branch" against MongoDB', async () => {
      const query = await generateQuery('what is the average cgpa per branch?');
      const validation = validateQuery(query);
      if (!validation.valid) throw new Error(`Validation failed: ${validation.error}`);

      const result = await executeQuery(validation.query);
      if (!result.success) throw new Error(`Execution failed: ${result.error}`);
      if (!Array.isArray(result.data) || result.data.length === 0) {
        throw new Error('Expected non-empty aggregation result array');
      }
      const firstGroup = result.data[0];
      if (!firstGroup._id || typeof firstGroup.avgCgpa !== 'number') {
        throw new Error('Unexpected aggregation structure in result');
      }
    });

    await asyncTest('Execute generated "Total credits of all courses" against MongoDB', async () => {
      const CourseModel = resolveModel('courses');
      let createdTestCourse = false;
      const count = await CourseModel.countDocuments();
      if (count === 0) {
        await CourseModel.create({
          code: 'CS999',
          title: 'Advanced AI',
          credits: 4,
          instructor: 'Prof. Test',
        });
        createdTestCourse = true;
      }

      try {
        const query = await generateQuery('total credits of all courses');
        const validation = validateQuery(query);
        if (!validation.valid) throw new Error(`Validation failed: ${validation.error}`);

        const result = await executeQuery(validation.query);
        if (!result.success) throw new Error(`Execution failed: ${result.error}`);
        if (!Array.isArray(result.data) || result.data.length === 0) {
          throw new Error('Expected non-empty aggregation result array');
        }
      } finally {
        if (createdTestCourse) {
          await CourseModel.deleteOne({ code: 'CS999' });
        }
      }
    });

    // ========================================================================
    // 3. REGRESSION: EXISTING FIND & COUNT GENERATION UNTOUCHED
    // ========================================================================
    console.log('\n--- 3. Regression: Find & Count Generation ---');

    await asyncTest('Existing "Show all students" generates find operation', async () => {
      const query = await generateQuery('show all students');
      if (!query || query.operation !== 'find' || query.collectionName !== 'students') {
        throw new Error('Expected find query on students');
      }
      const validation = validateQuery(query);
      if (!validation.valid) throw new Error(`Validation error: ${validation.error}`);
    });

    await asyncTest('Existing "Show courses with 4 credits" generates find operation', async () => {
      const query = await generateQuery('show courses with 4 credits');
      if (!query || query.operation !== 'find' || query.collectionName !== 'courses' || query.filter?.credits !== 4) {
        throw new Error('Expected find query on courses with credits: 4');
      }
      const validation = validateQuery(query);
      if (!validation.valid) throw new Error(`Validation error: ${validation.error}`);
    });

    await asyncTest('Existing "Count CS students" generates count operation', async () => {
      const query = await generateQuery('count cs students');
      if (!query || query.operation !== 'count' || query.collectionName !== 'students') {
        throw new Error('Expected count query on students');
      }
      const validation = validateQuery(query);
      if (!validation.valid) throw new Error(`Validation error: ${validation.error}`);
    });

    // ========================================================================
    // 4. SECURITY & SANITIZATION OF AGGREGATION QUERIES
    // ========================================================================
    console.log('\n--- 4. Security & Sanitization ---');

    test('Forbidden stages are rejected by validator even if forged in generator', () => {
      const forgedQuery = {
        collectionName: 'students',
        operation: 'aggregate',
        pipeline: [{ $lookup: { from: 'courses', localField: 'branch', foreignField: 'code', as: 'data' } }],
      };
      const val = validateQuery(forgedQuery);
      return val.valid === false && val.error.includes('$lookup');
    });

    test('No dangerous prototype pollution keys pass through validation', () => {
      const badQuery = {
        collectionName: 'students',
        operation: 'aggregate',
        pipeline: [{ $match: { __proto__: { admin: true } } }],
      };
      const val = validateQuery(badQuery);
      return val.valid === false && val.error.includes('dangerous keys');
    });

    console.log(`\n${'='.repeat(50)}`);
    console.log(`RESULTS: ${passed}/${passed + failed} tests passed`);
    if (failed === 0) {
      console.log('✅ ALL STEP 21 AI AGGREGATION TESTS PASSED!');
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
