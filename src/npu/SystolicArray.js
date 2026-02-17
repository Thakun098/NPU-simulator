export class SystolicArray {
  constructor(rows, cols) {
    this.rows = rows;
    this.cols = cols;
    this.grid = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ val: 0, a: 0, b: 0 })),
    );
  }

  reset() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.grid[r][c] = { val: 0, a: 0, b: 0 };
      }
    }
  }

  // Input data for a cycle
  // leftInputs: Array of values for each row from the left
  // topInputs: Array of values for each col from the top
  step(leftInputs, topInputs) {
    const newGrid = JSON.parse(JSON.stringify(this.grid)); // Deep copy for simultaneous update

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        // Get inputs
        const inA = c === 0 ? leftInputs[r] || 0 : this.grid[r][c - 1].a;
        const inB = r === 0 ? topInputs[c] || 0 : this.grid[r - 1][c].b;

        // MAC Operation: C = C + A * B
        newGrid[r][c].val = this.grid[r][c].val + inA * inB;

        // Pass inputs to next cell
        newGrid[r][c].a = inA;
        newGrid[r][c].b = inB;
      }
    }
    this.grid = newGrid;
  }

  getOutputs() {
    return this.grid.map((row) => row.map((cell) => cell.val));
  }
}
