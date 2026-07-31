const AUDIO_CONTEXT_CLASS = globalThis.AudioContext || globalThis.webkitAudioContext;

export const NOTIFICATION_MODES = Object.freeze([
  "sound",
  "vibrate",
  "flash",
  "sound+flash",
  "silent"
]);

export const VOLUME_LEVELS = Object.freeze({
  low: 0.16,
  medium: 0.34,
  high: 0.62
});

export const EVENT_CUES = Object.freeze({
  start: { notes: [[659, 0.07, 0], [880, 0.09, 0.08]], vibrate: [55] },
  pause: { notes: [[440, 0.1, 0]], vibrate: [45] },
  resume: { notes: [[587, 0.07, 0], [784, 0.08, 0.07]], vibrate: [45] },
  complete: { notes: [[659, 0.1, 0], [784, 0.1, 0.12], [988, 0.18, 0.24]], vibrate: [80, 60, 120] },
  breakComplete: { notes: [[784, 0.1, 0], [988, 0.16, 0.12]], vibrate: [70, 50, 90] },
  absent: { notes: [[392, 0.14, 0], [330, 0.18, 0.16]], vibrate: [120, 80, 120] },
  returned: { notes: [[523, 0.07, 0], [659, 0.09, 0.08]], vibrate: [50] },
  gesture: { notes: [[988, 0.055, 0]], vibrate: [] }
});

const MODE_ALIASES = Object.freeze({
  vibration: "vibrate",
  "sound-flash": "sound+flash",
  sound_flash: "sound+flash",
  soundFlash: "sound+flash",
  none: "silent"
});
const VOLUME_ALIASES = Object.freeze({
  small: "low",
  mid: "medium",
  large: "high",
  "小": "low",
  "中": "medium",
  "大": "high"
});

function normalizeMode(mode) {
  const normalized = MODE_ALIASES[mode] || mode;
  return NOTIFICATION_MODES.includes(normalized) ? normalized : "sound";
}

function normalizeVolume(volume) {
  const normalized = VOLUME_ALIASES[volume] || volume;
  if (typeof normalized === "string" && normalized in VOLUME_LEVELS) return normalized;
  return "medium";
}

function noop() {}

export class Notifier extends EventTarget {
  constructor(options = {}) {
    super();
    this.mode = normalizeMode(options.mode || "sound");
    this.volume = normalizeVolume(options.volume || "medium");
    this.document = options.document || globalThis.document;
    this.navigator = options.navigator || globalThis.navigator;
    this.audioContext = options.audioContext || null;
    this.ownsAudioContext = !options.audioContext;
    this.unlockTimeoutMs = Math.max(50, Number(options.unlockTimeoutMs) || 900);
    this._unlockPromise = null;
    this._unlockCleanup = noop;
    this._flashOverlay = null;
    if (options.autoUnlock !== false) {
      this.bindUnlock(options.unlockTarget || this.document);
    }
  }

  get isAudioUnlocked() {
    return Boolean(this.audioContext && this.audioContext.state === "running");
  }

  setMode(mode) {
    this.mode = normalizeMode(mode);
    this._emit("settingschange", { mode: this.mode, volume: this.volume });
    return this.mode;
  }

  setVolume(volume) {
    this.volume = normalizeVolume(volume);
    this._emit("settingschange", { mode: this.mode, volume: this.volume });
    return this.volume;
  }

  async unlock() {
    if (this._unlockPromise) return this._unlockPromise;
    this._unlockPromise = this._unlockAudio();
    try {
      return await this._unlockPromise;
    } finally {
      this._unlockPromise = null;
    }
  }

