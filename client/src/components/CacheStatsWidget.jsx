import React from 'react';

export default function CacheStatsWidget({ stats }) {
  if (!stats) return null;

  const totalQueries = stats.totalQueries ?? 0;
  const totalCacheHits = stats.totalCacheHits ?? 0;
  const totalCacheMisses = stats.totalCacheMisses ?? 0;
  const totalExecutions = stats.totalExecutions ?? 0;

  // Convert decimal rate (e.g. 0.615) to percentage (e.g. 61.5%)
  const rawHitRate = stats.avgCacheHitRate ?? (totalExecutions > 0 ? totalCacheHits / totalExecutions : 0);
  const hitRatePercentage = Math.round(rawHitRate * 1000) / 10;
  const clampedPercentage = Math.max(0, Math.min(100, hitRatePercentage));

  return (
    <div className="stats-widget-container">
      <div className="stats-header">
        <h3 className="stats-title">Query Cache Performance</h3>
        <span className="stats-badge">Live Analytics</span>
      </div>

      <div className="stats-metrics-grid">
        <div className="stat-card">
          <span className="stat-label">Total Executions</span>
          <span className="stat-value">{totalExecutions.toLocaleString()}</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Cache Hits</span>
          <span className="stat-value text-green">{totalCacheHits.toLocaleString()}</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Cache Misses</span>
          <span className="stat-value text-blue">{totalCacheMisses.toLocaleString()}</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Unique Questions</span>
          <span className="stat-value text-purple">{totalQueries.toLocaleString()}</span>
        </div>
      </div>

      <div className="cache-hit-rate-section">
        <div className="hit-rate-header">
          <span className="hit-rate-label">Average Cache Hit Rate</span>
          <span className="hit-rate-number">{hitRatePercentage}%</span>
        </div>
        <div className="hit-rate-progress-bg">
          <div
            className="hit-rate-progress-fill"
            style={{ width: `${clampedPercentage}%` }}
            role="progressbar"
            aria-valuenow={clampedPercentage}
            aria-valuemin="0"
            aria-valuemax="100"
          />
        </div>
        <div className="hit-rate-legend">
          <span>0% (All AI Generated)</span>
          <span>100% (Fully Cached)</span>
        </div>
      </div>
    </div>
  );
}
