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

export const ALARM_SOUNDS = Object.freeze({
  clear_chime: Object.freeze({
    label: "クリアチャイム",
    cue: Object.freeze({
      waveform: "sine",
      notes: Object.freeze([[659, 0.12, 0], [784, 0.14, 0.14], [988, 0.26, 0.3]])
    })
  }),
  bell: Object.freeze({
    label: "ベル",
    cue: Object.freeze({
      waveform: "triangle",
      volumeScale: 0.82,
      notes: Object.freeze([[1047, 0.34, 0], [784, 0.48, 0.06], [1047, 0.28, 0.48]])
    })
  }),
  digital: Object.freeze({
    label: "デジタル",
    cue: Object.freeze({
      waveform: "square",
      volumeScale: 0.48,
      notes: Object.freeze([[880, 0.08, 0], [880, 0.08, 0.16], [1175, 0.14, 0.32], [1175, 0.14, 0.52]])
    })
  }),
  school: Object.freeze({
    label: "スクールベル",
    cue: Object.freeze({
      waveform: "sine",
      volumeScale: 0.9,
      notes: Object.freeze([[784, 0.28, 0], [659, 0.28, 0.3], [523, 0.4, 0.6]])
    })
  }),
  gentle: Object.freeze({
    label: "やさしい音",
    cue: Object.freeze({
      waveform: "triangle",
      volumeScale: 0.6,
      notes: Object.freeze([[523, 0.18, 0], [659, 0.24, 0.2], [784, 0.38, 0.44]])
    })
  })
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
const SOUND_ALIASES = Object.freeze({
  chime: "clear_chime",
  clear: "clear_chime",
  soft: "gentle"
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

function normalizeSound(sound) {
  const normalized = SOUND_ALIASES[sound] || sound;
  return typeof normalized === "string" && normalized in ALARM_SOUNDS
    ? normalized
    : "clear_chime";
}

function noop() {}

export class Notifier extends EventTarget {
  constructor(options = {}) {
    super();
    this.mode = normalizeMode(options.mode || "sound");
    this.volume = normalizeVolume(options.volume || "medium");
    this.sound = normalizeSound(options.sound || "clear_chime");
    this.document = options.document || globalThis.document;
    this.navigator = options.navigator || globalThis.navigator;
    this.audioContext = options.audioContext || null;
    this.ownsAudioContext = !options.audioContext;
    this.unlockTimeoutMs = Math.max(50, Number(options.unlockTimeoutMs) || 900);
    this.repeatIntervalMs = Math.max(50, Number(options.repeatIntervalMs) || 1_450);
    this._unlockPromise = null;
    this._unlockCleanup = noop;
    this._flashOverlay = null;
    this._flashAnimation = null;
    this._activeVoices = new Map();
    this._alarm = null;
    this._alarmSequence = 0;
    if (options.autoUnlock !== false) {
      this.bindUnlock(options.unlockTarget || this.document);
    }
  }

  get isAudioUnlocked() {
    return Boolean(this.audioContext && this.audioContext.state === "running");
  }

  get isAlarmActive() {
    return Boolean(this._alarm);
  }

  get vibrationSupported() {
    return typeof this.navigator?.vibrate === "function";
  }

  setMode(mode) {
    this.mode = normalizeMode(mode);
    this._emit("settingschange", { mode: this.mode, volume: this.volume, sound: this.sound });
    return this.mode;
  }

  setVolume(volume) {
    this.volume = normalizeVolume(volume);
    this._emit("settingschange", { mode: this.mode, volume: this.volume, sound: this.sound });
    return this.volume;
  }

  setSound(sound) {
    this.sound = normalizeSound(sound);
    this._emit("settingschange", { mode: this.mode, volume: this.volume, sound: this.sound });
    return this.sound;
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
    const sound = normalizeSound(options.sound || this.sound);
    const isCompletionCue = eventName === "complete" || eventName === "breakComplete";
    const eventCue = EVENT_CUES[eventName] || EVENT_CUES.complete;
    const cue = isCompletionCue
      ? { ...ALARM_SOUNDS[sound].cue, vibrate: eventCue.vibrate }
      : eventCue;
    const result = {
      eventName,
      mode,
      volume,
      sound,
      sounded: false,
      vibrated: false,
      flashed: false
    };

    if (mode === "sound" || mode === "sound+flash") {
      result.sounded = await this._playCue(cue, volume);
      if (!result.sounded && options.fallbackToFlash) {
        result.flashed = await this.flash(options.flash);
      }
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

  async startAlarm(eventName = "complete", options = {}) {
    this.stopAlarm({ reason: "replaced" });
    const mode = normalizeMode(options.mode || this.mode);
    if (mode === "silent" || options.repeat === false) {
      const result = await this.notify(eventName, options);
      return { ...result, repeating: false };
    }

    const alarm = {
      id: ++this._alarmSequence,
      eventName,
      options: { ...options, mode },
      timerId: 0,
      inFlight: false,
      refreshRequested: false,
      suspended: false
    };
    this._alarm = alarm;
    this._emit("alarmstart", { eventName, mode, sound: normalizeSound(options.sound || this.sound) });
    const result = await this._runAlarmCycle(alarm);
    return { ...result, repeating: this._alarm === alarm };
  }

  stopAlarm(options = {}) {
    const alarm = this._alarm;
    if (!alarm) return false;
    this._alarm = null;
    globalThis.clearTimeout(alarm.timerId);
    this._stopActiveOscillators();
    this._stopFlash();
    if (this.vibrationSupported) {
      try {
        this.navigator.vibrate(0);
      } catch (error) {
        this._emit("error", { source: "vibration-stop", error });
      }
    }
    this._emit("alarmstop", { eventName: alarm.eventName, reason: options.reason || "user" });
    return true;
  }

  refreshAlarm() {
    const alarm = this._alarm;
    if (!alarm) return false;
    alarm.suspended = false;
    globalThis.clearTimeout(alarm.timerId);
    this._stopActiveOscillators();
    this._stopFlash();
    if (this.vibrationSupported) {
      try {
        this.navigator.vibrate(0);
      } catch (error) {
        this._emit("error", { source: "vibration-refresh", error });
      }
    }
    if (alarm.inFlight) {
      alarm.refreshRequested = true;
    } else {
      alarm.timerId = globalThis.setTimeout(() => void this._runAlarmCycle(alarm), 0);
    }
    return true;
  }

  suspendAlarm() {
    const alarm = this._alarm;
    if (!alarm) return false;
    alarm.suspended = true;
    alarm.refreshRequested = false;
    globalThis.clearTimeout(alarm.timerId);
    this._stopActiveOscillators();
    this._stopFlash();
    if (this.vibrationSupported) {
      try {
        this.navigator.vibrate(0);
      } catch (error) {
        this._emit("error", { source: "vibration-suspend", error });
      }
    }
    return true;
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
      this._flashAnimation?.cancel();
      this._flashAnimation = animation;
      overlay.style.background = color;
      await animation.finished.catch(noop);
      if (this._flashAnimation === animation) this._flashAnimation = null;
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
    this.stopAlarm({ reason: "destroy" });
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
      const amplitude = VOLUME_LEVELS[volumeName] * (Number(cue.volumeScale) || 1);
      const startAt = this.audioContext.currentTime + 0.012;
      cue.notes.forEach(([frequency, duration, offset]) => {
        const oscillator = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const noteStart = startAt + offset;
        oscillator.type = cue.waveform || "sine";
        oscillator.frequency.setValueAtTime(frequency, noteStart);
        gain.gain.setValueAtTime(0.0001, noteStart);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, amplitude), noteStart + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + duration);
        oscillator.connect(gain);
        gain.connect(this.audioContext.destination);
        this._activeVoices.set(oscillator, gain);
        oscillator.addEventListener?.("ended", () => this._releaseVoice(oscillator), { once: true });
        oscillator.start(noteStart);
        oscillator.stop(noteStart + duration + 0.02);
      });
      return true;
    } catch (error) {
      this._emit("error", { source: "audio-playback", error });
      return false;
    }
  }

  async _runAlarmCycle(alarm) {
    if (this._alarm !== alarm || alarm.inFlight || alarm.suspended) return {};
    alarm.inFlight = true;
    let result = {};
    try {
      result = await this.notify(alarm.eventName, alarm.options);
    } catch (error) {
      result = { eventName: alarm.eventName, sounded: false, vibrated: false, flashed: false };
      this._emit("error", { source: "alarm-cycle", error });
    } finally {
      alarm.inFlight = false;
      if (this._alarm === alarm && !alarm.suspended) {
        const delay = alarm.refreshRequested ? 0 : this.repeatIntervalMs;
        alarm.refreshRequested = false;
        alarm.timerId = globalThis.setTimeout(() => void this._runAlarmCycle(alarm), delay);
      }
    }
    return result;
  }

  _stopActiveOscillators() {
    for (const oscillator of this._activeVoices.keys()) {
      try {
        oscillator.stop();
      } catch (error) {
        // It may already have reached its scheduled stop time.
      }
      this._releaseVoice(oscillator);
    }
    this._activeVoices.clear();
  }

  _releaseVoice(oscillator) {
    const gain = this._activeVoices.get(oscillator);
    if (!gain) return;
    this._activeVoices.delete(oscillator);
    try {
      oscillator.disconnect();
    } catch (error) {
      // Some lightweight test doubles and already released nodes omit this.
    }
    try {
      gain.disconnect();
    } catch (error) {
      // The gain may already have been disconnected with its source.
    }
  }

  _stopFlash() {
    this._flashAnimation?.cancel();
    this._flashAnimation = null;
    if (this._flashOverlay) this._flashOverlay.style.opacity = "0";
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
