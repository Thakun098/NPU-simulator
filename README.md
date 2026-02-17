# NPU Simulator

A cycle-accurate NPU (Neural Processing Unit) functional simulator built with React and Vite.

## Features

- **Architecture**: Simulates Instruction Memory, Unified Buffer, and a 4x4 Systolic Array.
- **ISA**: Supports LOAD, STORE, GEMM, ACTIVATE instructions.
- **Visualization**: Real-time view of Memory, Buffer, and Systolic Array state.

## Setup & Run

The project files are already created. You just need to install dependencies and run the server.

1.  Open a terminal in this folder:
    ```bash
    cd c:/Users/sanak/OneDrive/Desktop/NPU
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```
4.  Open your browser at the URL shown (usually `http://localhost:5173`).

## Usage

- Click **Load Program** to load a sample GEMM program.
- Click **Step** to execute one cycle at a time.
- Click **Run** to auto-step.
