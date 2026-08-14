/**
 * Query Validator
 * 
 * Security boundary between AI-generated structured queries and MongoDB.
 * 
 * Responsibilities:
 * - Validate query structure
 * - Check against schema whitelist
 * - Reject dangerous operators
 * - Validate data types
 * - Prevent prototype pollution
 * - Never execute queries
 * - Never connect to MongoDB
 * 
 * Architecture:
 * AI → Structured Query → queryValidator → queryExecutor → MongoDB
 *                         (this module)
 */

import databaseSchema from '../config/databaseSchema.js';

/**
 * Main validator function
 * @param {*} query - The structured query to validate
 * @returns {Object} - {valid: true, query: sanitized} or {valid: false, error: "message"}
 */
export const validateQuery = (query) => {
  // Check 1: Query must be a plain object
  if (!isPlainObject(query)) {
    return {
      valid: false,
      error: 'Query must be a plain object.',
    };
  }

  // Check 2: No unexpected top-level properties
  const validTopLevelProps = ['collectionName', 'operation', 'filter', 'projection', 'sort', 'skip', 'limit', 'pipeline'];
  const queryKeys = Object.keys(query);
  const unexpectedKeys = queryKeys.filter((key) => !validTopLevelProps.includes(key));

  if (unexpectedKeys.length > 0) {
    return {
      valid: false,
      error: `Unexpected properties: ${unexpectedKeys.join(', ')}. Allowed: ${validTopLevelProps.join(', ')}`,
    };
  }

  // Check 3: collectionName validation
  if (!query.collectionName) {
    return {
      valid: false,
      error: 'collectionName is required.',
    };
  }

  const collectionValidation = validateCollectionName(query.collectionName);
  if (!collectionValidation.valid) {
    return collectionValidation;
  }

  // Check 4: operation validation
  if (!query.operation) {
    return {
      valid: false,
      error: 'operation is required.',
    };
  }

  const operationValidation = validateOperation(query.operation);
  if (!operationValidation.valid) {
    return operationValidation;
  }

  // Branch based on operation type
  if (query.operation === 'aggregate') {
    if (query.pipeline !== undefined) {
      // Pipeline-based aggregation
      const invalidForAggregate = ['filter', 'projection', 'sort', 'skip'].filter((k) => query[k] !== undefined);
      if (invalidForAggregate.length > 0) {
        return {
          valid: false,
          error: `Properties ${invalidForAggregate.join(', ')} are not allowed alongside pipeline for aggregate. Specify them as pipeline stages.`,
        };
      }

      const pipelineValidation = validatePipeline(query.pipeline, query.collectionName);
      if (!pipelineValidation.valid) {
        return pipelineValidation;
      }
    } else if (query.filter !== undefined) {
      // Backwards-compatible filter-based aggregate
      if (!isPlainObject(query.filter)) {
        return {
          valid: false,
          error: 'filter must be a plain object.',
        };
      }

      const filterValidation = validateFilter(query.filter, query.collectionName);
      if (!filterValidation.valid) {
        return filterValidation;
      }
    } else {
      return {
        valid: false,
        error: 'pipeline or filter is required for aggregate operation.',
      };
    }

    if (query.limit !== undefined) {
      const limitValidation = validateLimit(query.limit);
      if (!limitValidation.valid) {
        return limitValidation;
      }
    }
  } else {
    // find or count operation
    if (query.pipeline !== undefined) {
      return {
        valid: false,
        error: 'pipeline property is only allowed for aggregate operations.',
      };
    }

    // Check 5: filter validation (if present)
    if (query.filter !== undefined) {
      if (!isPlainObject(query.filter)) {
        return {
          valid: false,
          error: 'filter must be a plain object.',
        };
      }

      const filterValidation = validateFilter(query.filter, query.collectionName);
      if (!filterValidation.valid) {
        return filterValidation;
      }
    }

    // Check 6: projection validation (if present)
    if (query.projection !== undefined) {
      const projectionValidation = validateProjection(query.projection, query.collectionName);
      if (!projectionValidation.valid) {
        return projectionValidation;
      }
    }

    // Check 7: sort validation (if present)
    if (query.sort !== undefined) {
      const sortValidation = validateSort(query.sort, query.collectionName);
      if (!sortValidation.valid) {
        return sortValidation;
      }
    }

    // Check 8: limit validation (if present)
    if (query.limit !== undefined) {
      const limitValidation = validateLimit(query.limit);
      if (!limitValidation.valid) {
        return limitValidation;
      }
    }

    // Check 9: skip validation (if present)
    if (query.skip !== undefined) {
      const skipValidation = validateSkip(query.skip);
      if (!skipValidation.valid) {
        return skipValidation;
      }
    }
  }

  // All validations passed, return sanitized query
  const sanitizedQuery = sanitizeQuery(query);

  return {
    valid: true,
    query: sanitizedQuery,
  };
};

