/**
 * Central schema definition for TalkDB
 * 
 * Defines:
 * - Which collections are queryable
 * - Field properties (type, filterable, sortable, projectable)
 * - Allowed MongoDB operators
 * - Query limits and safety constraints
 * 
 * This file is the single source of truth for the entire query engine.
 * Future AI layers will also reference this schema.
 */

export const databaseSchema = {
  // Allowed collections
  collections: {
    students: {
      name: 'students',
      allowed: true,
      fields: {
        _id: {
          type: 'objectId',
          filterable: false,  // Don't allow filtering by _id
          sortable: false,
          projectable: true,
        },
        name: {
          type: 'string',
          filterable: true,
          sortable: true,
          projectable: true,
        },
        branch: {
          type: 'string',
          filterable: true,
          sortable: true,
          projectable: true,
        },
        cgpa: {
          type: 'number',
          filterable: true,
          sortable: true,
          projectable: true,
        },
        year: {
          type: 'number',
          filterable: true,
          sortable: true,
          projectable: true,
        },
        createdAt: {
          type: 'date',
          filterable: false,
          sortable: false,
          projectable: false,  // System field, don't expose
        },
        updatedAt: {
          type: 'date',
          filterable: false,
          sortable: false,
          projectable: false,  // System field, don't expose
        },
      },
    },
    courses: {
      name: 'courses',
      allowed: true,
      fields: {
        _id: {
          type: 'objectId',
          filterable: false,
          sortable: false,
          projectable: true,
        },
        code: {
          type: 'string',
          filterable: true,
          sortable: true,
          projectable: true,
        },
        title: {
          type: 'string',
          filterable: true,
          sortable: true,
          projectable: true,
        },
        credits: {
          type: 'number',
          filterable: true,
          sortable: true,
          projectable: true,
        },
        instructor: {
          type: 'string',
          filterable: true,
          sortable: true,
          projectable: true,
        },
        createdAt: {
          type: 'date',
          filterable: false,
          sortable: false,
          projectable: false,
        },
        updatedAt: {
          type: 'date',
          filterable: false,
          sortable: false,
          projectable: false,
        },
      },
    },
  },

  // Allowed operations
  operations: {
    find: {
      allowed: true,
      supportsFilter: true,
      supportsProjection: true,
      supportsSort: true,
      supportsLimit: true,
      supportsSkip: true,
    },
    count: {
      allowed: true,
      supportsFilter: true,
      supportsProjection: false,
      supportsSort: false,
      supportsLimit: false,
      supportsSkip: false,
    },
    aggregate: {
      allowed: true,
      supportsFilter: false,  // Uses $match in pipeline
      supportsProjection: true,
      supportsSort: true,
      supportsLimit: true,
      supportsSkip: true,
    },
  },

  // Allowed operators (MongoDB operators that are safe)
  operators: {
    $eq: { allowed: true, category: 'comparison' },
    $ne: { allowed: true, category: 'comparison' },
    $gt: { allowed: true, category: 'comparison' },
    $gte: { allowed: true, category: 'comparison' },
    $lt: { allowed: true, category: 'comparison' },
    $lte: { allowed: true, category: 'comparison' },
    $in: { allowed: true, category: 'comparison', arrayOnly: true },
    $nin: { allowed: true, category: 'comparison', arrayOnly: true },
    $and: { allowed: true, category: 'logical' },
    $or: { allowed: true, category: 'logical' },
    // Explicitly not allowed (security):
    $where: { allowed: false, reason: 'JavaScript execution not permitted' },
    $function: { allowed: false, reason: 'JavaScript execution not permitted' },
    $eval: { allowed: false, reason: 'JavaScript execution not permitted' },
  },

  // Allowed aggregation stages (strictly whitelisted for read-only analytics)
  aggregationStages: {
    $match: { allowed: true, category: 'filter' },
    $group: { allowed: true, category: 'group' },
    $project: { allowed: true, category: 'projection' },
    $sort: { allowed: true, category: 'sort' },
    $limit: { allowed: true, category: 'limit' },
    // Explicitly forbidden stages (security):
    $lookup: { allowed: false, reason: 'Cross-collection lookup is not permitted' },
    $out: { allowed: false, reason: 'Database write stage is not permitted' },
    $merge: { allowed: false, reason: 'Database merge stage is not permitted' },
    $graphLookup: { allowed: false, reason: 'Graph lookup is not permitted' },
    $facet: { allowed: false, reason: 'Facet stage is not permitted' },
    $function: { allowed: false, reason: 'JavaScript execution is not permitted' },
    $accumulator: { allowed: false, reason: 'JavaScript execution is not permitted' },
    $where: { allowed: false, reason: 'JavaScript execution is not permitted' },
  },

  // Allowed accumulators in $group stages
  accumulators: {
    $avg: { allowed: true, numericOnly: true },
    $sum: { allowed: true, numericOnly: true },
    $min: { allowed: true, numericOnly: false },
    $max: { allowed: true, numericOnly: false },
    $count: { allowed: true, numericOnly: false },
    $first: { allowed: true, numericOnly: false },
    $last: { allowed: true, numericOnly: false },
    // Explicitly forbidden accumulators (security):
    $accumulator: { allowed: false, reason: 'JavaScript execution is not permitted' },
    $function: { allowed: false, reason: 'JavaScript execution is not permitted' },
  },

  // Query constraints
  limits: {
    maxLimit: 100,      // Maximum documents to return
    maxSkip: 1000,      // Maximum documents to skip
    defaultLimit: 50,   // Default if not specified
    maxPipelineStages: 10, // Maximum aggregation stages allowed
  },

  // Helper functions to query this schema

  /**
   * Check if a collection is queryable
   */
  isCollectionAllowed(collectionName) {
    return this.collections[collectionName]?.allowed === true;
  },

  /**
   * Check if an operation is allowed
   */
  isOperationAllowed(operation) {
    return this.operations[operation]?.allowed === true;
  },

  /**
   * Check if an aggregation stage is allowed
   */
  isAggregationStageAllowed(stageName) {
    return this.aggregationStages[stageName]?.allowed === true;
  },

  /**
   * Get the reason why an aggregation stage is not allowed
   */
  getAggregationStageBlockReason(stageName) {
    const stage = this.aggregationStages[stageName];
    if (!stage) return 'Unknown aggregation stage';
    if (stage.allowed) return null;
    return stage.reason || 'Not allowed';
  },

  /**
   * Check if an accumulator operator is allowed
   */
  isAccumulatorAllowed(accumulatorName) {
    return this.accumulators[accumulatorName]?.allowed === true;
  },

  /**
   * Get the reason why an accumulator is not allowed
   */
  getAccumulatorBlockReason(accumulatorName) {
    const acc = this.accumulators[accumulatorName];
    if (!acc) return 'Unknown accumulator operator';
    if (acc.allowed) return null;
    return acc.reason || 'Not allowed';
  },

  /**
   * Get all allowed fields for a collection
   */
  getFieldsForCollection(collectionName) {
    return this.collections[collectionName]?.fields || {};
  },

  /**
   * Check if a field exists and is allowed for a collection
   */
  isFieldAllowed(collectionName, fieldName) {
    return this.collections[collectionName]?.fields[fieldName] !== undefined;
  },

  /**
   * Check if a field can be filtered
   */
  isFieldFilterable(collectionName, fieldName) {
    return this.collections[collectionName]?.fields[fieldName]?.filterable === true;
  },

  /**
   * Check if a field can be sorted
   */
  isFieldSortable(collectionName, fieldName) {
    return this.collections[collectionName]?.fields[fieldName]?.sortable === true;
  },

  /**
   * Check if a field can be projected
   */
  isFieldProjectable(collectionName, fieldName) {
    return this.collections[collectionName]?.fields[fieldName]?.projectable === true;
  },

  /**
   * Check if an operator is allowed
   */
  isOperatorAllowed(operatorName) {
    return this.operators[operatorName]?.allowed === true;
  },

  /**
   * Get the reason why an operator is not allowed
   */
  getOperatorBlockReason(operatorName) {
    const op = this.operators[operatorName];
    if (!op) return 'Unknown operator';
    if (op.allowed) return null;
    return op.reason || 'Not allowed';
  },

  /**
   * Get field type
   */
  getFieldType(collectionName, fieldName) {
    return this.collections[collectionName]?.fields[fieldName]?.type || null;
  },
};

export default databaseSchema;
