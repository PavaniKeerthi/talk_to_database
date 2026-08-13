/**
 * Query Cache Test - Small test suite
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import normalizeQuestion from '../services/questionNormalizer.js';
import { lookupCachedQuery, storeQuery, recordCacheHit } from '../services/queryCache.js';
import connectDB from '../config/db.js';
import QueryHistory from '../models/QueryHistory.js';

dotenv.config();

let passed = 0;
let failed = 0;

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
  console.log('=== Query Cache Tests ===\n');

  try {
    await connectDB();

    // Clean up test data first
    await QueryHistory.deleteMany({
      originalQuestion: { $regex: 'test' },
    });

    // Test 1: Normalize "Show CS students"
    await test('Normalize: "Show CS students"', async () => {
      const normalized = normalizeQuestion('Show CS students');
      if (normalized !== 'show computer science students') {
        throw new Error(
          `Expected "show computer science students", got "${normalized}"`
        );
      }
    });

    // Test 2: Normalize "show computer science students"
    await test('Normalize: "show computer science students"', async () => {
      const normalized = normalizeQuestion('show computer science students');
      if (normalized !== 'show computer science students') {
        throw new Error(`Expected match, got "${normalized}"`);
      }
    });

    // Test 3: Both normalize consistently
    await test('Both questions normalize identically', async () => {
      const n1 = normalizeQuestion('Show CS students');
      const n2 = normalizeQuestion('show computer science students');
      if (n1 !== n2) {
        throw new Error(`Expected "${n1}" === "${n2}"`);
      }
    });

    // Test 4: Cache miss for new question
    await test('Cache miss for new question', async () => {
      const result = await lookupCachedQuery('test show cs students');
      if (result.hit !== false) {
        throw new Error('Expected cache miss');
      }
    });

    // Test 5: Store structured query
    await test('Store structured query', async () => {
      const query = {
        collectionName: 'students',
        operation: 'find',
        filter: { branch: 'computer science' },
      };

      const stored = await storeQuery('test show cs students', query, {
        resultCount: 4,
        executionTimeMs: 10,
      });

      if (!stored._id) {
        throw new Error('Query not stored');
      }
    });

    // Test 6: Lookup cached query
    await test('Lookup cached query', async () => {
      const result = await lookupCachedQuery('test show cs students');
      if (result.hit !== true) {
        throw new Error('Expected cache hit');
      }
    });

    // Test 7: Retrieve same structured query
    await test('Retrieve same structured query', async () => {
      const result = await lookupCachedQuery('test show cs students');
      if (!result.structuredQuery || result.structuredQuery.operation !== 'find') {
        throw new Error('Invalid structured query retrieved');
      }
    });

    // Test 8: Cache hit statistics increase
    await test('Cache hit statistics increase', async () => {
      const before = await lookupCachedQuery('test show cs students');
      const beforeCount = before.historyRecord.cacheHits;

      await recordCacheHit(before.historyRecord);

      const after = await lookupCachedQuery('test show cs students');
      const afterCount = after.historyRecord.cacheHits;

      if (afterCount !== beforeCount + 1) {
        throw new Error(
          `Expected cacheHits ${beforeCount + 1}, got ${afterCount}`
        );
      }
    });

    // Clean up test data
    await QueryHistory.deleteMany({
      originalQuestion: { $regex: 'test' },
    });

    console.log(`\n${'='.repeat(50)}`);
    console.log(`Total: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);
    console.log('='.repeat(50));

    if (failed === 0) {
      console.log('\n✅ ALL TESTS PASSED');
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
