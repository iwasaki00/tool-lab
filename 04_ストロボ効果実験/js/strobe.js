export function clampFrequency(value) {
  return Math.min(60, Math.max(0.5, Math.round(Number(value) * 100) / 100));
}

export function calculateStats(samples, targetFrequency) {
  if (!samples.length) {
    return { samples: 0, average: null, min: null, max: null, deviation: null, frequency: null, error: null };
  }
  const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const variance = samples.reduce((sum, value) => sum + (value - average) ** 2, 0) / samples.length;
  const frequency = 1000 / average;
  return {
    samples: samples.length,
    average,
    min: Math.min(...samples),
    max: Math.max(...samples),
    deviation: Math.sqrt(variance),
    frequency,
    error: frequency - targetFrequency
  };
}

export function stabilityLabel(stats) {
  if (!stats.samples) return "未測定";
  const relativeError = Math.abs(stats.error) / Math.max(0.01, stats.frequency);
  const jitter = stats.deviation / Math.max(0.01, stats.average);
  if (relativeError < 0.01 && jitter < 0.03) return "非常に安定";
  if (relativeError < 0.03 && jitter < 0.08) return "安定";
  if (relativeError < 0.08 && jitter < 0.16) return "やや不安定";
  return "不安定";
}

export class StrobeController extends EventTarget {
  constructor(torch, log) {
    super();
    this.torch = torch;
    this.log = log;
    this.running = false;
    this.frequency = 10;
    this.duty = 10;
    this.autoStopSeconds = 60;
    this.timer = null;
    this.startedAt = 0;
    this.nextCycleAt = 0;
    this.lastOnAt = null;
    this.intervals = [];
  }

  configure({ frequency, duty, autoStopSeconds }) {
    this.frequency = clampFrequency(frequency);
    this.duty = Number(duty);
    this.autoStopSeconds = Number(autoStopSeconds);
    this.resetStats();
  }

  resetStats() {
    this.intervals = [];
    this.lastOnAt = null;
    this.torch.resetTimings();
  }

  stats() {
    return calculateStats(this.intervals, this.frequency);
  }

  async start() {
    if (this.running) return;
    this.running = true;
    this.startedAt = performance.now();
    this.nextCycleAt = this.startedAt;
    this.log(`Strobe start ${this.frequency.toFixed(2)}Hz`);
    this.dispatchEvent(new Event("start"));
    await this.cycle();
  }

  async cycle() {
    if (!this.running) return;
    const period = 1000 / this.frequency;
    if (this.autoStopSeconds > 0 && performance.now() - this.startedAt >= this.autoStopSeconds * 1000) {
      await this.stop("Auto stop");
      return;
    }
    const onStarted = performance.now();
    if (this.lastOnAt !== null) {
      this.intervals.push(onStarted - this.lastOnAt);
      if (this.intervals.length > 30) this.intervals.shift();
    }
    this.lastOnAt = onStarted;
    try {
      await this.torch.set(true);
      if (!this.running) return;
      const onDuration = period * (this.duty / 100);
      await this.delay(Math.max(0, onDuration - (performance.now() - onStarted)));
      if (!this.running) return;
      await this.torch.set(false);
    } catch (error) {
      this.log(`Strobe error: ${error.message}`);
      await this.stop("Strobe error");
      this.dispatchEvent(new CustomEvent("error", { detail: error }));
      return;
    }
    this.nextCycleAt += period;
    const wait = Math.max(0, this.nextCycleAt - performance.now());
    this.timer = setTimeout(() => this.cycle(), wait);
    this.dispatchEvent(new Event("tick"));
  }

  delay(ms) {
    return new Promise((resolve) => {
      this.timer = setTimeout(resolve, ms);
    });
  }

  async stop(reason = "Strobe stop") {
    if (!this.running && !this.torch.requested) return;
    this.running = false;
    clearTimeout(this.timer);
    this.timer = null;
    try {
      await this.torch.set(false);
    } catch (error) {
      this.log(`Torch OFF failed: ${error.message}`);
    }
    this.log(reason);
    this.dispatchEvent(new Event("stop"));
  }
}

