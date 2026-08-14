import React from 'react';

const SUGGESTIONS = [
  'Show all students',
  'Show courses with 4 credits',
  'Count CS students',
  'Average CGPA by branch',
];

export default function QueryInput({
  question,
  setQuestion,
  onSubmit,
  loading,
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!question || !question.trim() || loading) return;
    onSubmit(question.trim());
  };

  const handleSuggestionClick = (suggestion) => {
    setQuestion(suggestion);
    if (!loading) {
      onSubmit(suggestion);
    }
  };

  return (
    <div className="query-input-container">
      <form onSubmit={handleSubmit} className="query-form">
        <div className="input-group">
          <input
            id="natural-language-query-input"
            type="text"
            className="query-text-input"
            placeholder="Ask a question in plain English (e.g. 'Show CS students with CGPA > 8.5')..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading}
            autoComplete="off"
          />
          <button
            id="submit-query-btn"
            type="submit"
            className="query-submit-btn"
            disabled={loading || !question.trim()}
          >
            {loading ? (
              <span className="btn-loading-state">
                <span className="spinner" />
                <span>Searching...</span>
              </span>
            ) : (
              <span>Ask TalkDB</span>
            )}
          </button>
        </div>
      </form>

      <div className="suggestions-container">
        <span className="suggestions-label">Try asking:</span>
        <div className="suggestions-chips">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="suggestion-chip"
              onClick={() => handleSuggestionClick(suggestion)}
              disabled={loading}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
