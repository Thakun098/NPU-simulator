export class Memory {
  constructor(size) {
    this.size = size;
    this.data = new Float32Array(size);
  }

  read(address) {
    if (address < 0 || address >= this.size) {
      console.warn(`Memory Read Out of Bounds: ${address}`);
      return 0;
    }
    return this.data[address];
  }

  write(address, value) {
    if (address < 0 || address >= this.size) {
      console.warn(`Memory Write Out of Bounds: ${address}`);
      return;
    }
    this.data[address] = value;
  }

  reset() {
    this.data.fill(0);
  }

  loadData(offset, dataArray) {
    for (let i = 0; i < dataArray.length; i++) {
      this.write(offset + i, dataArray[i]);
    }
  }
}
