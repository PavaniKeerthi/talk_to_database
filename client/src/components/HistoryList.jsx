import React from 'react';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString();
  } catch (e) {
    return dateStr;
  }
}

export default function HistoryList({ history, onReplayQuery }) {
  if (!history || history.length === 0) {
    return (
      <div className="history-empty-card">
        <div className="empty-icon">📜</div>
        <h3>No Query History Yet</h3>
        <p>Ask questions in the Query Chat tab to populate history and monitor caching.</p>
      </div>
    );
  }

  return (
    <div className="history-list-container">
      <div className="history-list-header">
        <h3 className="history-title">Recent Query Log</h3>
        <span className="history-count-badge">{history.length} Queries</span>
      </div>

      <div className="history-items-stack">
        {history.map((item) => (
          <div key={item._id || item.originalQuestion} className="history-item-card">
            <div className="history-item-main">
              <div className="history-question-row">
                <span className="history-question-text">"{item.originalQuestion}"</span>
                <button
                  type="button"
                  className="replay-query-btn"
                  onClick={() => onReplayQuery(item.originalQuestion)}
                  title="Run this question again"
                >
                  <span>⚡ Re-run</span>
                </button>
              </div>

              <div className="history-meta-row">
                <span className="meta-badge meta-collection">
                  {item.collectionName || 'unknown'}
                </span>
                <span className="meta-badge meta-operation">
                  {String(item.operation || 'find').toUpperCase()}
                </span>
                <span className="meta-stat">
                  Uses: <strong>{item.usageCount ?? 1}</strong>
                </span>
                <span className="meta-stat text-green">
                  Hits: <strong>{item.cacheHits ?? 0}</strong>
                </span>
                <span className="meta-stat text-blue">
                  Misses: <strong>{item.cacheMisses ?? 1}</strong>
                </span>
                {item.lastResultCount !== null && item.lastResultCount !== undefined && (
                  <span className="meta-stat">
                    Results: <strong>{item.lastResultCount}</strong>
                  </span>
                )}
                {item.lastExecutionTimeMs !== null && item.lastExecutionTimeMs !== undefined && (
                  <span className="meta-stat text-amber">
                    {item.lastExecutionTimeMs} ms
                  </span>
                )}
                <span className="meta-time">
                  {formatDate(item.lastUsedAt || item.createdAt)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
