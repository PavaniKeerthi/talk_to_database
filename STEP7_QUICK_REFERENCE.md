# STEP 7: AI Query Generator - Quick Reference

## Overview
The AI Query Generator converts natural language questions to structured MongoDB queries. It's integrated with the POST /api/query/ask endpoint.

## Curl Examples

### 1. Ask a Natural Language Question (Cache Miss)
```bash
curl -X POST http://localhost:4000/api/query/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Show all computer science students"}'
```

**Response**:
```json
{
  "success": true,
  "cacheHit": false,
  "question": "Show all computer science students",
  "normalizedQuestion": "show all computer science students",
  "query": {
    "collectionName": "students",
    "operation": "find",
    "filter": {
      "branch": "Computer Science"
    }
  },
  "result": {
    "success": true,
    "operation": "find",
    "collectionName": "students",
    "data": [
      { "_id": "...", "name": "Alice", "branch": "Computer Science", "cgpa": 9.0, "year": 3 },
      { "_id": "...", "name": "Bob", "branch": "Computer Science", "cgpa": 8.7, "year": 2 }
    ],
    "count": 4,
    "executionTimeMs": 12
  }
}
```

### 2. Ask the Same Question Again (Cache Hit)
```bash
curl -X POST http://localhost:4000/api/query/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Show all computer science students"}'
```

**Response** (faster, uses cached query):
```json
{
  "success": true,
  "cacheHit": true,
  "question": "Show all computer science students",
  "normalizedQuestion": "show all computer science students",
  "query": {
    "collectionName": "students",
    "operation": "find",
    "filter": {
      "branch": "Computer Science"
    }
  },
  "result": {
    "success": true,
    "operation": "find",
    "collectionName": "students",
    "data": [...],
    "count": 4,
    "executionTimeMs": 6
  }
}
```

### 3. CGPA Filtering
```bash
curl -X POST http://localhost:4000/api/query/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Show students with CGPA above 8.5"}'
```

### 4. Count Queries
```bash
curl -X POST http://localhost:4000/api/query/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "How many students are in Computer Science?"}'
```

### 5. Top N Students
```bash
curl -X POST http://localhost:4000/api/query/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Show the top 5 students by CGPA"}'
```

---

## Configuration

### Development (Using Mock AI - No API Costs)
```bash
export NO_AI=true
npm run dev
```

### Production (Using Real OpenAI)
```bash
export OPENAI_API_KEY="sk-proj-..."
npm run dev
```

### Tests (Always Uses Mock AI)
```bash
npm test  # Automatically sets NO_AI=true
```

---

## Supported Question Patterns

### Show All
- "Show all students"
- "Display all students"
- "Get all students"

### Filter by Branch
- "Show CS students"
- "Show computer science students"
- "Show electronics students"
- "Show mechanical students"
- "Show electrical students"

### Filter by CGPA
- "Show students with CGPA above 8.5"
- "Show students with CGPA > 8"
- "Students with CGPA greater than 8.5"

### Count Queries
- "How many students?"
- "Count all students"
- "How many computer science students?"
- "Count CS students"

### Top N
- "Show top 5 students by CGPA"
- "Show top 10 students by CGPA"
- "Top students by CGPA"

### Year Filtering
- "Show year 1 students"
- "Show year 2 students"
- "Show year 3 students"
- "Show year 4 students"

---

## Error Responses

### Invalid Question
```json
{
  "success": false,
  "error": "Question could not be normalized."
}
```

### AI Generation Failed
```json
{
  "success": false,
  "cacheHit": false,
  "error": "AI could not generate a query. Try rephrasing your question."
}
```

### Validation Failed
```json
{
  "success": false,
  "cacheHit": false,
  "generatedQuery": { ... },
  "error": "Generated query failed validation: ...",
  "message": "The AI-generated query did not pass security validation. This is a safety measure."
}
```

### Missing Question Field
```json
{
  "success": false,
  "error": "Missing or invalid \"question\" field. Must be a string."
}
```

---

## Database Schema (Queryable Fields)

```javascript
{
  name: "string",           // Can filter, sort
  branch: "string",         // Can filter, sort
  cgpa: "number",           // Can filter, sort, compare
  year: "number",           // Can filter, sort
  _id: "objectId",          // Not filterable, but projectable
  createdAt: "date",        // System field, not exposed
  updatedAt: "date"         // System field, not exposed
}
```

