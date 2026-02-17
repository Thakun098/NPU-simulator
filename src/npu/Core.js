import { Memory } from "./Memory";
import { SystolicArray } from "./SystolicArray";
import { ISA } from "./Instructions";

export class NpuCore {
  constructor(memSize = 1024, arraySize = 4) {
    this.arraySize = arraySize;
    this.memory = new Memory(memSize);
    this.buffer = new Memory(256);
    this.systolicArray = new SystolicArray(arraySize, arraySize);
    this.pc = 0;
    this.instructions = [];
    this.status = "IDLE";
    this.cycleCount = 0;
    this.log = [];

    // Track memory accesses for UI highlighting
    this.lastMemoryReads = [];
    this.lastMemoryWrites = [];
    this.lastBufferReads = [];
    this.lastBufferWrites = [];

    // GEMM multi-cycle sub-state
    this._gemmCycle = 0;
    this._gemmTotalCycles = 0;
    this._gemmActive = false;
    this._gemmAddrA = 0;
    this._gemmAddrB = 0;
    this._gemmAddrC = 0;
  }

  loadProgram(instructions) {
    this.instructions = instructions;
    this.pc = 0;
    this.status = "READY";
    this.cycleCount = 0;
    this.log = [];
    this.systolicArray.reset();
    this.buffer.reset();
    this._gemmActive = false;
    this._clearAccessTracking();
    this._addLog("Program loaded", `${instructions.length} instructions`);
  }

  reset() {
    this.memory.reset();
    this.buffer.reset();
    this.systolicArray.reset();
    this.pc = 0;
    this.instructions = [];
    this.status = "IDLE";
    this.cycleCount = 0;
    this.log = [];
    this._gemmActive = false;
    this._clearAccessTracking();
  }

  _clearAccessTracking() {
    this.lastMemoryReads = [];
    this.lastMemoryWrites = [];
    this.lastBufferReads = [];
    this.lastBufferWrites = [];
  }

  _addLog(action, detail) {
    this.log.push({
      cycle: this.cycleCount,
      pc: this.pc,
      action,
      detail,
    });
    // Keep log size manageable
    if (this.log.length > 100) this.log.shift();
  }

  step() {
    if (
      this.status === "FINISHED" ||
      (!this._gemmActive && this.pc >= this.instructions.length)
    ) {
      this.status = "FINISHED";
      return;
    }

    this._clearAccessTracking();
    this.status = "RUNNING";

    if (this._gemmActive) {
      this._stepGemm();
    } else {
      const instruction = this.instructions[this.pc];
      this._execute(instruction);
    }

    this.cycleCount++;
  }

  _execute(instr) {
    switch (instr.type) {
      case ISA.LOAD:
        this._execLoad(instr);
        break;
      case ISA.STORE:
        this._execStore(instr);
        break;
      case ISA.GEMM:
        this._execGemmStart(instr);
        break;
      case ISA.ACTIVATE:
        this._execActivate(instr);
        break;
      case ISA.WAIT:
        this._addLog("WAIT", "No-op");
        this.pc++;
        break;
      default:
        this._addLog("ERROR", `Unknown instruction: ${instr.type}`);
        this.pc++;
    }
  }

  // ─── LOAD: Main Memory → Buffer ───
  _execLoad(instr) {
    const reads = [];
    const writes = [];
    for (let i = 0; i < instr.size; i++) {
      const val = this.memory.read(instr.srcAddr + i);
      this.buffer.write(instr.destAddr + i, val);
      reads.push(instr.srcAddr + i);
      writes.push(instr.destAddr + i);
    }
    this.lastMemoryReads = reads;
    this.lastBufferWrites = writes;
    this._addLog(
      "LOAD",
      `DRAM[${instr.srcAddr}..${instr.srcAddr + instr.size - 1}] → SRAM[${instr.destAddr}..${instr.destAddr + instr.size - 1}]`,
    );
    this.pc++;
  }

  // ─── STORE: Buffer → Main Memory ───
  _execStore(instr) {
    const reads = [];
    const writes = [];
    for (let i = 0; i < instr.size; i++) {
      const val = this.buffer.read(instr.srcAddr + i);
      this.memory.write(instr.destAddr + i, val);
      reads.push(instr.srcAddr + i);
      writes.push(instr.destAddr + i);
    }
    this.lastBufferReads = reads;
    this.lastMemoryWrites = writes;
    this._addLog(
      "STORE",
      `SRAM[${instr.srcAddr}..${instr.srcAddr + instr.size - 1}] → DRAM[${instr.destAddr}..${instr.destAddr + instr.size - 1}]`,
    );
    this.pc++;
  }

