import React, { useState } from 'react';

export default function SchemaExplorer({ schemaData, capabilitiesData }) {
  // Store expanded state per collection (default all open)
  const [expandedCollections, setExpandedCollections] = useState({});

  const toggleCollection = (collectionName) => {
    setExpandedCollections((prev) => ({
      ...prev,
      [collectionName]: !prev[collectionName],
    }));
  };

  const collectionsObj = schemaData?.collections || {};
  const capabilitiesObj = capabilitiesData || {};
  const collectionNames = Object.keys(collectionsObj);

  if (collectionNames.length === 0) {
    return (
      <div className="schema-empty-card">
        <div className="empty-icon">🗄️</div>
        <h3>No Schema Discovered</h3>
        <p>Database inspection could not find available collections.</p>
      </div>
    );
  }

  return (
    <div className="schema-explorer-container">
      <div className="schema-explorer-header">
        <div>
          <h3 className="schema-title">Database Schema & Collections</h3>
          <p className="schema-subtitle">
            Discovered MongoDB collections, field types, and query engine capabilities.
          </p>
        </div>
        <span className="schema-count-badge">
          {collectionNames.length} Collections
        </span>
      </div>

      <div className="schema-collections-grid">
        {collectionNames.map((colName) => {
          const colInfo = collectionsObj[colName] || {};
          const capInfo = capabilitiesObj[colName] || {};
          const isExpanded = expandedCollections[colName] !== false; // default true
          const fieldsObj = colInfo.fields || {};
          const fieldNames = Object.keys(fieldsObj);

          const isQueryable = capInfo.queryable ?? true;
          const isExecutable = capInfo.executable ?? true;
          const hasModel = capInfo.hasModel ?? true;

          return (
            <div key={colName} className="schema-collection-card">
              <div
                className="collection-card-header"
                onClick={() => toggleCollection(colName)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    toggleCollection(colName);
                  }
                }}
              >
                <div className="collection-header-left">
                  <span className={`collection-toggle-icon ${isExpanded ? 'open' : ''}`}>
                    ▶
                  </span>
                  <div className="collection-name-group">
                    <h4 className="collection-name">{colName}</h4>
                    {colInfo.docCount !== null && colInfo.docCount !== undefined && (
                      <span className="doc-count-tag">
                        {colInfo.docCount} {colInfo.docCount === 1 ? 'doc' : 'docs'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="collection-capabilities-badges">
                  <span className={`cap-badge ${isQueryable ? 'cap-queryable' : 'cap-disabled'}`}>
                    {isQueryable ? '✓ Queryable' : '✕ Not Queryable'}
                  </span>
                  <span className={`cap-badge ${isExecutable ? 'cap-executable' : 'cap-disabled'}`}>
                    {isExecutable ? '✓ Executable' : '✕ No Model'}
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className="collection-fields-panel">
                  {fieldNames.length === 0 ? (
                    <p className="no-fields-text">No fields discovered for this collection.</p>
                  ) : (
                    <div className="fields-table-wrapper">
                      <table className="fields-table">
                        <thead>
                          <tr>
                            <th>Field Name</th>
                            <th>Detected Type(s)</th>
                            <th>Sample / Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fieldNames.map((fieldName) => {
                            const field = fieldsObj[fieldName] || {};
                            const typesArray = Array.isArray(field.types)
                              ? field.types
                              : field.types
                              ? [String(field.types)]
                              : ['unknown'];
                            const exampleStr = Array.isArray(field.examples) && field.examples.length > 0
                              ? String(field.examples[0])
                              : '—';

                            return (
                              <tr key={fieldName}>
                                <td className="field-name-cell">
                                  <code>{fieldName}</code>
                                </td>
                                <td>
                                  <div className="type-pills-row">
                                    {typesArray.map((t) => (
                                      <span key={t} className={`type-pill type-${t}`}>
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="field-example-cell">
                                  {exampleStr}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
