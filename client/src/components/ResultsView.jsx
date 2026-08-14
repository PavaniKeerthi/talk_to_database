import React from 'react';

function formatCellValue(value, key, isAggregate) {
  if (value === null || value === undefined) {
    if (isAggregate && key === '_id') {
      return <span className="cell-null">Total / All</span>;
    }
    return <span className="cell-null">—</span>;
  }
  if (typeof value === 'boolean') {
    return <span className={`cell-bool ${value ? 'bool-true' : 'bool-false'}`}>{value ? 'true' : 'false'}</span>;
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  }
  if (typeof value === 'object') {
    return <span className="cell-json">{JSON.stringify(value)}</span>;
  }
  return String(value);
}

export default function ResultsView({ result, collectionName }) {
  if (!result) return null;

  const isCountOperation = result.operation === 'count' || typeof result.data === 'number';
  const isAggregate = result.operation === 'aggregate';

  if (isCountOperation) {
    const countValue = typeof result.data === 'number' ? result.data : result.count ?? 0;
    const targetName = result.collectionName || collectionName || 'records';

    return (
      <div className="results-card count-result-card">
        <div className="count-metric-header">
          <span className="count-metric-label">Total {targetName} Matching Query</span>
          {result.executionTimeMs !== undefined && (
            <span className="execution-time-tag">{result.executionTimeMs} ms</span>
          )}
        </div>
        <div className="count-metric-value">{countValue.toLocaleString()}</div>
      </div>
    );
  }

  // Document array result (for find and aggregate)
  const documents = Array.isArray(result.data) ? result.data : [];

  if (documents.length === 0) {
    return (
      <div className="results-card empty-results-card">
        <div className="empty-results-icon">📂</div>
        <h3 className="empty-results-title">No documents found</h3>
        <p className="empty-results-desc">
          No records in <strong>{result.collectionName || collectionName || 'the database'}</strong> matched your search criteria.
        </p>
      </div>
    );
  }

  // Collect all unique keys from documents
  const allKeys = Array.from(
    new Set(
      documents.flatMap((doc) =>
        typeof doc === 'object' && doc !== null ? Object.keys(doc) : []
      )
    )
  );

  let sortedKeys;
  if (isAggregate) {
    // For aggregation, put _id (grouping key) first, followed by computed metrics
    sortedKeys = [
      ...allKeys.filter((k) => k === '_id'),
      ...allKeys.filter((k) => k !== '_id' && !['__v', 'createdAt', 'updatedAt'].includes(k)),
    ];
  } else {
    // Reorder columns for find: visible business fields first, _id and timestamps last
    const priorityKeys = ['name', 'title', 'code', 'branch', 'cgpa', 'year', 'credits', 'instructor'];
    sortedKeys = [
      ...priorityKeys.filter((k) => allKeys.includes(k)),
      ...allKeys.filter((k) => !priorityKeys.includes(k) && !['_id', '__v', 'createdAt', 'updatedAt'].includes(k)),
      ...allKeys.filter((k) => ['_id', 'createdAt', 'updatedAt'].includes(k)),
    ];
  }

  const targetName = result.collectionName || collectionName || 'documents';

  return (
    <div className="results-card table-result-card">
      <div className="table-header-info">
        <div className="results-count-title">
          <span className="results-badge">{documents.length}</span>
          <span>
            {isAggregate
              ? `${documents.length === 1 ? 'group / metric' : 'groups / metrics'} in `
              : `${documents.length === 1 ? 'record' : 'records'} found in `}
            <strong className="collection-highlight">{targetName}</strong>
          </span>
        </div>
        {result.executionTimeMs !== undefined && (
          <span className="execution-time-tag">{result.executionTimeMs} ms</span>
        )}
      </div>

      <div className="table-responsive-wrapper">
        <table className="results-data-table">
          <thead>
            <tr>
              <th className="row-number-th">#</th>
              {sortedKeys.map((key) => {
                let headerText = key;
                if (isAggregate && key === '_id') {
                  headerText = 'Group / Category';
                }
                return (
                  <th key={key} scope="col">
                    {headerText}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {documents.map((row, idx) => (
              <tr key={row._id !== undefined && row._id !== null ? String(row._id) : idx} className="data-row">
                <td className="row-number-td">{idx + 1}</td>
                {sortedKeys.map((key) => (
                  <td key={key} className={`cell-${key}`}>
                    {formatCellValue(row[key], key, isAggregate)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