  // ─── GEMM: Multi-cycle wavefront ───
  // Reads Matrix A (row-major) and Matrix B (col-major) from Buffer,
  // feeds them into the Systolic Array one diagonal at a time.
  _execGemmStart(instr) {
    const n = this.arraySize;
    this._gemmAddrA = instr.addrA ?? 0; // Buffer start for A (n×n)
    this._gemmAddrB = instr.addrB ?? n * n; // Buffer start for B (n×n)
    this._gemmAddrC = instr.addrC ?? 2 * n * n; // Buffer dest for C
    this._gemmCycle = 0;
    this._gemmTotalCycles = 2 * n - 1; // wavefront needs 2n-1 cycles
    this._gemmActive = true;
    this.systolicArray.reset();
    this._addLog(
      "GEMM START",
      `A@${this._gemmAddrA} × B@${this._gemmAddrB} → C@${this._gemmAddrC} (${this._gemmTotalCycles} cycles)`,
    );
    this._stepGemm(); // execute first cycle immediately
  }

  _stepGemm() {
    const n = this.arraySize;
    const t = this._gemmCycle;
    const leftInputs = new Array(n).fill(0);
    const topInputs = new Array(n).fill(0);
    const bufReads = [];

    // Wavefront: at cycle t, PE(r,c) receives data if r+c == t
    // Feed row r from left at cycle t if t-r is a valid column index [0..n-1]
    for (let r = 0; r < n; r++) {
      const col = t - r; // which column of A to feed
      if (col >= 0 && col < n) {
        const addr = this._gemmAddrA + r * n + col;
        leftInputs[r] = this.buffer.read(addr);
        bufReads.push(addr);
      }
    }

    // Feed col c from top at cycle t if t-c is a valid row index [0..n-1]
    for (let c = 0; c < n; c++) {
      const row = t - c; // which row of B to feed
      if (row >= 0 && row < n) {
        const addr = this._gemmAddrB + row * n + c;
        topInputs[c] = this.buffer.read(addr);
        bufReads.push(addr);
      }
    }

    this.lastBufferReads = bufReads;
    this.systolicArray.step(leftInputs, topInputs);
    this._addLog(
      "GEMM CYCLE",
      `Wavefront t=${t}: left=[${leftInputs.map((v) => v.toFixed(1))}] top=[${topInputs.map((v) => v.toFixed(1))}]`,
    );

    this._gemmCycle++;

    if (this._gemmCycle >= this._gemmTotalCycles) {
      // GEMM done — write results back to buffer
      const outputs = this.systolicArray.getOutputs();
      const bufWrites = [];
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const addr = this._gemmAddrC + r * n + c;
          this.buffer.write(addr, outputs[r][c]);
          bufWrites.push(addr);
        }
      }
      this.lastBufferWrites = bufWrites;
      this._gemmActive = false;
      this._addLog(
        "GEMM DONE",
        `Results written to SRAM[${this._gemmAddrC}..${this._gemmAddrC + n * n - 1}]`,
      );
      this.pc++;
    }
  }

  // ─── ACTIVATE: Apply activation function on Buffer data ───
  _execActivate(instr) {
    const fn = instr.fn || "relu";
    const addr = instr.addr ?? 0;
    const size = instr.size ?? this.arraySize * this.arraySize;
    const reads = [];
    const writes = [];

    for (let i = 0; i < size; i++) {
      const a = addr + i;
      let val = this.buffer.read(a);
      reads.push(a);

      switch (fn) {
        case "relu":
          val = Math.max(0, val);
          break;
        case "sigmoid":
          val = 1 / (1 + Math.exp(-val));
          break;
        case "tanh":
          val = Math.tanh(val);
          break;
        default:
          val = Math.max(0, val); // default to relu
      }

      this.buffer.write(a, val);
      writes.push(a);
    }

    this.lastBufferReads = reads;
    this.lastBufferWrites = writes;
    this._addLog(
      "ACTIVATE",
      `${fn.toUpperCase()} on SRAM[${addr}..${addr + size - 1}]`,
    );
    this.pc++;
  }
}
