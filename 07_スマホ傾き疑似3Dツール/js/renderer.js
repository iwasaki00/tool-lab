const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const SMOOTHING_FACTORS = Object.freeze({
  smooth: 0.065,
  standard: 0.12,
  responsive: 0.22,
});

export class TiltRenderer {
  constructor({ inputProvider, onFrame }) {
    this.inputProvider = inputProvider;
    this.onFrame = onFrame ?? (() => {});
    this.current = { x: 0, y: 0 };
    this.sensitivity = 1;
    this.smoothing = SMOOTHING_FACTORS.standard;
    this.motionScale = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.45 : 1;
    this.animationId = null;
    this.lastFrameTime = performance.now();
    this.fps = 0;
    this.frameCount = 0;
    this.fpsStartedAt = this.lastFrameTime;
    this.render = this.render.bind(this);
  }

  start() {
    if (this.animationId !== null) return;
    this.lastFrameTime = performance.now();
    this.animationId = requestAnimationFrame(this.render);
  }

  stop() {
    if (this.animationId === null) return;
    cancelAnimationFrame(this.animationId);
    this.animationId = null;
  }

  setSensitivity(percent) {
    this.sensitivity = clamp(Number(percent) / 100, 0.4, 1.6);
  }

  setSmoothing(mode) {
    this.smoothing = SMOOTHING_FACTORS[mode] ?? SMOOTHING_FACTORS.standard;
  }

  centerImmediately() {
    this.current.x = 0;
    this.current.y = 0;
  }

  syncToInput() {
    const input = this.inputProvider();
    this.current.x = input.viewX;
    this.current.y = input.viewY;
  }

  render(now) {
    const input = this.inputProvider();
    const frameRatio = clamp((now - this.lastFrameTime) / (1000 / 60), 0.25, 4);
    const frameSmoothing = 1 - Math.pow(1 - this.smoothing, frameRatio);
    this.current.x += (input.viewX - this.current.x) * frameSmoothing;
    this.current.y += (input.viewY - this.current.y) * frameSmoothing;

    const cameraViewX = clamp(this.current.x * this.sensitivity * this.motionScale, -1.65, 1.65);
    const cameraViewY = clamp(this.current.y * this.sensitivity * this.motionScale, -1.65, 1.65);

    this.frameCount += 1;
    const fpsElapsed = now - this.fpsStartedAt;
    if (fpsElapsed >= 500) {
      this.fps = Math.round((this.frameCount * 1000) / fpsElapsed);
      this.frameCount = 0;
      this.fpsStartedAt = now;
    }
    this.onFrame({
      smoothViewX: this.current.x,
      smoothViewY: this.current.y,
      cameraViewX,
      cameraViewY,
      fps: this.fps,
      time: now,
      input,
    });
    this.lastFrameTime = now;
    this.animationId = requestAnimationFrame(this.render);
  }
}