/**
 * Check if value is a plain object (not array, function, class, etc.)
 */
function isPlainObject(obj) {
  if (obj === null || obj === undefined) return false;
  if (typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return false;
  if (obj instanceof Date) return false;
  if (obj instanceof RegExp) return false;
  if (obj instanceof Function) return false;
  if (obj.constructor !== Object) return false;
  return true;
}

/**
 * Validate collectionName property
 */
function validateCollectionName(collectionName) {
  if (typeof collectionName !== 'string') {
    return {
      valid: false,
      error: 'collectionName must be a string.',
    };
  }

  if (collectionName.trim() === '') {
    return {
      valid: false,
      error: 'collectionName cannot be empty.',
    };
  }

  if (!databaseSchema.isCollectionAllowed(collectionName)) {
    return {
      valid: false,
      error: `Collection "${collectionName}" is not allowed.`,
    };
  }

  return { valid: true };
}

/**
 * Validate operation property
 * Must be allowed and READ-ONLY
 */
function validateOperation(operation) {
  if (typeof operation !== 'string') {
    return {
      valid: false,
      error: 'operation must be a string.',
    };
  }

  if (!databaseSchema.isOperationAllowed(operation)) {
    return {
      valid: false,
      error: `Operation "${operation}" is not allowed. Allowed operations: find, count, aggregate.`,
    };
  }

  // Verify it's a read-only operation (no writes)
  const writeOperations = ['insert', 'update', 'delete', 'replace', 'drop', 'deleteOne', 'updateOne'];
  if (writeOperations.includes(operation)) {
    return {
      valid: false,
      error: `Write operation "${operation}" is not allowed. Only read operations are permitted.`,
    };
  }

  return { valid: true };
}

/**
 * Validate filter object recursively
 * Checks all fields and operators are allowed and data types match
 */
function validateFilter(filter, collectionName) {
  if (!isPlainObject(filter)) {
    return {
      valid: false,
      error: 'filter must be a plain object.',
    };
  }

  // Check for dangerous keys
  if (hasDangerousKeys(filter)) {
    return {
      valid: false,
      error: 'Filter contains dangerous keys (__proto__, constructor, prototype).',
    };
  }

  // Validate each filter condition
  for (const [key, value] of Object.entries(filter)) {
    // Handle logical operators ($and, $or)
    if (key === '$and' || key === '$or') {
      if (!Array.isArray(value)) {
        return {
          valid: false,
          error: `${key} must be an array.`,
        };
      }

      for (let i = 0; i < value.length; i++) {
        if (!isPlainObject(value[i])) {
          return {
            valid: false,
            error: `${key}[${i}] must be an object.`,
          };
        }

        // Recursively validate each condition in the logical operator
        const conditionValidation = validateFilter(value[i], collectionName);
        if (!conditionValidation.valid) {
          return conditionValidation;
        }
      }

      continue;
    }

    // For regular fields, check field exists and is filterable
    if (!databaseSchema.isFieldAllowed(collectionName, key)) {
      return {
        valid: false,
        error: `Field "${key}" does not exist in collection "${collectionName}".`,
      };
    }

    if (!databaseSchema.isFieldFilterable(collectionName, key)) {
      return {
        valid: false,
        error: `Field "${key}" is not filterable.`,
      };
    }

    // Value should be an operator object or a direct value for $eq
    if (isPlainObject(value)) {
      // It's an operator object like {$gt: 8.5}
      const operatorValidation = validateFilterOperators(key, value, collectionName);
      if (!operatorValidation.valid) {
        return operatorValidation;
      }
    } else {
      // Direct value (implicitly $eq)
      const typeValidation = validateFilterValue(key, value, collectionName);
      if (!typeValidation.valid) {
        return typeValidation;
      }
    }
  }

  return { valid: true };
}

/**
 * Validate operators within a field filter
 * e.g., {$gt: 8.5, $lt: 9.0}
 */
function validateFilterOperators(fieldName, operatorObject, collectionName) {
  for (const [operator, operand] of Object.entries(operatorObject)) {
    // Check if operator is allowed
    if (!databaseSchema.isOperatorAllowed(operator)) {
      const blockReason = databaseSchema.getOperatorBlockReason(operator);
      return {
        valid: false,
        error: `Operator "${operator}" is not allowed. ${blockReason}`,
      };
    }

    // Additional checks for specific operators
    const operatorDef = databaseSchema.operators[operator];

    // Check if operator only works with arrays
    if (operatorDef.arrayOnly && !Array.isArray(operand)) {
      return {
        valid: false,
        error: `Operator "${operator}" requires an array value.`,
      };
    }

    // Validate the operand value matches field type
    const fieldType = databaseSchema.getFieldType(collectionName, fieldName);
    if (operator !== '$in' && operator !== '$nin') {
      // For comparison operators, validate single value
      const valueValidation = validateValueType(operand, fieldType, operator);
      if (!valueValidation.valid) {
        return valueValidation;
      }
    } else {
      // For $in and $nin, validate array of values
      if (!Array.isArray(operand)) {
        return {
          valid: false,
          error: `${operator} requires an array value.`,
        };
      }

      for (let i = 0; i < operand.length; i++) {
        const valueValidation = validateValueType(operand[i], fieldType, operator);
        if (!valueValidation.valid) {
          return {
            valid: false,
            error: `${operator}[${i}]: ${valueValidation.error}`,
          };
        }
      }
    }
  }

  return { valid: true };
}

/**
 * Validate a single value matches expected type
 */
function validateValueType(value, expectedType, context = '') {
  // Reject undefined, functions, and non-plain objects
  if (value === undefined) {
    return {
      valid: false,
      error: 'Value cannot be undefined.',
    };
  }

  if (typeof value === 'function') {
    return {
      valid: false,
      error: 'Value cannot be a function.',
    };
  }

  if (value instanceof RegExp) {
    return {
      valid: false,
      error: 'Value cannot be a RegExp.',
    };
  }

  if (value instanceof Date) {
    return {
      valid: false,
      error: 'Value cannot be a Date object.',
    };
  }

  // Type checking based on field type
  switch (expectedType) {
    case 'string':
      if (typeof value !== 'string') {
        return {
          valid: false,
          error: `Expected string, got ${typeof value}.`,
        };
      }
      break;

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return {
          valid: false,
          error: `Expected number, got ${typeof value}.`,
        };
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return {
          valid: false,
          error: `Expected boolean, got ${typeof value}.`,
        };
      }
      break;

    case 'date':
      if (!(value instanceof Date)) {
        return {
          valid: false,
          error: `Expected Date object.`,
        };
      }
      break;

    default:
      // For unknown types, just ensure it's not dangerous
      if (typeof value === 'object' && !isPlainObject(value)) {
        return {
          valid: false,
          error: `Invalid value type: ${typeof value}.`,
        };
      }
  }

  return { valid: true };
}

