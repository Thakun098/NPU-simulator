/**
 * CpuCore — Simulates sequential (scalar) matrix multiplication
 * like a traditional CPU would do it: one multiply-accumulate at a time.
 */
export class CpuCore {
  constructor(size = 4) {
    this.size = size;
    this.matA = [];
    this.matB = [];
    this.matC = [];
    this.status = "IDLE";
    this.cycleCount = 0;
    this.log = [];

    // Sequential iteration state
    this._i = 0;
    this._j = 0;
    this._k = 0;
    this._totalOps = 0;
    this._doneOps = 0;

    // For highlighting which cells are being accessed
    this.activeA = null; // { row, col }
    this.activeB = null;
    this.activeC = null;
    this.lastAccumValue = 0;
  }

  loadMatrices(A, B) {
    this.size = A.length;
    this.matA = A.map((row) => [...row]);
    this.matB = B.map((row) => [...row]);
    this.matC = Array.from({ length: this.size }, () =>
      new Array(this.size).fill(0),
    );
    this._i = 0;
    this._j = 0;
    this._k = 0;
    this._totalOps = this.size * this.size * this.size;
    this._doneOps = 0;
    this.cycleCount = 0;
    this.status = "READY";
    this.log = [];
    this.activeA = null;
    this.activeB = null;
    this.activeC = null;
    this._addLog(
      "INIT",
      `Loaded ${this.size}×${this.size} matrices. Total ops: ${this._totalOps}`,
    );
  }

  reset() {
    this.matA = [];
    this.matB = [];
    this.matC = [];
    this.status = "IDLE";
    this.cycleCount = 0;
    this.log = [];
    this._i = 0;
    this._j = 0;
    this._k = 0;
    this._totalOps = 0;
    this._doneOps = 0;
    this.activeA = null;
    this.activeB = null;
    this.activeC = null;
  }

  _addLog(action, detail) {
    this.log.push({ cycle: this.cycleCount, action, detail });
    if (this.log.length > 100) this.log.shift();
  }

  step() {
    if (this.status === "FINISHED") return;
    if (this._doneOps >= this._totalOps) {
      this.status = "FINISHED";
      this._addLog(
        "DONE",
        `Matrix multiply complete in ${this.cycleCount} cycles`,
      );
      this.activeA = null;
      this.activeB = null;
      this.activeC = null;
      return;
    }

    this.status = "RUNNING";

    const i = this._i;
    const j = this._j;
    const k = this._k;

    // One MAC operation: C[i][j] += A[i][k] * B[k][j]
    const aVal = this.matA[i][k];
    const bVal = this.matB[k][j];
    const product = aVal * bVal;
    this.matC[i][j] += product;

    this.activeA = { row: i, col: k };
    this.activeB = { row: k, col: j };
    this.activeC = { row: i, col: j };
    this.lastAccumValue = this.matC[i][j];

    this._addLog(
      "MAC",
      `C[${i}][${j}] += A[${i}][${k}](${aVal}) × B[${k}][${j}](${bVal}) = ${product} → acc=${this.matC[i][j].toFixed(2)}`,
    );

    this._doneOps++;
    this.cycleCount++;

    // Advance k → j → i (innermost loop is k)
    this._k++;
    if (this._k >= this.size) {
      this._k = 0;
      this._j++;
      if (this._j >= this.size) {
        this._j = 0;
        this._i++;
      }
    }

    if (this._doneOps >= this._totalOps) {
      this.status = "FINISHED";
      this._addLog("DONE", `Complete! ${this.cycleCount} cycles`);
    }
  }

  get progress() {
    if (this._totalOps === 0) return 0;
    return this._doneOps / this._totalOps;
  }
}
