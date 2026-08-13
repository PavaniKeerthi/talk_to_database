/**
 * Query Validator Test Suite
 * 
 * Tests the validator against known valid and invalid queries.
 * Does NOT connect to MongoDB or execute queries.
 */

import validateQuery from '../services/queryValidator.js';

// Test results tracking
let passed = 0;
let failed = 0;
const results = [];

/**
 * Helper to run a single test
 */
function test(name, query, shouldBeValid = true) {
  const result = validateQuery(query);
  const isValid = result.valid;

  if (isValid === shouldBeValid) {
    passed++;
    results.push(`✅ PASS: ${name}`);
  } else {
    failed++;
    results.push(`❌ FAIL: ${name}`);
    results.push(`   Expected valid=${shouldBeValid}, got valid=${isValid}`);
    if (!isValid) {
      results.push(`   Error: ${result.error}`);
    }
  }
}

console.log('=== Query Validator Test Suite ===\n');

// ============================================================================
// VALID QUERY TESTS
// ============================================================================

console.log('--- VALID QUERIES ---\n');

// Test 1: Find all students (minimal query)
test('Valid: Find all students', {
  collectionName: 'students',
  operation: 'find',
});

// Test 2: Find with simple filter (cgpa > 8.5)
test('Valid: CGPA greater than 8.5', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    cgpa: {
      $gt: 8.5,
    },
  },
});

// Test 3: Find with direct value (branch = "Computer Science")
test('Valid: Branch equals Computer Science', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    branch: 'Computer Science',
  },
});

// Test 4: Find with compound filter (cgpa >= 8 AND cgpa <= 9)
test('Valid: CGPA between 8 and 9', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    cgpa: {
      $gte: 8,
      $lte: 9,
    },
  },
});

// Test 5: Find with sort
test('Valid: Sort by CGPA descending', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    branch: 'Computer Science',
  },
  sort: {
    cgpa: -1,
  },
});

// Test 6: Find with limit
test('Valid: Limit to 5 results', {
  collectionName: 'students',
  operation: 'find',
  limit: 5,
});

// Test 7: Find with skip
test('Valid: Skip 10 results', {
  collectionName: 'students',
  operation: 'find',
  skip: 10,
});

// Test 8: Find with projection
test('Valid: Projection with name, branch, cgpa', {
  collectionName: 'students',
  operation: 'find',
  projection: {
    name: 1,
    branch: 1,
    cgpa: 1,
  },
});

// Test 9: Find with $in operator (branches)
test('Valid: $in operator with array', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    branch: {
      $in: ['Computer Science', 'Electronics'],
    },
  },
});

// Test 10: Find with $or logical operator
test('Valid: $or logical operator', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    $or: [{ branch: 'Computer Science' }, { cgpa: { $gte: 9 } }],
  },
});

// Test 11: Find with $and logical operator
test('Valid: $and logical operator', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    $and: [{ branch: 'Computer Science' }, { cgpa: { $gte: 8 } }],
  },
});

// Test 12: Find with $ne (not equal)
test('Valid: $ne operator', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    branch: {
      $ne: 'Computer Science',
    },
  },
});

// Test 13: Count operation
test('Valid: Count operation', {
  collectionName: 'students',
  operation: 'count',
  filter: {
    cgpa: {
      $gte: 8,
    },
  },
});

// Test 14: Aggregate operation
test('Valid: Aggregate operation', {
  collectionName: 'students',
  operation: 'aggregate',
  filter: {
    cgpa: {
      $gte: 8,
    },
  },
});

// Test 15: Multiple operations combined
test('Valid: Complex query with all fields', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    cgpa: {
      $gte: 7,
      $lte: 10,
    },
  },
  projection: {
    name: 1,
    cgpa: 1,
  },
  sort: {
    cgpa: -1,
  },
  limit: 10,
  skip: 0,
});

// Test 16: Find with $nin (not in)
test('Valid: $nin operator', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    branch: {
      $nin: ['Physics', 'Chemistry'],
    },
  },
});

// Test 17: Find year field
test('Valid: Year field filter', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    year: 2024,
  },
});

// Test 18: Limit at maximum (100)
test('Valid: Limit at max (100)', {
  collectionName: 'students',
  operation: 'find',
  limit: 100,
});

// Test 19: Skip at maximum (1000)
test('Valid: Skip at max (1000)', {
  collectionName: 'students',
  operation: 'find',
  skip: 1000,
});

// Test 20: Projection with _id
test('Valid: Projection with _id excluded', {
  collectionName: 'students',
  operation: 'find',
  projection: {
    _id: 0,
    name: 1,
    branch: 1,
  },
});

// ============================================================================
// INVALID QUERY TESTS
// ============================================================================

console.log('\n--- INVALID QUERIES ---\n');

// Test 1: Unknown collection
test('Invalid: Unknown collection', {
  collectionName: 'users',
  operation: 'find',
}, false);

// Test 2: Unknown field in filter
test('Invalid: Unknown field (password)', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    password: '123',
  },
}, false);

// Test 3: $where operator (blocked)
test('Invalid: $where operator', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    $where: "this.cgpa > 8.5",
  },
}, false);

// Test 4: $function operator (blocked)
test('Invalid: $function operator', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    $function: {
      body: 'function(x) { return x.cgpa > 8.5; }',
    },
  },
}, false);

