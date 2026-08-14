import React, { useState } from 'react';

export default function QueryInspector({ queryDetails }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!queryDetails || !queryDetails.query) return null;

  const { query, cacheHit, executionTimeMs, collectionName, operation } = queryDetails;

  return (
    <div className="query-inspector-container">
      <button
        type="button"
        className="inspector-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className="inspector-toggle-left">
          <span className={`toggle-arrow ${isOpen ? 'open' : ''}`}>▶</span>
          <span className="inspector-title">Query & Execution Inspector</span>
        </div>
        <div className="inspector-badges">
          <span className={`status-badge ${cacheHit ? 'badge-cache-hit' : 'badge-cache-miss'}`}>
            {cacheHit ? '⚡ Cache Hit' : '🤖 Generated / Cache Miss'}
          </span>
          {operation && (
            <span className="info-badge">
              {String(operation).toUpperCase()} on {collectionName || query.collectionName}
            </span>
          )}
          {executionTimeMs !== undefined && (
            <span className="time-badge">{executionTimeMs} ms</span>
          )}
        </div>
      </button>

      {isOpen && (
        <div className="inspector-content">
          <div className="inspector-section-label">
            <span>Structured MongoDB Query Object</span>
            <span className="readonly-tag">Validated & Read-Only</span>
          </div>
          <pre className="query-json-pre">
            <code>{JSON.stringify(query, null, 2)}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