### Supported Branches
- "Computer Science"
- "Electronics"
- "Mechanical"
- "Electrical"

---

## Behind the Scenes

### What Happens When You Ask a Question

1. **Normalization**
   - "Show CS students" → "show computer science students"
   - Question marks and punctuation removed
   - Lowercase for matching

2. **Cache Lookup**
   - Check if this normalized question was asked before
   - If yes, use cached structured query

3. **AI Generation** (if cache miss)
   - Send normalized question to AI provider
   - AI generates structured MongoDB query
   - Query is plain JSON object, not executable code

4. **Validation** ← SECURITY BOUNDARY
   - Check if generated query is valid
   - Reject write operations
   - Reject unknown fields
   - Reject dangerous operators
   - If validation fails, DO NOT execute

5. **Execution**
   - Only if validation passed
   - Build MongoDB query using Mongoose
   - Execute against database
   - Return results

6. **Caching**
   - Store question + query + results in history
   - Future similar questions hit cache
   - Speeds up repeated queries

---

## Security Features

✅ **Strict Validation**
- Every AI-generated query validated before execution
- Unknown fields rejected
- Write operations blocked

✅ **No Code Execution**
- Queries are plain JSON objects
- No eval(), Function(), or dynamic code
- No __proto__ or prototype pollution

✅ **No Credentials Leakage**
- MongoDB credentials never sent to client
- Stack traces not exposed
- Error messages are generic

✅ **No Injection Attacks**
- Operator whitelist enforced
- Values type-checked
- Nested objects sanitized recursively

---

## Testing

### Run All Tests
```bash
cd server
node src/utils/testAIQueryGenerator.js
node src/utils/testQueryAPI.js
node src/utils/testQueryValidator.js
node src/utils/testQueryExecutor.js
node src/utils/testQueryCache.js
```

### All Tests Should Pass
- Query Validator: 57/57 ✓
- Query Executor: 20/20 ✓
- Query Cache: 8/8 ✓
- AI Query Generator: 24/24 ✓
- Query API: 8/8 ✓

---

## Troubleshooting

### "AI could not generate a query"
**Cause**: AI provider not configured or couldn't generate valid query
**Solution**: 
- For testing: `export NO_AI=true`
- For production: `export OPENAI_API_KEY="..."`

### "Generated query failed validation"
**Cause**: AI tried to use unsupported field/operator
**Solution**: This is working as designed. Try a simpler question or rephrase.

### "Collection students is not supported"
**Cause**: Only students collection is supported in STEP 7
**Solution**: Wait for STEP 8 (dynamic schema discovery)

### No results returned
**Cause**: Query was valid but no matching documents
**Solution**: Query succeeded, just no data matches your criteria

---

## Performance Tips

1. **Cache is Your Friend**
   - Same question asked twice? 2nd is much faster
   - Usually 5-10ms vs 500-2000ms

2. **Specific Questions are Better**
   - "CS students" is faster than "Show me students"
   - Filters reduce result set size

3. **Avoid Open-Ended Questions**
   - "Show all students" returns 10 documents
   - "Show top 5" is more efficient

4. **AI Generation Takes Time**
   - First query: 500-2000ms (AI + validation + execution)
   - Cached query: 5-10ms
   - Use cache when possible

---

## API Endpoint Reference

### POST /api/query/ask
**Purpose**: Ask a natural language question

**Request**:
```json
{
  "question": "Show CS students"
}
```

**Response** (success):
```json
{
  "success": true,
  "cacheHit": false,
  "question": "Show CS students",
  "normalizedQuestion": "show computer science students",
  "query": { ... },
  "result": { ... }
}
```

**Response** (error):
```json
{
  "success": false,
  "error": "Error message"
}
```

**Status Codes**:
- 200: Question processed (check success field)
- 400: Missing/invalid question
- 500: Internal server error

---

## Next Step (STEP 8)

Currently, only the "students" collection is supported. STEP 8 will add:
- **Dynamic schema discovery** from MongoDB
- Support for multiple collections
- Auto-detection of queryable fields
- Dynamic field validation

For now, all queries must reference the students collection.
