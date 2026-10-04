// AudioContext supplies mono 16 kHz samples. Batch them into PCM16 packets.
class SpeechProcessor extends AudioWorkletProcessor {
  constructor() { super(); this.samples = new Int16Array(2048); this.offset = 0; }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) for (const sample of channel) {
      const value = Math.max(-1, Math.min(1, sample));
      this.samples[this.offset++] = Math.round(value * (value < 0 ? 32768 : 32767));
      if (this.offset === this.samples.length) {
        this.port.postMessage(this.samples.buffer, [this.samples.buffer]);
        this.samples = new Int16Array(2048); this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor('broken-handyman-speech', SpeechProcessor);
