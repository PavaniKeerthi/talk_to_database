import React, { useState, useEffect, useCallback } from 'react';
import {
  askQuestion,
  getQueryHistory,
  getQueryStats,
  getSchema,
  getCapabilities,
} from './services/api';
import QueryInput from './components/QueryInput';
import ResultsView from './components/ResultsView';
import QueryInspector from './components/QueryInspector';
import HistoryList from './components/HistoryList';
import CacheStatsWidget from './components/CacheStatsWidget';
import SchemaExplorer from './components/SchemaExplorer';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState('query');

  // Query Chat State (STEP 18)
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [queryDetails, setQueryDetails] = useState(null);
  const [error, setError] = useState(null);

  // Metadata Dashboard State (STEP 19)
  const [historyData, setHistoryData] = useState([]);
  const [statsData, setStatsData] = useState(null);
  const [schemaData, setSchemaData] = useState(null);
  const [capabilitiesData, setCapabilitiesData] = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState(null);

  // Load history and cache stats
  const fetchHistoryAndStats = useCallback(async () => {
    setMetaLoading(true);
    setMetaError(null);
    try {
      const [historyRes, statsRes] = await Promise.all([
        getQueryHistory(20),
        getQueryStats(),
      ]);

      if (historyRes?.queries) {
        setHistoryData(historyRes.queries);
      }
      if (statsRes?.stats) {
        setStatsData(statsRes.stats);
      }
    } catch (err) {
      setMetaError(err.message || 'Failed to load query history and stats.');
    } finally {
      setMetaLoading(false);
    }
  }, []);

  // Load schema and capabilities
  const fetchSchemaAndCapabilities = useCallback(async () => {
    setMetaLoading(true);
    setMetaError(null);
    try {
      const [schemaRes, capsRes] = await Promise.all([
        getSchema(),
        getCapabilities(),
      ]);

      if (schemaRes?.schema) {
        setSchemaData(schemaRes.schema);
      }
      if (capsRes?.capabilities) {
        setCapabilitiesData(capsRes.capabilities);
      }
    } catch (err) {
      setMetaError(err.message || 'Failed to load database schema.');
    } finally {
      setMetaLoading(false);
    }
  }, []);

  // Fetch tab data on tab switch
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistoryAndStats();
    } else if (activeTab === 'schema') {
      fetchSchemaAndCapabilities();
    }
  }, [activeTab, fetchHistoryAndStats, fetchSchemaAndCapabilities]);

  // Execute question via POST /api/query/ask
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

  // Re-run historical query (switches to Query tab and invokes ask API)
  const handleReplayQuery = (questionText) => {
    setQuestion(questionText);
    setActiveTab('query');
    handleQuerySubmit(questionText);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-badge">TalkDB v1.0</div>
        <h1 className="app-title">Natural Language Database Explorer</h1>
        <p className="app-subtitle">
          Query student and course records instantly using plain English questions.
        </p>

        {/* Tab Navigation */}
        <nav className="tab-navigation" aria-label="Main Navigation">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'query' ? 'active' : ''}`}
            onClick={() => setActiveTab('query')}
          >
            <span className="tab-icon">💬</span>
            <span>Query Chat</span>
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <span className="tab-icon">📜</span>
            <span>History & Analytics</span>
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'schema' ? 'active' : ''}`}
            onClick={() => setActiveTab('schema')}
          >
            <span className="tab-icon">🗄️</span>
            <span>Database Schema</span>
          </button>
        </nav>
      </header>

      <main className="app-main">
        {/* ==================================================================
            TAB 1: QUERY CHAT (STEP 18)
            ================================================================== */}
        {activeTab === 'query' && (
          <div className="tab-pane query-tab-pane">
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
          </div>
        )}

        {/* ==================================================================
            TAB 2: HISTORY & ANALYTICS (STEP 19)
            ================================================================== */}
        {activeTab === 'history' && (
          <div className="tab-pane history-tab-pane">
            <div className="pane-action-bar">
              <span className="pane-action-title">Query History & Cache Performance</span>
              <button
                type="button"
                className="refresh-btn"
                onClick={fetchHistoryAndStats}
                disabled={metaLoading}
              >
                {metaLoading ? 'Refreshing...' : '↻ Refresh Data'}
              </button>
            </div>

            {metaError && (
              <div className="error-alert" role="alert">
                <div className="error-icon">⚠️</div>
                <div className="error-content">
                  <strong className="error-title">History Error</strong>
                  <p className="error-message">{metaError}</p>
                </div>
              </div>
            )}

            <CacheStatsWidget stats={statsData} />

            <HistoryList
              history={historyData}
              onReplayQuery={handleReplayQuery}
            />
          </div>
        )}

        {/* ==================================================================
            TAB 3: DATABASE SCHEMA & CAPABILITIES (STEP 19)
            ================================================================== */}
        {activeTab === 'schema' && (
          <div className="tab-pane schema-tab-pane">
            <div className="pane-action-bar">
              <span className="pane-action-title">Discovered Schema & Capabilities</span>
              <button
                type="button"
                className="refresh-btn"
                onClick={fetchSchemaAndCapabilities}
                disabled={metaLoading}
              >
                {metaLoading ? 'Refreshing...' : '↻ Re-discover Schema'}
              </button>
            </div>

            {metaError && (
              <div className="error-alert" role="alert">
                <div className="error-icon">⚠️</div>
                <div className="error-content">
                  <strong className="error-title">Schema Error</strong>
                  <p className="error-message">{metaError}</p>
                </div>
              </div>
            )}

            <SchemaExplorer
              schemaData={schemaData}
              capabilitiesData={capabilitiesData}
            />
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>TalkDB is secured by strict read-only schema validation & AI query sanitization.</p>
      </footer>
    </div>
  );
}