// Test 5: $eval operator (blocked)
test('Invalid: $eval operator', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    $eval: "this.cgpa > 8.5",
  },
}, false);

// Test 6: Unknown $ operator
test('Invalid: Unknown $ operator', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    cgpa: {
      $unknownOp: 8.5,
    },
  },
}, false);

// Test 7: Invalid CGPA type (string instead of number)
test('Invalid: CGPA as string', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    cgpa: 'high',
  },
}, false);

// Test 8: Invalid year type (string instead of number)
test('Invalid: Year as string', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    year: '2024',
  },
}, false);

// Test 9: Invalid sort direction (2 instead of 1/-1)
test('Invalid: Sort direction not 1 or -1', {
  collectionName: 'students',
  operation: 'find',
  sort: {
    cgpa: 2,
  },
}, false);

// Test 10: Limit = 0 (must be >= 1)
test('Invalid: Limit = 0', {
  collectionName: 'students',
  operation: 'find',
  limit: 0,
}, false);

// Test 11: Limit > 100
test('Invalid: Limit > 100', {
  collectionName: 'students',
  operation: 'find',
  limit: 150,
}, false);

// Test 12: Skip < 0
test('Invalid: Skip < 0', {
  collectionName: 'students',
  operation: 'find',
  skip: -10,
}, false);

// Test 13: Skip > 1000
test('Invalid: Skip > 1000', {
  collectionName: 'students',
  operation: 'find',
  skip: 1500,
}, false);

// Test 14: Negative limit
test('Invalid: Negative limit', {
  collectionName: 'students',
  operation: 'find',
  limit: -5,
}, false);

// Test 15: Unknown top-level property
test('Invalid: Unknown property (extra field)', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    cgpa: {
      $gt: 8.5,
    },
  },
  randomField: 'malicious',
}, false);

// Test 16: __proto__ key (prototype pollution)
// Simulates receiving __proto__ as a property in a JSON string from AI
const queryWithProto = JSON.parse('{"collectionName":"students","operation":"find","filter":{"__proto__":{"admin":true}}}');
test('Invalid: __proto__ key', queryWithProto, false);

// Test 17: constructor key (prototype pollution)
test('Invalid: constructor key', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    constructor: {},
  },
}, false);

// Test 18: prototype key (prototype pollution)
test('Invalid: prototype key', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    prototype: {},
  },
}, false);

// Test 19: Function value in filter
test('Invalid: Function value in filter', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    cgpa: () => 8.5,
  },
}, false);

// Test 20: Undefined value in filter
test('Invalid: Undefined value', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    cgpa: undefined,
  },
}, false);

// Test 21: RegExp value (not allowed)
test('Invalid: RegExp value', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    name: /test/,
  },
}, false);

// Test 22: Write operation (insert)
test('Invalid: Write operation (insert)', {
  collectionName: 'students',
  operation: 'insert',
}, false);

// Test 23: Write operation (update)
test('Invalid: Write operation (update)', {
  collectionName: 'students',
  operation: 'update',
}, false);

// Test 24: Write operation (delete)
test('Invalid: Write operation (delete)', {
  collectionName: 'students',
  operation: 'delete',
}, false);

// Test 25: Query is array (not object)
test('Invalid: Query is array', [], false);

// Test 26: Query is string (not object)
test('Invalid: Query is string', 'find', false);

// Test 27: Query is null
test('Invalid: Query is null', null, false);

// Test 28: Missing collectionName
test('Invalid: Missing collectionName', {
  operation: 'find',
}, false);

// Test 29: Missing operation
test('Invalid: Missing operation', {
  collectionName: 'students',
}, false);

// Test 30: Invalid projection value (2 instead of 0/1)
test('Invalid: Projection value not 0 or 1', {
  collectionName: 'students',
  operation: 'find',
  projection: {
    name: 2,
  },
}, false);

// Test 31: Projection field doesn\'t exist
test('Invalid: Unknown projection field', {
  collectionName: 'students',
  operation: 'find',
  projection: {
    nonexistent: 1,
  },
}, false);

// Test 32: Filter value is Array (should be object/primitive)
test('Invalid: Filter value is Array', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    cgpa: [8.5],
  },
}, false);

// Test 33: $in with non-array value
test('Invalid: $in with non-array', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    branch: {
      $in: 'Computer Science',
    },
  },
}, false);

// Test 34: $or with non-array value
test('Invalid: $or with non-array', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    $or: { branch: 'Computer Science' },
  },
}, false);

// Test 35: createdAt field in filter (not filterable)
test('Invalid: Filter on non-filterable field (createdAt)', {
  collectionName: 'students',
  operation: 'find',
  filter: {
    createdAt: '2024-01-01',
  },
}, false);

// Test 36: Limit as float (must be integer)
test('Invalid: Limit as float', {
  collectionName: 'students',
  operation: 'find',
  limit: 5.5,
}, false);

// Test 37: Skip as float (must be integer)
test('Invalid: Skip as float', {
  collectionName: 'students',
  operation: 'find',
  skip: 5.5,
}, false);

// ============================================================================
// PRINT RESULTS
// ============================================================================

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
  console.log('\n✅ ALL TESTS PASSED!');
  process.exit(0);
} else {
  console.log(`\n❌ ${failed} test(s) failed.`);
  process.exit(1);
}
