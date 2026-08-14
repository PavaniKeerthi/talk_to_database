import React, { useState } from 'react';
import { askQuestion } from './services/api';
import QueryInput from './components/QueryInput';
import ResultsView from './components/ResultsView';
import QueryInspector from './components/QueryInspector';

export default function App() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [queryDetails, setQueryDetails] = useState(null);
  const [error, setError] = useState(null);

  const handleQuerySubmit = async (queryText) => {
    const textToAsk = queryText || question;
    if (!textToAsk || !textToAsk.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await askQuestion(textToAsk.trim());

      if (!response || response.success === false) {
        setError(response?.error || 'Failed to process question. Please try rephrasing.');
        setResult(null);
        setQueryDetails(null);
      } else {
        setResult(response.result);
        setQueryDetails({
          query: response.query,
          cacheHit: response.cacheHit,
          executionTimeMs: response.result?.executionTimeMs,
          collectionName: response.result?.collectionName,
          operation: response.result?.operation,
        });
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred while contacting the server.');
      setResult(null);
      setQueryDetails(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-badge">TalkDB v1.0</div>
        <h1 className="app-title">Natural Language Database Explorer</h1>
        <p className="app-subtitle">
          Query student and course records instantly using plain English questions.
        </p>
      </header>

      <main className="app-main">
        <section className="query-section" aria-label="Query Input">
          <QueryInput
            question={question}
            setQuestion={setQuestion}
            onSubmit={handleQuerySubmit}
            loading={loading}
          />
        </section>

        {error && (
          <div className="error-alert" role="alert">
            <div className="error-icon">⚠️</div>
            <div className="error-content">
              <strong className="error-title">Query Error</strong>
              <p className="error-message">{error}</p>
            </div>
            <button
              type="button"
              className="error-dismiss-btn"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {loading && (
          <div className="loading-card">
            <div className="spinner-large" />
            <p className="loading-text">Translating to MongoDB query & executing...</p>
          </div>
        )}

        {!loading && queryDetails && (
          <section className="inspector-section" aria-label="Query Inspector">
            <QueryInspector queryDetails={queryDetails} />
          </section>
        )}

        {!loading && result && (
          <section className="results-section" aria-label="Query Results">
            <ResultsView result={result} />
          </section>
        )}
      </main>

      <footer className="app-footer">
        <p>TalkDB is secured by strict read-only schema validation & AI query sanitization.</p>
      </footer>
    </div>
  );
}
