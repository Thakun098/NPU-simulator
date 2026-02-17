import React, { useState, useEffect, useRef } from 'react';
import { NpuCore } from '../npu/Core';
import { CpuCore } from '../npu/CpuCore';
import { ISA } from '../npu/Instructions';

const MATRIX_PRESETS = [
  {
    name: '2×2 Simple',
    A: [[1, 2, 0, 0], [3, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    B: [[5, 6, 0, 0], [7, 8, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
  },
  {
    name: '3×3 Dense',
    A: [[1, 2, 3, 0], [4, 5, 6, 0], [7, 8, 9, 0], [0, 0, 0, 0]],
    B: [[9, 8, 7, 0], [6, 5, 4, 0], [3, 2, 1, 0], [0, 0, 0, 0]],
  },
  {
    name: '4×4 Full',
    A: [[1, 2, 3, 4], [5, 6, 7, 8], [1, 3, 5, 7], [2, 4, 6, 8]],
    B: [[8, 6, 4, 2], [7, 5, 3, 1], [1, 2, 3, 4], [5, 6, 7, 8]],
  },
];

const MatrixGrid = ({ matrix, title, activeCell, highlightColor, size = 4 }) => {
  return (
    <div className="cmp-matrix">
      <div className="cmp-matrix-title">{title}</div>
      <div className="cmp-matrix-grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {matrix.map((row, r) =>
          row.map((val, c) => {
            const isActive = activeCell && activeCell.row === r && activeCell.col === c;
            return (
              <div
                key={`${r}-${c}`}
                className={`cmp-cell ${isActive ? 'cmp-cell-active' : ''} ${val !== 0 ? 'cmp-cell-data' : ''}`}
                style={isActive ? { '--hl-color': highlightColor } : {}}
              >
                {val === 0 ? '·' : Number.isInteger(val) ? val : val.toFixed(1)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const ComparisonView = ({ onBack }) => {
  const [tick, setTick] = useState(0);
  const [preset, setPreset] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(300);
  const [cpuFinished, setCpuFinished] = useState(false);
  const [npuFinished, setNpuFinished] = useState(false);

  const cpuRef = useRef(new CpuCore(4));
  const npuRef = useRef(new NpuCore(1024, 4));
  const cpu = cpuRef.current;
  const npu = npuRef.current;

  const loadPreset = (index) => {
    setIsRunning(false);
    setCpuFinished(false);
    setNpuFinished(false);
    setPreset(index);

    const p = MATRIX_PRESETS[index];
    const flatA = p.A.flat();
    const flatB = p.B.flat();

    // CPU setup
    cpu.loadMatrices(p.A, p.B);

    // NPU setup
    npu.reset();
    npu.memory.loadData(0, flatA);
    npu.memory.loadData(16, flatB);
    const program = [
      { type: ISA.LOAD, srcAddr: 0, destAddr: 0, size: 16 },
      { type: ISA.LOAD, srcAddr: 16, destAddr: 16, size: 16 },
      { type: ISA.GEMM, addrA: 0, addrB: 16, addrC: 32 },
      { type: ISA.STORE, srcAddr: 32, destAddr: 48, size: 16 },
    ];
    npu.loadProgram(program);
    setTick(t => t + 1);
  };

  // Auto-run
  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        let cpuDone = cpu.status === 'FINISHED';
        let npuDone = npu.status === 'FINISHED';

        if (!cpuDone) cpu.step();
        if (!npuDone) npu.step();

        cpuDone = cpu.status === 'FINISHED';
        npuDone = npu.status === 'FINISHED';

        setCpuFinished(cpuDone);
        setNpuFinished(npuDone);
        setTick(t => t + 1);

        if (cpuDone && npuDone) {
          setIsRunning(false);
        }
      }, speed);
    }
    return () => clearInterval(interval);
  }, [isRunning, speed]);

  const handleStep = () => {
    if (cpu.status !== 'FINISHED') cpu.step();
    if (npu.status !== 'FINISHED') npu.step();
    setCpuFinished(cpu.status === 'FINISHED');
    setNpuFinished(npu.status === 'FINISHED');
    setTick(t => t + 1);
  };

  const handleReset = () => {
    setIsRunning(false);
    cpu.reset();
    npu.reset();
    setCpuFinished(false);
    setNpuFinished(false);
    setTick(t => t + 1);
  };

  // Build NPU result matrix from buffer
  const npuResultMatrix = Array.from({ length: 4 }, (_, r) =>
    Array.from({ length: 4 }, (_, c) => {
      const addr = 32 + r * 4 + c;
      return npu.buffer.read(addr);
    })
  );

  // NPU systolic array state for result display
  const npuArrayMatrix = npu.systolicArray.grid.map(row =>
    row.map(cell => cell.val)
  );

  const cpuProgress = cpu.progress;
  const npuProgress = npu.status === 'FINISHED' ? 1 : (npu.status === 'IDLE' ? 0 : npu.cycleCount / 15);

  return (
    <div className="cmp-page">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <button className="btn btn-back" onClick={onBack}>← Back</button>
          <div className="logo">⚡ CPU vs NPU</div>
          <h1>Processing Comparison</h1>
        </div>
      </header>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-group">
          <label className="toolbar-label">Matrix:</label>
          <select
            className="program-select"
            value={preset}
            onChange={(e) => loadPreset(Number(e.target.value))}
          >
            {MATRIX_PRESETS.map((p, i) => (
              <option key={i} value={i}>{p.name}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => loadPreset(preset)}>⏏ Load</button>
        </div>

        <div className="toolbar-group">
          <button className="btn btn-accent" onClick={handleStep} disabled={isRunning || (cpuFinished && npuFinished)}>
            ⏭ Step
          </button>
          <button
            className={`btn ${isRunning ? 'btn-warning' : 'btn-success'}`}
            onClick={() => setIsRunning(!isRunning)}
            disabled={(cpuFinished && npuFinished) || cpu.status === 'IDLE'}
          >
            {isRunning ? '⏸ Pause' : '▶ Run'}
          </button>
          <button className="btn btn-danger" onClick={handleReset}>⟳ Reset</button>
        </div>

        <div className="toolbar-group">
          <label className="toolbar-label">Speed:</label>
          <input
            type="range"
            min="50"
            max="1000"
            step="50"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="speed-slider"
          />
          <span className="speed-label">{speed}ms</span>
        </div>
      </div>

      {/* Main comparison */}
      <div className="cmp-main">
        {/* ─── CPU Side ─── */}
        <div className="cmp-side cmp-cpu-side">
          <div className="cmp-header-bar">
            <span className="cmp-chip-icon">🖥️</span>
            <h2>CPU (Sequential)</h2>
            <div className={`status-badge ${cpuFinished ? 'status-finished' : cpu.status === 'RUNNING' ? 'status-running' : 'status-idle'}`}>
              {cpuFinished ? 'FINISHED' : cpu.status}
            </div>
          </div>

          <div className="cmp-stats">
            <div className="cmp-stat">
              <span className="cmp-stat-label">Cycles</span>
              <span className="cmp-stat-value cmp-cycles-cpu">{cpu.cycleCount}</span>
            </div>
            <div className="cmp-stat">
              <span className="cmp-stat-label">Ops Done</span>
              <span className="cmp-stat-value">{cpu._doneOps}/{cpu._totalOps}</span>
            </div>
          </div>

          <div className="cmp-progress-bar">
            <div className="cmp-progress-fill cmp-progress-cpu" style={{ width: `${cpuProgress * 100}%` }}></div>
          </div>

          <div className="cmp-desc">
            <code>for i → for j → for k → C[i][j] += A[i][k] × B[k][j]</code>
            <p>ทำทีละ 1 operation ต่อ cycle</p>
          </div>

          <div className="cmp-matrices">
            <MatrixGrid matrix={cpu.matA.length ? cpu.matA : [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]} title="Matrix A" activeCell={cpu.activeA} highlightColor="#f59e0b" />
            <div className="cmp-op">×</div>
            <MatrixGrid matrix={cpu.matB.length ? cpu.matB : [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]} title="Matrix B" activeCell={cpu.activeB} highlightColor="#06b6d4" />
            <div className="cmp-op">=</div>
            <MatrixGrid matrix={cpu.matC.length ? cpu.matC : [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]} title="Result C" activeCell={cpu.activeC} highlightColor="#10b981" />
          </div>

          {/* CPU Log */}
          <div className="cmp-log">
            <div className="cmp-log-title">Execution Log</div>
            <div className="cmp-log-entries">
              {cpu.log.slice(-8).map((entry, i) => (
                <div key={i} className="cmp-log-entry">
                  <span className="log-cycle">C{entry.cycle}</span>
                  <span className="log-detail">{entry.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── VS Divider ─── */}
        <div className="cmp-divider">
          <div className="cmp-vs">VS</div>
          {cpuFinished && npuFinished && (
            <div className="cmp-speedup">
              <div className="cmp-speedup-label">Speedup</div>
              <div className="cmp-speedup-value">
                {(cpu.cycleCount / Math.max(1, npu.cycleCount)).toFixed(1)}×
              </div>
              <div className="cmp-speedup-sub">faster</div>
            </div>
          )}
        </div>

        {/* ─── NPU Side ─── */}
        <div className="cmp-side cmp-npu-side">
          <div className="cmp-header-bar">
            <span className="cmp-chip-icon">⚡</span>
            <h2>NPU (Parallel)</h2>
            <div className={`status-badge ${npuFinished ? 'status-finished' : npu.status === 'RUNNING' ? 'status-running' : 'status-idle'}`}>
              {npuFinished ? 'FINISHED' : npu.status}
            </div>
          </div>

          <div className="cmp-stats">
            <div className="cmp-stat">
              <span className="cmp-stat-label">Cycles</span>
              <span className="cmp-stat-value cmp-cycles-npu">{npu.cycleCount}</span>
            </div>
            <div className="cmp-stat">
              <span className="cmp-stat-label">Stage</span>
              <span className="cmp-stat-value" style={{fontSize: '12px'}}>
                {npu.pc < npu.instructions.length ? npu.instructions[npu.pc]?.type || '—' : 'DONE'}
                {npu._gemmActive && ` (${npu._gemmCycle}/${npu._gemmTotalCycles})`}
              </span>
            </div>
          </div>

          <div className="cmp-progress-bar">
            <div className="cmp-progress-fill cmp-progress-npu" style={{ width: `${npuFinished ? 100 : npuProgress * 100}%` }}></div>
          </div>

          <div className="cmp-desc">
            <code>LOAD → GEMM (Systolic Array 4×4) → STORE</code>
            <p>16 PEs ทำงานพร้อมกัน</p>
          </div>

          {/* NPU Systolic Array mini-view */}
          <div className="cmp-matrices">
            <div className="cmp-npu-array">
              <div className="cmp-matrix-title">Systolic Array (4×4)</div>
              <div className="cmp-matrix-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {npu.systolicArray.grid.flat().map((cell, idx) => {
                  const isActive = cell.a !== 0 || cell.b !== 0 || cell.val !== 0;
                  return (
                    <div key={idx} className={`cmp-cell cmp-cell-npu ${isActive ? 'cmp-cell-active' : ''}`}
                      style={{ '--hl-color': '#3b82f6' }}>
                      {cell.val === 0 ? '·' : cell.val.toFixed(0)}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="cmp-op">→</div>
            <MatrixGrid
              matrix={npuFinished ? 
                Array.from({length: 4}, (_, r) => Array.from({length: 4}, (_, c) => npu.memory.read(48 + r*4 + c))) :
                npuResultMatrix
              }
              title={npuFinished ? "Result (DRAM)" : "Buffer (SRAM)"}
              activeCell={null}
              highlightColor="#10b981"
            />
          </div>

          {/* NPU Log */}
          <div className="cmp-log">
            <div className="cmp-log-title">Execution Log</div>
            <div className="cmp-log-entries">
              {npu.log.slice(-8).map((entry, i) => (
                <div key={i} className={`cmp-log-entry ${entry.action.includes('GEMM') ? 'log-gemm' : ''}`}>
                  <span className="log-cycle">C{entry.cycle}</span>
                  <span className="log-detail">{entry.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom summary */}
      {cpuFinished && npuFinished && (
        <div className="cmp-summary">
          <div className="cmp-summary-item">
            <span>🖥️ CPU:</span> <strong>{cpu.cycleCount} cycles</strong> (1 op/cycle × {cpu._totalOps} ops)
          </div>
          <div className="cmp-summary-item">
            <span>⚡ NPU:</span> <strong>{npu.cycleCount} cycles</strong> (16 PEs parallel + LOAD/STORE overhead)
          </div>
          <div className="cmp-summary-item cmp-summary-winner">
            🏆 NPU เร็วกว่า <strong>{(cpu.cycleCount / Math.max(1, npu.cycleCount)).toFixed(1)}×</strong>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComparisonView;
