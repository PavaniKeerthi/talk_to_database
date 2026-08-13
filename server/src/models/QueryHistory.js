import mongoose from 'mongoose';

/**
 * QueryHistory Schema
 * 
 * Stores every query executed in TalkDB, including:
 * - The original user question
 * - The normalized question (for cache matching)
 * - The structured query that was executed
 * - Usage statistics (cache hits, execution count)
 * - Timestamps (when created, last used)
 * 
 * This enables:
 * 1. Query caching (find previous similar questions)
 * 2. Analytics (which queries are most popular?)
 * 3. AI Training (patterns for future AI query generator)
 * 4. Performance Monitoring (which queries are slow?)
 */

const queryHistorySchema = new mongoose.Schema(
  {
    // The original question as entered by the user
    // e.g. "Show me all CS students"
    originalQuestion: {
      type: String,
      required: true,
      trim: true,
    },

    // The normalized question (lowercase, trimmed, alias-replaced)
    // e.g. "show me all computer science students"
    // Used for cache matching and deduplication
    normalizedQuestion: {
      type: String,
      required: true,
      trim: true,
      index: true,  // Index for fast cache lookups
    },

    // The structured MongoDB query that was executed
    // This is a JSON object, NOT executable JavaScript
    // Example:
    // {
    //   "collection": "students",
    //   "operation": "find",
    //   "filter": { "branch": "Computer Science" },
    //   "projection": { "name": 1, "branch": 1, "cgpa": 1 },
    //   "sort": { "name": 1 }
    // }
    structuredQuery: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      validate: {
        validator: function(v) {
          // Ensure it's a plain object, not a function or executable code
          return typeof v === 'object' && v !== null && !['_id'].includes(Object.keys(v)[0]);
        },
        message: 'structuredQuery must be a valid query object',
      },
    },

    // Which collection was queried
    // e.g. "students"
    collectionName: {
      type: String,
      required: true,
      enum: ['students'],  // Whitelist allowed collections
    },

    // Which operation was performed
    // e.g. "find", "count", "aggregate"
    operation: {
      type: String,
      required: true,
      enum: ['find', 'count', 'aggregate'],  // Whitelist allowed operations
    },

    // Total number of times this query has been used/executed
    // Incremented on each cache hit or new execution
    usageCount: {
      type: Number,
      default: 1,
      min: 1,
    },

    // Number of times this query was retrieved from cache (cache hits)
    cacheHits: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Number of times this query was NOT found in cache (cache misses / new queries)
    cacheMisses: {
      type: Number,
      default: 1,
      min: 0,
    },

    // Optional: result count from last execution
    // Useful for analytics: "this query usually returns ~50 documents"
    lastResultCount: {
      type: Number,
      default: null,
    },

    // Optional: execution time in milliseconds
    // Useful for performance monitoring
    lastExecutionTimeMs: {
      type: Number,
      default: null,
    },

    // Timestamp: when this query was first stored
    // Automatically set by Mongoose
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // Timestamp: when this query record was last updated
    // Automatically set by Mongoose on updates
    updatedAt: {
      type: Date,
      default: Date.now,
    },

    // Timestamp: when this query was last executed
    // Used to track recency and identify stale queries
    lastUsedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    // Mongoose automatically manages createdAt and updatedAt
    timestamps: true,
    // Collection name in MongoDB
    collection: 'queryHistory',
  }
);

// Compound index for faster cache lookups
// Searches by normalizedQuestion ordered by lastUsedAt (most recent first)
queryHistorySchema.index({ normalizedQuestion: 1, lastUsedAt: -1 });

// Index for analytics: find most frequently used queries
queryHistorySchema.index({ usageCount: -1 });

// Index for finding recent queries
queryHistorySchema.index({ createdAt: -1 });

// Pre-save middleware: ensure updatedAt is current
queryHistorySchema.pre('save', async function() {
  this.updatedAt = new Date();
});

/**
 * Instance method: increment usage statistics
 * Called when a cached query is used
 */
queryHistorySchema.methods.recordCacheHit = function() {
  this.usageCount += 1;
  this.cacheHits += 1;
  this.lastUsedAt = new Date();
  return this.save();
};

/**
 * Instance method: increment usage statistics and execution metadata
 * Called after a query is executed
 */
queryHistorySchema.methods.recordExecution = function(resultCount = null, executionTimeMs = null) {
  this.usageCount += 1;
  this.cacheMisses += 1;  // If we're calling this, it's a new execution
  this.lastUsedAt = new Date();
  if (resultCount !== null) {
    this.lastResultCount = resultCount;
  }
  if (executionTimeMs !== null) {
    this.lastExecutionTimeMs = executionTimeMs;
  }
  return this.save();
};

/**
 * Static method: find a cached query by normalized question
 * Returns the most recent/most frequently used match
 */
queryHistorySchema.statics.findByNormalizedQuestion = function(normalizedQuestion) {
  return this.findOne({ normalizedQuestion })
    .sort({ lastUsedAt: -1 })
    .exec();
};

/**
 * Static method: get cache statistics
 * Useful for analytics and monitoring
 */
queryHistorySchema.statics.getCacheStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalQueries: { $sum: 1 },
        totalCacheHits: { $sum: '$cacheHits' },
        totalCacheMisses: { $sum: '$cacheMisses' },
        totalExecutions: { $sum: '$usageCount' },
        avgCacheHitRate: { $avg: { $divide: ['$cacheHits', '$usageCount'] } },
      },
    },
  ]);

  if (stats.length === 0) {
    return {
      totalQueries: 0,
      totalCacheHits: 0,
      totalCacheMisses: 0,
      totalExecutions: 0,
      avgCacheHitRate: 0,
    };
  }

  return stats[0];
};

/**
 * Static method: get top N most frequently used queries
 */
queryHistorySchema.statics.getTopQueries = function(limit = 10) {
  return this.find()
    .sort({ usageCount: -1 })
    .limit(limit)
    .exec();
};

const QueryHistory = mongoose.model('QueryHistory', queryHistorySchema);

export default QueryHistory;
