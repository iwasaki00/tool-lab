const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const SMOOTHING_FACTORS = Object.freeze({
  smooth: 0.065,
  standard: 0.12,
  responsive: 0.22,
});

export class TiltRenderer {
  constructor({ root, card, inputProvider, onFrame }) {
    this.root = root;
    this.card = card;
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

    const x = this.current.x * this.sensitivity * this.motionScale;
    const y = this.current.y * this.sensitivity * this.motionScale;
    const style = this.root.style;
    style.setProperty("--rotate-x", `${(-y * 13).toFixed(3)}deg`);
    style.setProperty("--rotate-y", `${(x * 15).toFixed(3)}deg`);
    style.setProperty("--card-x", `${(x * 7).toFixed(2)}px`);
    style.setProperty("--card-y", `${(y * 6).toFixed(2)}px`);
    // The rear plane shifts slightly against the viewpoint while nearer planes
    // travel with it, creating a window-like look-through effect.
    style.setProperty("--back-x", `${(-x * 4).toFixed(2)}px`);
    style.setProperty("--back-y", `${(-y * 4).toFixed(2)}px`);
    style.setProperty("--mid-x", `${(x * 8).toFixed(2)}px`);
    style.setProperty("--mid-y", `${(y * 8).toFixed(2)}px`);
    style.setProperty("--front-x", `${(x * 14).toFixed(2)}px`);
    style.setProperty("--front-y", `${(y * 14).toFixed(2)}px`);
    // Reflections move opposite the viewpoint, as they do on a glossy surface.
    style.setProperty("--shine-x", `${clamp(50 - x * 32, 12, 88).toFixed(1)}%`);
    style.setProperty("--shine-y", `${clamp(40 - y * 30, 10, 90).toFixed(1)}%`);

    this.frameCount += 1;
    const fpsElapsed = now - this.fpsStartedAt;
    if (fpsElapsed >= 500) {
      this.fps = Math.round((this.frameCount * 1000) / fpsElapsed);
      this.frameCount = 0;
      this.fpsStartedAt = now;
    }
    this.onFrame({ smoothViewX: this.current.x, smoothViewY: this.current.y, fps: this.fps, input });
    this.lastFrameTime = now;
    this.animationId = requestAnimationFrame(this.render);
  }
}
