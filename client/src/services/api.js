/**
 * TalkDB API Service
 *
 * Client-side HTTP service communicating with the TalkDB backend.
 * Provides helper functions for querying, history, stats, schema, and capabilities.
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Ask a natural language question
 *
 * @param {string} question - Natural language question
 * @returns {Promise<Object>} - Backend response { success, cacheHit, query, result, ... }
 */
export async function askQuestion(question) {
  if (!question || typeof question !== 'string' || !question.trim()) {
    throw new Error('Please enter a question to ask.');
  }

  try {
    const res = await fetch(`${API_BASE}/api/query/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question: question.trim() }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.error || `Server error: HTTP ${res.status}`);
    }

    if (!data) {
      throw new Error('Received an empty response from the server.');
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.toLowerCase().includes('fetch')) {
      throw new Error('Unable to connect to TalkDB backend. Please ensure the backend server is running on port 5000.');
    }
    throw err;
  }
}

/**
 * Fetch recent query history
 *
 * @param {number} limit - Maximum number of queries to fetch
 * @returns {Promise<Object>} - { success: true, count: number, queries: Array }
 */
export async function getQueryHistory(limit = 10) {
  try {
    const res = await fetch(`${API_BASE}/api/query/history?limit=${limit}`);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.error || `Server error: HTTP ${res.status}`);
    }

    if (!data) {
      throw new Error('Received an empty response from the server.');
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.toLowerCase().includes('fetch')) {
      throw new Error('Unable to connect to TalkDB backend.');
    }
    throw err;
  }
}

/**
 * Fetch cache analytics and query statistics
 *
 * @returns {Promise<Object>} - { success: true, stats: Object }
 */
export async function getQueryStats() {
  try {
    const res = await fetch(`${API_BASE}/api/query/history/stats`);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.error || `Server error: HTTP ${res.status}`);
    }

    if (!data) {
      throw new Error('Received an empty response from the server.');
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.toLowerCase().includes('fetch')) {
      throw new Error('Unable to connect to TalkDB backend.');
    }
    throw err;
  }
}

/**
 * Fetch discovered database schema
 *
 * @returns {Promise<Object>} - { success: true, schema: Object }
 */
export async function getSchema() {
  try {
    const res = await fetch(`${API_BASE}/api/query/schema`);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.error || `Server error: HTTP ${res.status}`);
    }

    if (!data) {
      throw new Error('Received an empty response from the server.');
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.toLowerCase().includes('fetch')) {
      throw new Error('Unable to connect to TalkDB backend.');
    }
    throw err;
  }
}

/**
 * Fetch collection capabilities
 *
 * @returns {Promise<Object>} - { success: true, capabilities: Object }
 */
export async function getCapabilities() {
  try {
    const res = await fetch(`${API_BASE}/api/query/capabilities`);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.error || `Server error: HTTP ${res.status}`);
    }

    if (!data) {
      throw new Error('Received an empty response from the server.');
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.toLowerCase().includes('fetch')) {
      throw new Error('Unable to connect to TalkDB backend.');
    }
    throw err;
  }
}

/**
 * Check backend health status
 *
 * @returns {Promise<Object>} - { ok: boolean, data?: Object, error?: string }
 */
export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) return { ok: false, status: res.status };
    const data = await res.json().catch(() => null);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export default {
  askQuestion,
  getQueryHistory,
  getQueryStats,
  getSchema,
  getCapabilities,
  checkHealth,
};
