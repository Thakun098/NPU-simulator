import { useState, useEffect, useRef } from 'react';
import './App.css';
import { NpuCore } from './npu/Core';
import { ISA } from './npu/Instructions';
import SystolicArrayView from './components/SystolicArrayView';
import MemoryView from './components/MemoryView';
import ExecutionLog from './components/ExecutionLog';
import ComparisonView from './components/ComparisonView';

const EXAMPLE_PROGRAMS = [
  {
    name: '2×2 Matrix Multiply',
    description: 'A(2×2) × B(2×2) with ReLU activation',
    setup: (npu) => {
      // Matrix A (2×2) at DRAM[0..3]
      // | 1  2 |
      // | 3  4 |
      npu.memory.loadData(0, [1, 2, 0, 0, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

      // Matrix B (2×2) at DRAM[16..19]
      // | 5  6 |
      // | 7  8 |
      npu.memory.loadData(16, [5, 6, 0, 0, 7, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

      return [
        { type: ISA.LOAD, srcAddr: 0, destAddr: 0, size: 16 },     // Load A → SRAM[0..15]
        { type: ISA.LOAD, srcAddr: 16, destAddr: 16, size: 16 },    // Load B → SRAM[16..31]
        { type: ISA.GEMM, addrA: 0, addrB: 16, addrC: 32 },        // C = A × B → SRAM[32..47]
        { type: ISA.ACTIVATE, fn: 'relu', addr: 32, size: 16 },     // ReLU on C
        { type: ISA.STORE, srcAddr: 32, destAddr: 48, size: 16 },   // Store C → DRAM[48..63]
      ];
    },
  },
  {
    name: 'Identity Matrix Test',
    description: 'Multiply by Identity: result should equal input',
    setup: (npu) => {
      // Matrix A = | 2  3  0  0 |
      //            | 4  5  0  0 |
      //            | 0  0  0  0 |
      //            | 0  0  0  0 |
      npu.memory.loadData(0, [2, 3, 0, 0, 4, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

      // Matrix B = Identity
      // | 1  0  0  0 |
      // | 0  1  0  0 |
      // | 0  0  1  0 |
      // | 0  0  0  1 |
      npu.memory.loadData(16, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

      return [
        { type: ISA.LOAD, srcAddr: 0, destAddr: 0, size: 16 },
        { type: ISA.LOAD, srcAddr: 16, destAddr: 16, size: 16 },
        { type: ISA.GEMM, addrA: 0, addrB: 16, addrC: 32 },
        { type: ISA.STORE, srcAddr: 32, destAddr: 48, size: 16 },
      ];
    },
  },
  {
    name: 'Negative Values + Sigmoid',
    description: 'Matrix with negative values, then Sigmoid activation',
    setup: (npu) => {
      npu.memory.loadData(0, [1, -2, 0, 0, -3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      npu.memory.loadData(16, [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

      return [
        { type: ISA.LOAD, srcAddr: 0, destAddr: 0, size: 16 },
        { type: ISA.LOAD, srcAddr: 16, destAddr: 16, size: 16 },
        { type: ISA.GEMM, addrA: 0, addrB: 16, addrC: 32 },
        { type: ISA.ACTIVATE, fn: 'sigmoid', addr: 32, size: 16 },
        { type: ISA.STORE, srcAddr: 32, destAddr: 48, size: 16 },
      ];
    },
  },
];

function App() {
  const [page, setPage] = useState('simulator'); // 'simulator' | 'compare'
  const [tick, setTick] = useState(0);
  const npuRef = useRef(new NpuCore(1024, 4));
  const npu = npuRef.current;
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(500);
  const [selectedProgram, setSelectedProgram] = useState(0);

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        npu.step();
        setTick(t => t + 1);
        if (npu.status === 'FINISHED') {
          setIsRunning(false);
        }
      }, speed);
    }
    return () => clearInterval(interval);
  }, [isRunning, speed]);

  const handleStep = () => {
    npu.step();
    setTick(t => t + 1);
  };

  const handleReset = () => {
    npu.reset();
    setTick(0);
    setIsRunning(false);
  };

  const loadProgram = (index) => {
    setIsRunning(false);
    npu.reset();
    const prog = EXAMPLE_PROGRAMS[index];
    const instructions = prog.setup(npu);
    npu.loadProgram(instructions);
    setSelectedProgram(index);
    setTick(t => t + 1);
  };

  const statusClass = {
    'IDLE': 'status-idle',
    'READY': 'status-ready',
    'RUNNING': 'status-running',
    'FINISHED': 'status-finished',
  }[npu.status] || '';

  if (page === 'compare') {
    return <ComparisonView onBack={() => setPage('simulator')} />;
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo">⚙️ NPU</div>
          <h1>Neural Processing Unit Simulator</h1>
        </div>
        <div className="header-center">
          <button className="btn btn-nav" onClick={() => setPage('compare')}>
            ⚡ CPU vs NPU Comparison
          </button>
        </div>
        <div className="header-right">
          <div className={`status-badge ${statusClass}`}>
            {npu.status}
          </div>
          <div className="cycle-counter">
            Cycle <span className="cycle-num">{npu.cycleCount}</span>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-group">
          <label className="toolbar-label">Program:</label>
          <select
            value={selectedProgram}
            onChange={(e) => loadProgram(Number(e.target.value))}
            className="program-select"
          >
            {EXAMPLE_PROGRAMS.map((p, i) => (
              <option key={i} value={i}>{p.name}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => loadProgram(selectedProgram)}>
            ⏏ Load
          </button>
        </div>

        <div className="toolbar-group">
          <button className="btn btn-accent" onClick={handleStep} disabled={isRunning || npu.status === 'FINISHED'}>
            ⏭ Step
          </button>
          <button
            className={`btn ${isRunning ? 'btn-warning' : 'btn-success'}`}
            onClick={() => setIsRunning(!isRunning)}
            disabled={npu.status === 'FINISHED' || npu.status === 'IDLE'}
          >
            {isRunning ? '⏸ Pause' : '▶ Run'}
          </button>
          <button className="btn btn-danger" onClick={handleReset}>
            ⟳ Reset
          </button>
        </div>

        <div className="toolbar-group">
          <label className="toolbar-label">Speed:</label>
          <input
            type="range"
            min="100"
            max="2000"
            step="100"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="speed-slider"
          />
          <span className="speed-label">{speed}ms</span>
        </div>
      </div>

      {/* Program description */}
      {npu.status !== 'IDLE' && (
        <div className="program-info">
          <strong>{EXAMPLE_PROGRAMS[selectedProgram].name}</strong>
          <span className="sep">—</span>
          {EXAMPLE_PROGRAMS[selectedProgram].description}
          <span className="sep">|</span>
          PC: {npu.pc}/{npu.instructions.length}
          {npu._gemmActive && <span className="gemm-indicator"> 🔥 GEMM Wavefront {npu._gemmCycle}/{npu._gemmTotalCycles}</span>}
        </div>
      )}

      {/* Main Layout */}
      <div className="main-layout">
        {/* Left: Memory */}
        <div className="panel panel-memory">
          <MemoryView
            memory={npu.memory}
            title="Main Memory (DRAM)"
            highlightReads={npu.lastMemoryReads}
            highlightWrites={npu.lastMemoryWrites}
          />
          <MemoryView
            memory={npu.buffer}
            title="Unified Buffer (SRAM)"
            highlightReads={npu.lastBufferReads}
            highlightWrites={npu.lastBufferWrites}
          />
        </div>

        {/* Center: Systolic Array */}
        <div className="panel panel-array">
          <SystolicArrayView
            systolicArray={npu.systolicArray}
            gemmActive={npu._gemmActive}
          />
        </div>

        {/* Right: Instructions + Log */}
        <div className="panel panel-right">
          <div className="instr-panel">
            <h3><span className="icon">📝</span> Instructions</h3>
            <div className="instruction-list">
              {npu.instructions.length === 0 && (
                <div className="instr-empty">No program loaded</div>
              )}
              {npu.instructions.map((inst, idx) => (
                <div
                  key={idx}
                  className={`instr-item ${idx === npu.pc ? 'instr-current' : ''} ${idx < npu.pc ? 'instr-done' : ''}`}
                >
                  <span className="instr-idx">{idx}</span>
                  <span className="instr-type">{inst.type}</span>
                  {inst.fn && <span className="instr-detail">({inst.fn})</span>}
                </div>
              ))}
            </div>
          </div>
          <ExecutionLog log={npu.log} />
        </div>
      </div>
    </div>
  );
}

export default App;
