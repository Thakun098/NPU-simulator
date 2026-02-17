export const ISA = {
  LOAD: "LOAD", // Load data from main memory to buffer
  STORE: "STORE", // Store data from buffer to main memory
  GEMM: "GEMM", // General Matrix Multiply
  ACTIVATE: "ACTIVATE", // Apply activation function
  WAIT: "WAIT", // No-op / Wait
};

export const OPCODES = {
  [ISA.LOAD]: 0x01,
  [ISA.STORE]: 0x02,
  [ISA.GEMM]: 0x03,
  [ISA.ACTIVATE]: 0x04,
  [ISA.WAIT]: 0x00,
};
