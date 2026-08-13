/**
 * Question Normalizer
 * 
 * Converts natural language questions to a normalized form for cache matching.
 * Deterministic only - no AI/semantic matching.
 */

/**
 * Normalize a user question for cache matching
 * 
 * @param {string} question - The user's question
 * @returns {string|null} - Normalized question or null if invalid
 */
export const normalizeQuestion = (question) => {
  // Validate input
  if (typeof question !== 'string') {
    return null;
  }

  // Trim, lowercase, normalize spaces
  let normalized = question.trim().toLowerCase();
  normalized = normalized.replace(/\s+/g, ' ');

  // Normalize common database aliases
  const aliases = {
    '\\bcs\\b': 'computer science',
    '\\bcse\\b': 'computer science',
    '\\bece\\b': 'electronics',
    '\\bmech\\b': 'mechanical',
    '\\bee\\b': 'electrical',
    '\\bcg?pa\\b': 'cgpa',
  };

  for (const [pattern, replacement] of Object.entries(aliases)) {
    normalized = normalized.replace(new RegExp(pattern, 'g'), replacement);
  }

  // Normalize punctuation (remove trailing question marks, extra spaces again)
  normalized = normalized.replace(/[?!.]*\s*$/, '').trim();
  normalized = normalized.replace(/\s+/g, ' ');

  return normalized;
};

export default normalizeQuestion;