/**
 * Validate filter value (direct field comparison without operator)
 */
function validateFilterValue(fieldName, value, collectionName) {
  const fieldType = databaseSchema.getFieldType(collectionName, fieldName);
  return validateValueType(value, fieldType);
}

/**
 * Validate projection object
 */
function validateProjection(projection, collectionName) {
  if (!isPlainObject(projection)) {
    return {
      valid: false,
      error: 'projection must be a plain object.',
    };
  }

  for (const [fieldName, projectionValue] of Object.entries(projection)) {
    // Check field exists
    if (!databaseSchema.isFieldAllowed(collectionName, fieldName)) {
      return {
        valid: false,
        error: `Field "${fieldName}" does not exist in collection "${collectionName}".`,
      };
    }

    // Check field is projectable
    if (!databaseSchema.isFieldProjectable(collectionName, fieldName)) {
      return {
        valid: false,
        error: `Field "${fieldName}" is not projectable.`,
      };
    }

    // Projection value must be 0 or 1
    if (projectionValue !== 0 && projectionValue !== 1) {
      return {
        valid: false,
        error: `Projection values must be 0 or 1. Got ${projectionValue} for "${fieldName}".`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validate sort object
 */
function validateSort(sort, collectionName) {
  if (!isPlainObject(sort)) {
    return {
      valid: false,
      error: 'sort must be a plain object.',
    };
  }

  for (const [fieldName, sortDirection] of Object.entries(sort)) {
    // Check field exists
    if (!databaseSchema.isFieldAllowed(collectionName, fieldName)) {
      return {
        valid: false,
        error: `Field "${fieldName}" does not exist in collection "${collectionName}".`,
      };
    }

    // Check field is sortable
    if (!databaseSchema.isFieldSortable(collectionName, fieldName)) {
      return {
        valid: false,
        error: `Field "${fieldName}" is not sortable.`,
      };
    }

    // Sort direction must be 1 or -1
    if (sortDirection !== 1 && sortDirection !== -1) {
      return {
        valid: false,
        error: `Sort direction must be 1 (ascending) or -1 (descending). Got ${sortDirection} for "${fieldName}".`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validate limit parameter
 */
function validateLimit(limit) {
  if (!Number.isInteger(limit)) {
    return {
      valid: false,
      error: `limit must be an integer. Got ${typeof limit}.`,
    };
  }

  if (limit < 1) {
    return {
      valid: false,
      error: `limit must be >= 1. Got ${limit}.`,
    };
  }

  if (limit > databaseSchema.limits.maxLimit) {
    return {
      valid: false,
      error: `limit cannot exceed ${databaseSchema.limits.maxLimit}. Got ${limit}.`,
    };
  }

  return { valid: true };
}

/**
 * Validate skip parameter
 */
function validateSkip(skip) {
  if (!Number.isInteger(skip)) {
    return {
      valid: false,
      error: `skip must be an integer. Got ${typeof skip}.`,
    };
  }

  if (skip < 0) {
    return {
      valid: false,
      error: `skip must be >= 0. Got ${skip}.`,
    };
  }

  if (skip > databaseSchema.limits.maxSkip) {
    return {
      valid: false,
      error: `skip cannot exceed ${databaseSchema.limits.maxSkip}. Got ${skip}.`,
    };
  }

  return { valid: true };
}

/**
 * Check for prototype pollution style keys
 */
function hasDangerousKeys(obj) {
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

  // Use getOwnPropertyNames to catch all properties including __proto__
  for (const key of Object.getOwnPropertyNames(obj)) {
    if (dangerousKeys.includes(key)) {
      return true;
    }

    // Recursively check nested objects
    if (isPlainObject(obj[key])) {
      if (hasDangerousKeys(obj[key])) {
        return true;
      }
    }

    // Check inside arrays of objects
    if (Array.isArray(obj[key])) {
      for (const item of obj[key]) {
        if (isPlainObject(item) && hasDangerousKeys(item)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Validate aggregation pipeline
 */
function validatePipeline(pipeline, collectionName) {
  if (!Array.isArray(pipeline)) {
    return {
      valid: false,
      error: 'pipeline must be an array.',
    };
  }

  if (pipeline.length === 0) {
    return {
      valid: false,
      error: 'pipeline cannot be empty.',
    };
  }

  const maxStages = databaseSchema.limits.maxPipelineStages || 10;
  if (pipeline.length > maxStages) {
    return {
      valid: false,
      error: `pipeline exceeds maximum allowed stages of ${maxStages}.`,
    };
  }

  for (let i = 0; i < pipeline.length; i++) {
    const stage = pipeline[i];
    const stageValidation = validatePipelineStage(stage, collectionName, i);
    if (!stageValidation.valid) {
      return stageValidation;
    }
  }

  return { valid: true };
}

/**
 * Validate a single pipeline stage
 */
function validatePipelineStage(stage, collectionName, index) {
  if (!isPlainObject(stage)) {
    return {
      valid: false,
      error: `Pipeline stage at index ${index} must be a plain object.`,
    };
  }

  if (hasDangerousKeys(stage)) {
    return {
      valid: false,
      error: `Pipeline stage at index ${index} contains dangerous keys.`,
    };
  }

  const stageKeys = Object.keys(stage);
  if (stageKeys.length !== 1) {
    return {
      valid: false,
      error: `Pipeline stage at index ${index} must have exactly one stage operator. Got ${stageKeys.length}: ${stageKeys.join(', ')}`,
    };
  }

  const stageOp = stageKeys[0];

  if (!databaseSchema.isAggregationStageAllowed(stageOp)) {
    const reason = databaseSchema.getAggregationStageBlockReason(stageOp);
    return {
      valid: false,
      error: `Stage "${stageOp}" is not allowed. ${reason}`,
    };
  }

  const stageBody = stage[stageOp];

  switch (stageOp) {
    case '$match':
      return validateMatchStage(stageBody, collectionName, index);
    case '$group':
      return validateGroupStage(stageBody, collectionName, index);
    case '$project':
      return validateProjectStage(stageBody, collectionName, index);
    case '$sort':
      return validateSortStage(stageBody, collectionName, index);
    case '$limit':
      return validateLimitStage(stageBody, index);
    default:
      return {
        valid: false,
        error: `Stage "${stageOp}" handler not implemented.`,
      };
  }
}

/**
 * Validate $match stage body
 */
function validateMatchStage(matchBody, collectionName, index) {
  if (!isPlainObject(matchBody)) {
    return {
      valid: false,
      error: `$match at index ${index} must be a plain object.`,
    };
  }
  const filterValidation = validateFilter(matchBody, collectionName);
  if (!filterValidation.valid) {
    return {
      valid: false,
      error: `$match stage error at index ${index}: ${filterValidation.error}`,
    };
  }
  return { valid: true };
}

/**
 * Validate $group stage body
 */
function validateGroupStage(groupBody, collectionName, index) {
  if (!isPlainObject(groupBody)) {
    return {
      valid: false,
      error: `$group at index ${index} must be a plain object.`,
    };
  }

  if (!('_id' in groupBody)) {
    return {
      valid: false,
      error: `$group at index ${index} must have an "_id" field.`,
    };
  }

  // Validate _id
  const idValue = groupBody._id;
  if (idValue !== null) {
    if (typeof idValue === 'string') {
      if (idValue.startsWith('$')) {
        const fieldName = idValue.slice(1);
        if (!databaseSchema.isFieldAllowed(collectionName, fieldName)) {
          return {
            valid: false,
            error: `Field "${fieldName}" in $group _id does not exist in collection "${collectionName}".`,
          };
        }
      } else {
        return {
          valid: false,
          error: `$group _id string must be a field reference starting with "$".`,
        };
      }
    } else if (isPlainObject(idValue)) {
      if (hasDangerousKeys(idValue)) {
        return {
          valid: false,
          error: `$group _id contains dangerous keys.`,
        };
      }
      for (const [subKey, subVal] of Object.entries(idValue)) {
        if (typeof subVal !== 'string' || !subVal.startsWith('$')) {
          return {
            valid: false,
            error: `Compound $group _id property "${subKey}" must be a field reference starting with "$".`,
          };
        }
        const fieldName = subVal.slice(1);
        if (!databaseSchema.isFieldAllowed(collectionName, fieldName)) {
          return {
            valid: false,
            error: `Field "${fieldName}" in compound $group _id does not exist in collection "${collectionName}".`,
          };
        }
      }
    } else {
      return {
        valid: false,
        error: `$group _id must be null, a field reference string, or an object.`,
      };
    }
  }

  // Validate all accumulator fields in $group
  for (const [accField, accObj] of Object.entries(groupBody)) {
    if (accField === '_id') continue;

    if (!isPlainObject(accObj)) {
      return {
        valid: false,
        error: `Accumulator for "${accField}" in $group at index ${index} must be a plain object.`,
      };
    }

    if (hasDangerousKeys(accObj)) {
      return {
        valid: false,
        error: `Accumulator for "${accField}" in $group at index ${index} contains dangerous keys.`,
      };
    }

    const accKeys = Object.keys(accObj);
    if (accKeys.length !== 1) {
      return {
        valid: false,
        error: `Accumulator for "${accField}" in $group at index ${index} must have exactly one operator.`,
      };
    }

    const accOp = accKeys[0];
    if (!databaseSchema.isAccumulatorAllowed(accOp)) {
      const reason = databaseSchema.getAccumulatorBlockReason(accOp);
      return {
        valid: false,
        error: `Accumulator operator "${accOp}" is not allowed. ${reason}`,
      };
    }

    const accOperand = accObj[accOp];
    if (accOp === '$count') {
      continue;
    }

    if (accOp === '$sum' && (accOperand === 1 || typeof accOperand === 'number')) {
      continue;
    }

    if (typeof accOperand === 'string' && accOperand.startsWith('$')) {
      const fieldName = accOperand.slice(1);
      if (!databaseSchema.isFieldAllowed(collectionName, fieldName)) {
        return {
          valid: false,
          error: `Field "${fieldName}" in accumulator "${accOp}" does not exist in collection "${collectionName}".`,
        };
      }

      const accDef = databaseSchema.accumulators[accOp];
      if (accDef?.numericOnly) {
        const fieldType = databaseSchema.getFieldType(collectionName, fieldName);
        if (fieldType !== 'number') {
          return {
            valid: false,
            error: `Accumulator "${accOp}" requires a numeric field, but "${fieldName}" is "${fieldType}".`,
          };
        }
      }
    } else {
      return {
        valid: false,
        error: `Invalid operand for accumulator "${accOp}" in "${accField}". Expected field reference (e.g. "$cgpa") or number.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validate $project stage body
 */
function validateProjectStage(projectBody, collectionName, index) {
  if (!isPlainObject(projectBody)) {
    return {
      valid: false,
      error: `$project at index ${index} must be a plain object.`,
    };
  }

  if (hasDangerousKeys(projectBody)) {
    return {
      valid: false,
      error: `$project at index ${index} contains dangerous keys.`,
    };
  }

  for (const [key, val] of Object.entries(projectBody)) {
    if (key === '_id') {
      if (val !== 0 && val !== 1) {
        return {
          valid: false,
          error: `Projection value for "_id" must be 0 or 1.`,
        };
      }
      continue;
    }

    if (val === 0 || val === 1) {
      continue;
    }

    if (typeof val === 'string' && val.startsWith('$')) {
      continue;
    }

    return {
      valid: false,
      error: `Invalid projection expression for "${key}" in $project stage at index ${index}.`,
    };
  }

  return { valid: true };
}

/**
 * Validate $sort stage body
 */
function validateSortStage(sortBody, collectionName, index) {
  if (!isPlainObject(sortBody)) {
    return {
      valid: false,
      error: `$sort at index ${index} must be a plain object.`,
    };
  }

  if (hasDangerousKeys(sortBody)) {
    return {
      valid: false,
      error: `$sort at index ${index} contains dangerous keys.`,
    };
  }

  for (const [field, dir] of Object.entries(sortBody)) {
    if (dir !== 1 && dir !== -1) {
      return {
        valid: false,
        error: `Sort direction for "${field}" must be 1 or -1 in $sort stage at index ${index}.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validate $limit stage body
 */
function validateLimitStage(limitVal, index) {
  if (!Number.isInteger(limitVal) || limitVal < 1) {
    return {
      valid: false,
      error: `$limit at index ${index} must be a positive integer.`,
    };
  }

  if (limitVal > databaseSchema.limits.maxLimit) {
    return {
      valid: false,
      error: `$limit at index ${index} cannot exceed ${databaseSchema.limits.maxLimit}.`,
    };
  }

  return { valid: true };
}

/**
 * Create a sanitized copy of the query
 * Only includes validated properties
 */
function sanitizeQuery(query) {
  const sanitized = {};

  // Copy validated top-level properties
  if (query.collectionName !== undefined) {
    sanitized.collectionName = query.collectionName;
  }

  if (query.operation !== undefined) {
    sanitized.operation = query.operation;
  }

  if (query.pipeline !== undefined) {
    sanitized.pipeline = deepClone(query.pipeline);
  }

  if (query.filter !== undefined) {
    sanitized.filter = deepClone(query.filter);
  }

  if (query.projection !== undefined) {
    sanitized.projection = deepClone(query.projection);
  }

  if (query.sort !== undefined) {
    sanitized.sort = deepClone(query.sort);
  }

  if (query.limit !== undefined) {
    sanitized.limit = query.limit;
  }

  if (query.skip !== undefined) {
    sanitized.skip = query.skip;
  }

  return sanitized;
}

/**
 * Deep clone an object (for sanitization)
 * Creates a new object without references to original
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item));
  }

  if (isPlainObject(obj)) {
    const cloned = {};
    for (const [key, value] of Object.entries(obj)) {
      cloned[key] = deepClone(value);
    }
    return cloned;
  }

  return obj;
}

export default validateQuery;
