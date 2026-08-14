/**
 * TalkDB API Service
 *
 * Client-side HTTP service communicating with the TalkDB backend.
 * Provides helper functions for query asking and health checks.
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
  checkHealth,
};
