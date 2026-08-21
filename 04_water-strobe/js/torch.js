export class TorchController {
  constructor(getTrack, log) {
    this.getTrack = getTrack;
    this.log = log;
    this.requested = false;
    this.actual = false;
    this.timings = { on: [], off: [] };
    this.pending = Promise.resolve();
  }

  set(on) {
    const operation = this.pending.then(() => this.apply(on));
    this.pending = operation.catch(() => {});
    return operation;
  }

  async apply(on) {
    const track = this.getTrack();
    if (!track || typeof track.applyConstraints !== "function") {
      throw new Error("ライト制御を利用できません");
    }
    this.requested = on;
    const started = performance.now();
    await track.applyConstraints({ advanced: [{ torch: on }] });
    const elapsed = performance.now() - started;
    this.timings[on ? "on" : "off"].push(elapsed);
    if (this.timings[on ? "on" : "off"].length > 100) this.timings[on ? "on" : "off"].shift();
    this.actual = Boolean(track.getSettings?.().torch ?? on);
    this.log(`Torch ${on ? "ON" : "OFF"} success (${elapsed.toFixed(2)} ms)`);
    return elapsed;
  }

  average(kind) {
    const values = this.timings[kind];
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }

  resetTimings() {
    this.timings = { on: [], off: [] };
  }
}
