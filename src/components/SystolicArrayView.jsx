import React from 'react';

const SystolicArrayView = ({ systolicArray, gemmActive }) => {
  if (!systolicArray) return null;

  const grid = systolicArray.grid;
  const maxVal = Math.max(1, ...grid.flat().map(c => Math.abs(c.val)));

  return (
    <div className="systolic-array-container">
      <h3>
        <span className="icon">⚡</span> Systolic Array (MAC Units)
        {gemmActive && <span className="badge pulse">COMPUTING</span>}
      </h3>

      {/* Data flow labels */}
      <div className="array-wrapper">
        <div className="flow-label flow-top">
          <span>▼ Matrix B (from top)</span>
        </div>
        <div className="flow-label flow-left">
          <span>▶ Matrix A<br/>(from left)</span>
        </div>

        <div
          className="array-grid"
          style={{
            gridTemplateColumns: `repeat(${systolicArray.cols}, 1fr)`,
          }}
        >
          {grid.map((row, rIndex) =>
            row.map((cell, cIndex) => {
              const intensity = maxVal > 0 ? Math.abs(cell.val) / maxVal : 0;
              const isActive = cell.a !== 0 || cell.b !== 0;

              return (
                <div
                  key={`${rIndex}-${cIndex}`}
                  className={`array-cell ${isActive ? 'cell-active' : ''}`}
                  style={{
                    '--intensity': intensity,
                  }}
                >
                  <div className="cell-val">{cell.val.toFixed(1)}</div>
                  <div className="cell-inputs">
                    <span className="cell-a" title="A input (left)">A:{cell.a.toFixed(0)}</span>
                    <span className="cell-b" title="B input (top)">B:{cell.b.toFixed(0)}</span>
                  </div>
                  <div className="cell-label">PE({rIndex},{cIndex})</div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default SystolicArrayView;
