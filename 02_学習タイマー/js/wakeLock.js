function getNavigator(options = {}) {
  return options.navigator || globalThis.navigator;
}

export function getWakeLockCapability(options = {}) {
  const navigatorObject = getNavigator(options);
  return {
    supported: Boolean(navigatorObject?.wakeLock?.request),
    type: "screen"
  };
}

export class WakeLockManager extends EventTarget {
  constructor(options = {}) {
    super();
    this.navigator = getNavigator(options);
    this.document = options.document || globalThis.document;
    this._running = false;
    this._sentinel = null;
    this._requestPromise = null;
    this._destroyed = false;
    this._onVisibilityChange = this._onVisibilityChange.bind(this);
    this.document?.addEventListener("visibilitychange", this._onVisibilityChange);
  }

  get supported() {
    return Boolean(this.navigator?.wakeLock?.request);
  }

  get capability() {
    return { supported: this.supported, type: "screen" };
  }

  get running() {
    return this._running;
  }

  get active() {
    return Boolean(this._sentinel && !this._sentinel.released);
  }

  get state() {
    return {
      supported: this.supported,
      running: this.running,
      active: this.active,
      visibility: this.document?.visibilityState || "unknown"
    };
  }

  async setRunning(running) {
    const nextRunning = Boolean(running);
    if (this._destroyed) return this.state;
    if (this._running === nextRunning) {
      if (nextRunning && !this.active) await this.request();
      return this.state;
    }

    this._running = nextRunning;
    this._emitState(nextRunning ? "running" : "stopped");
    if (nextRunning) await this.request();
    else await this.release("stopped");
    return this.state;
  }

  start() {
    return this.setRunning(true);
  }

  stop() {
    return this.setRunning(false);
  }

  async request() {
    if (this._destroyed || !this._running || this.document?.visibilityState === "hidden") {
      return null;
    }
    if (!this.supported) {
      this._emitState("unsupported");
      return null;
    }
    if (this.active) return this._sentinel;
    if (this._requestPromise) return this._requestPromise;

    this._requestPromise = (async () => {
      try {
        const sentinel = await this.navigator.wakeLock.request("screen");
        if (this._destroyed || !this._running) {
          await sentinel.release().catch(() => undefined);
          return null;
        }
        this._sentinel = sentinel;
        sentinel.addEventListener("release", () => {
          if (this._sentinel === sentinel) this._sentinel = null;
          this._emitState("released-by-browser");
        }, { once: true });
        this._emitState("acquired");
        return sentinel;
      } catch (error) {
        this.dispatchEvent(new CustomEvent("error", {
          detail: { error, state: this.state }
        }));
        this._emitState("request-failed");
        return null;
      } finally {
        this._requestPromise = null;
      }
    })();

    return this._requestPromise;
  }

  async release(reason = "manual") {
    const sentinel = this._sentinel;
    this._sentinel = null;
    if (sentinel && !sentinel.released) {
      try {
        await sentinel.release();
      } catch (error) {
        this.dispatchEvent(new CustomEvent("error", {
          detail: { error, state: this.state }
        }));
      }
    }
    this._emitState(reason);
    return this.state;
  }

  async destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._running = false;
    this.document?.removeEventListener("visibilitychange", this._onVisibilityChange);
    await this.release("destroyed");
  }

  _onVisibilityChange() {
    if (this.document?.visibilityState === "visible" && this._running) {
      this.request();
    }
    this._emitState("visibilitychange");
  }

  _emitState(reason) {
    this.dispatchEvent(new CustomEvent("statechange", {
      detail: { reason, ...this.state }
    }));
  }
}

export function createWakeLockManager(options) {
  return new WakeLockManager(options);
}

export default WakeLockManager;
