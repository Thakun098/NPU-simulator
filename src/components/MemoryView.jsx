import React from 'react';

const MemoryView = ({ memory, title = "Memory", highlightReads = [], highlightWrites = [] }) => {
  if (!memory) return null;

  const dataSlice = Array.from(memory.data).slice(0, 64);
  const readSet = new Set(highlightReads);
  const writeSet = new Set(highlightWrites);

  return (
    <div className="memory-view-container">
      <h3>
        <span className="icon">{title.includes('DRAM') ? '💾' : '🔲'}</span> {title}
      </h3>

      {/* Legend */}
      <div className="mem-legend">
        <span className="legend-item"><span className="legend-dot read-dot"></span> Read</span>
        <span className="legend-item"><span className="legend-dot write-dot"></span> Write</span>
        <span className="legend-item"><span className="legend-dot data-dot"></span> Has Data</span>
      </div>

      <div className="mem-grid">
        {/* Header row */}
        <div className="mem-header">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="mem-col-label">+{i}</div>
          ))}
        </div>

        {/* Memory cells */}
        {dataSlice.map((val, index) => {
          const isRead = readSet.has(index);
          const isWrite = writeSet.has(index);
          const hasData = val !== 0;

          let cellClass = 'mem-cell';
          if (isWrite) cellClass += ' mem-write';
          else if (isRead) cellClass += ' mem-read';
          else if (hasData) cellClass += ' mem-has-data';

          // Row label every 8 cells
          const showRowLabel = index % 8 === 0;

          return (
            <React.Fragment key={index}>
              {showRowLabel && (
                <div className="mem-row-label">{index}</div>
              )}
              <div
                className={cellClass}
                title={`Addr: ${index} | Val: ${val}`}
              >
                {hasData ? val.toFixed(0) : '·'}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default MemoryView;
