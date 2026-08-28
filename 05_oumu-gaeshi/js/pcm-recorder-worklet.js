class PcmRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunkSize = 2048;
    this.chunk = new Float32Array(this.chunkSize);
    this.offset = 0;
  }

  process(inputs) {
    const input = inputs[0];
    const channel = input && input[0];
    if (!channel) return true;

    let sourceOffset = 0;
    while (sourceOffset < channel.length) {
      const writable = Math.min(this.chunkSize - this.offset, channel.length - sourceOffset);
      this.chunk.set(channel.subarray(sourceOffset, sourceOffset + writable), this.offset);
      this.offset += writable;
      sourceOffset += writable;

      if (this.offset === this.chunkSize) {
        this.port.postMessage(this.chunk.buffer, [this.chunk.buffer]);
        this.chunk = new Float32Array(this.chunkSize);
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor("pcm-recorder", PcmRecorderProcessor);