  async _unlockAudio() {
    let context = this.audioContext;
    try {
      if (!context || context.state === "closed") {
        if (!AUDIO_CONTEXT_CLASS) return false;
        context = new AUDIO_CONTEXT_CLASS();
        this.audioContext = context;
      }
      if (context.state !== "running") {
        let timeoutId = 0;
        const resumed = await Promise.race([
          Promise.resolve(context.resume()).then(() => true, () => false),
          new Promise((resolve) => {
            timeoutId = globalThis.setTimeout(() => resolve(false), this.unlockTimeoutMs);
          })
        ]);
        globalThis.clearTimeout(timeoutId);
        if (!resumed || context.state !== "running") {
          const error = new Error("AudioContext could not resume in time");
          this._emit("error", { source: "audio-unlock", error });
          if (this.ownsAudioContext && this.audioContext === context) {
            this.audioContext = null;
            Promise.resolve(context.close()).catch(noop);
          }
          return false;
        }
      }

      // A near-silent oscillator makes the unlock effective on iOS Safari while
      // remaining inaudible to the user.
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      gain.gain.value = 0.00001;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.015);
      this._emit("audiounlocked", { unlocked: true });
      return true;
    } catch (error) {
      this._emit("error", { source: "audio-unlock", error });
      return false;
    }
  }

  bindUnlock(target = this.document) {
    this._unlockCleanup();
    if (!target?.addEventListener) return noop;

    const options = { capture: true, passive: true };
    const events = ["pointerdown", "touchend", "keydown"];
    const handler = () => {
      this.unlock().then((unlocked) => {
        if (unlocked) this._unlockCleanup();
      });
    };
    const cleanup = () => {
      events.forEach((eventName) => target.removeEventListener(eventName, handler, options));
      if (this._unlockCleanup === cleanup) this._unlockCleanup = noop;
    };
    events.forEach((eventName) => target.addEventListener(eventName, handler, options));
    this._unlockCleanup = cleanup;
    return cleanup;
  }

  async notify(eventName, options = {}) {
    const mode = normalizeMode(options.mode || this.mode);
    const volume = normalizeVolume(options.volume || this.volume);
    const cue = EVENT_CUES[eventName] || EVENT_CUES.complete;
    const result = {
      eventName,
      mode,
      volume,
      sounded: false,
      vibrated: false,
      flashed: false
    };

    if (mode === "sound" || mode === "sound+flash") {
      result.sounded = await this._playCue(cue, volume);
    }
    if (mode === "vibrate") {
      result.vibrated = this._vibrate(cue.vibrate);
      if (!result.vibrated) result.flashed = await this.flash(options.flash);
    }
    if (mode === "flash" || mode === "sound+flash") {
      result.flashed = await this.flash(options.flash);
    }

    this._emit("notification", result);
    return result;
  }

  notifyEvent(eventName, options = {}) {
    return this.notify(eventName, options);
  }

  async playGestureTone(options = {}) {
    // Gesture feedback has its own setting in the app and is intentionally
    // independent from the end-of-timer notification method.
    if (options.enabled === false) return false;
    return this._playCue(EVENT_CUES.gesture, normalizeVolume(options.volume || this.volume));
  }

  gesture(options = {}) {
    return this.playGestureTone(options);
  }

  async flash(options = {}) {
    const doc = this.document;
    if (!doc?.body || doc.visibilityState === "hidden") return false;

    const overlay = this._getFlashOverlay();
    if (!overlay) return false;
    const color = options?.color || "rgba(255, 239, 140, 0.72)";
    const duration = Math.max(120, Number(options?.duration) || 360);

    if (typeof overlay.animate === "function") {
      const animation = overlay.animate(
        [{ opacity: 0 }, { opacity: 1, offset: 0.28 }, { opacity: 0 }],
        { duration, easing: "ease-out" }
      );
      overlay.style.background = color;
      await animation.finished.catch(noop);
    } else {
      overlay.style.background = color;
      overlay.style.opacity = "1";
      await new Promise((resolve) => globalThis.setTimeout(resolve, Math.round(duration * 0.35)));
      overlay.style.opacity = "0";
      await new Promise((resolve) => globalThis.setTimeout(resolve, Math.round(duration * 0.65)));
    }
    return true;
  }

  async destroy() {
    this._unlockCleanup();
    this._flashOverlay?.remove();
    this._flashOverlay = null;
    if (this.ownsAudioContext && this.audioContext?.state !== "closed") {
      await this.audioContext.close().catch(noop);
    }
    this.audioContext = null;
  }

  async _playCue(cue, volumeName) {
    try {
      if (!this.audioContext || this.audioContext.state !== "running") return false;
      const amplitude = VOLUME_LEVELS[volumeName];
      const startAt = this.audioContext.currentTime + 0.012;
      cue.notes.forEach(([frequency, duration, offset]) => {
        const oscillator = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const noteStart = startAt + offset;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, noteStart);
        gain.gain.setValueAtTime(0.0001, noteStart);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, amplitude), noteStart + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + duration);
        oscillator.connect(gain);
        gain.connect(this.audioContext.destination);
        oscillator.start(noteStart);
        oscillator.stop(noteStart + duration + 0.02);
      });
      return true;
    } catch (error) {
      this._emit("error", { source: "audio-playback", error });
      return false;
    }
  }

  _vibrate(pattern) {
    if (!pattern?.length || typeof this.navigator?.vibrate !== "function") return false;
    try {
      return this.navigator.vibrate(pattern) !== false;
    } catch (error) {
      this._emit("error", { source: "vibration", error });
      return false;
    }
  }

  _getFlashOverlay() {
    if (this._flashOverlay?.isConnected) return this._flashOverlay;
    const doc = this.document;
    if (!doc?.body) return null;
    const overlay = doc.createElement("div");
    overlay.setAttribute("aria-hidden", "true");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      pointerEvents: "none",
      opacity: "0",
      transition: "opacity 120ms ease-out"
    });
    doc.body.append(overlay);
    this._flashOverlay = overlay;
    return overlay;
  }

  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

export function createNotifier(options) {
  return new Notifier(options);
}

export default Notifier;
