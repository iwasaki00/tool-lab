export const SENSOR_STATES = Object.freeze({
  IDLE: "IDLE",
  REQUESTING_PERMISSION: "REQUESTING_PERMISSION",
  ACTIVE: "ACTIVE",
  DENIED: "DENIED",
  UNSUPPORTED: "UNSUPPORTED",
  ERROR: "ERROR",
  MOUSE_SIMULATION: "MOUSE_SIMULATION",
});

const MAX_TILT_DEGREES = 35;
const clamp = (value, min = -1, max = 1) => Math.min(max, Math.max(min, value));
const finiteOrNull = (value) => Number.isFinite(value) ? value : null;

export class OrientationController {
  constructor({ onStateChange } = {}) {
    this.onStateChange = onStateChange ?? (() => {});
    this.state = SENSOR_STATES.IDLE;
    this.raw = { alpha: null, beta: null, gamma: null, tiltX: 0, tiltY: 0 };
    this.neutral = { x: 0, y: 0 };
    this.lastScreenVector = { x: 0, y: 0 };
    this.sensorReceived = false;
    this.listening = false;
    this.permissionTimer = null;
    this.handleOrientation = this.handleOrientation.bind(this);
    this.handleOrientationChange = this.handleOrientationChange.bind(this);
  }

  get supportsOrientation() {
    return typeof window.DeviceOrientationEvent !== "undefined";
  }

  get screenAngle() {
    const modernAngle = window.screen?.orientation?.angle;
    const legacyAngle = window.orientation;
    return Number.isFinite(modernAngle) ? modernAngle : (Number.isFinite(legacyAngle) ? legacyAngle : 0);
  }

  get screenLabel() {
    const type = window.screen?.orientation?.type;
    if (type) return type;
    return Math.abs(this.screenAngle) === 90 ? "landscape" : "portrait";
  }

  setState(nextState, detail = "") {
    if (this.state === nextState && !detail) return;
    this.state = nextState;
    this.onStateChange({ state: nextState, detail });
  }

  enableMouseSimulation() {
    if (this.state !== SENSOR_STATES.ACTIVE && this.state !== SENSOR_STATES.REQUESTING_PERMISSION) {
      this.setState(SENSOR_STATES.MOUSE_SIMULATION);
    }
  }

  setMouseTilt(x, y) {
    if (this.state === SENSOR_STATES.ACTIVE) return;
    this.raw.tiltX = clamp(x);
    this.raw.tiltY = clamp(y);
    this.enableMouseSimulation();
  }

  async start() {
    if (this.state === SENSOR_STATES.ACTIVE || this.state === SENSOR_STATES.REQUESTING_PERMISSION) return;
    if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
      this.setState(SENSOR_STATES.ERROR, "傾きセンサーにはHTTPS（安全な接続）が必要です。マウスデモは利用できます。");
      return;
    }
    if (!this.supportsOrientation) {
      this.setState(SENSOR_STATES.UNSUPPORTED, "このブラウザでは傾きセンサーを利用できません。PCではマウス操作を利用できます。");
      return;
    }

    this.setState(SENSOR_STATES.REQUESTING_PERMISSION);
    try {
      const OrientationEvent = window.DeviceOrientationEvent;
      if (typeof OrientationEvent.requestPermission === "function") {
        const permission = await OrientationEvent.requestPermission();
        if (permission !== "granted") {
          this.setState(SENSOR_STATES.DENIED, "モーションセンサーの利用が許可されませんでした。Safariの設定をご確認ください。");
          return;
        }
      }
      this.attach();
      clearTimeout(this.permissionTimer);
      this.permissionTimer = window.setTimeout(() => {
        if (!this.sensorReceived) {
          this.setState(SENSOR_STATES.MOUSE_SIMULATION, "センサー値を受信できません。端末を動かすか、マウスデモをお試しください。");
        }
      }, 1800);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setState(SENSOR_STATES.ERROR, `センサーの開始に失敗しました: ${message}`);
    }
  }

  attach() {
    if (this.listening) return;
    window.addEventListener("deviceorientation", this.handleOrientation, { passive: true });
    window.addEventListener("orientationchange", this.handleOrientationChange, { passive: true });
    window.screen?.orientation?.addEventListener?.("change", this.handleOrientationChange);
    this.listening = true;
  }

  handleOrientation(event) {
    const beta = finiteOrNull(event.beta);
    const gamma = finiteOrNull(event.gamma);
    this.raw.alpha = finiteOrNull(event.alpha);
    this.raw.beta = beta;
    this.raw.gamma = gamma;
    if (beta === null || gamma === null) return;

    const vector = this.toScreenCoordinates(beta, gamma);
    this.lastScreenVector = vector;
    this.raw.tiltX = clamp((vector.x - this.neutral.x) / MAX_TILT_DEGREES);
    this.raw.tiltY = clamp((vector.y - this.neutral.y) / MAX_TILT_DEGREES);
    if (!this.sensorReceived) {
      this.sensorReceived = true;
      clearTimeout(this.permissionTimer);
      this.setState(SENSOR_STATES.ACTIVE);
    }
  }

  toScreenCoordinates(beta, gamma) {
    const angle = ((this.screenAngle % 360) + 360) % 360;
    if (angle === 90) return { x: beta, y: -gamma };
    if (angle === 270) return { x: -beta, y: gamma };
    if (angle === 180) return { x: -gamma, y: -beta };
    return { x: gamma, y: beta };
  }

  handleOrientationChange() {
    if (this.sensorReceived) {
      window.setTimeout(() => {
        if (this.raw.beta === null || this.raw.gamma === null) return;
        const rebased = this.toScreenCoordinates(this.raw.beta, this.raw.gamma);
        this.lastScreenVector = rebased;
        this.neutral = { ...rebased };
        this.raw.tiltX = 0;
        this.raw.tiltY = 0;
      }, 120);
    }
  }

  resetNeutral() {
    if (this.state === SENSOR_STATES.ACTIVE) {
      this.neutral = { ...this.lastScreenVector };
    } else {
      this.raw.tiltX = 0;
      this.raw.tiltY = 0;
    }
  }

  getSnapshot() {
    return {
      ...this.raw,
      state: this.state,
      orientation: this.screenLabel,
      screenAngle: this.screenAngle,
    };
  }
}
