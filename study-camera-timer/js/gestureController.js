"use strict";

export const DEFAULT_GESTURE_OPTIONS = Object.freeze({
  holdMs: 800,
  cooldownMs: 2_000
});

function monotonicNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function finiteNumber(value, fallback) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function customEvent(type, detail) {
  if (typeof CustomEvent === "function") return new CustomEvent(type, { detail });
  const event = new Event(type);
  Object.defineProperty(event, "detail", { value: detail, enumerable: true });
  return event;
}

function normalizePalmInput(input) {
  if (typeof input === "boolean") {
    return { openPalm: input, confidence: input ? 1 : 0, hand: null };
  }
  const bestHand = input?.bestHand ?? input?.hand ?? null;
  return {
    openPalm: Boolean(input?.openPalm ?? bestHand?.openPalm),
    confidence: clamp(finiteNumber(input?.confidence ?? bestHand?.confidence, 0)),
    hand: bestHand
  };
}

/**
 * Turns a sustained open palm into one toggle event.  A trigger remains latched
 * until the palm is released, so one pose cannot start and immediately pause a
 * timer even after the cooldown expires.
 */
export class PalmGestureController extends EventTarget {
  constructor(options = {}) {
    super();
    const merged = { ...DEFAULT_GESTURE_OPTIONS, ...options };
    this.options = {
      holdMs: Math.max(0, finiteNumber(merged.holdMs, 800)),
      cooldownMs: Math.max(0, finiteNumber(merged.cooldownMs, 2_000))
    };
    this.onGesture = typeof options.onGesture === "function" ? options.onGesture : null;
    this.reset();
  }

  reset({ preserveCooldown = false } = {}) {
    this.holdStartedAt = null;
    this.lastSeenAt = null;
    this.latched = false;
    this.openPalm = false;
    this.confidence = 0;
    if (!preserveCooldown) this.lastTriggeredAt = Number.NEGATIVE_INFINITY;
    return this.getSnapshot();
  }

  process(input, now = monotonicNow()) {
    const timestamp = finiteNumber(now, monotonicNow());
    const palm = normalizePalmInput(input);
    this.openPalm = palm.openPalm;
    this.confidence = palm.confidence;
    this.lastSeenAt = timestamp;

    if (!palm.openPalm) {
      const wasLatched = this.latched;
      this.holdStartedAt = null;
      this.latched = false;
      const snapshot = this.getSnapshot(timestamp);
      snapshot.released = wasLatched;
      snapshot.triggered = false;
      return snapshot;
    }

    if (this.latched) {
      const snapshot = this.getSnapshot(timestamp);
      snapshot.triggered = false;
      return snapshot;
    }

    if (this.holdStartedAt === null) this.holdStartedAt = timestamp;
    const heldMs = Math.max(0, timestamp - this.holdStartedAt);
    const cooldownRemainingMs = Math.max(
      0,
      this.options.cooldownMs - (timestamp - this.lastTriggeredAt)
    );

    if (heldMs >= this.options.holdMs && cooldownRemainingMs === 0) {
      const detail = this.#trigger({
        at: timestamp,
        source: "camera",
        confidence: palm.confidence,
        hand: palm.hand
      });
      const snapshot = this.getSnapshot(timestamp);
      snapshot.triggered = true;
      snapshot.event = detail;
      return snapshot;
    }

    const snapshot = this.getSnapshot(timestamp);
    snapshot.triggered = false;
    return snapshot;
  }

  update(input, now) {
    return this.process(input, now);
  }

  /** Immediate debug trigger.  By default it bypasses hold/cooldown. */
  simulate(options = {}) {
    const normalized = typeof options === "number" ? { now: options } : options;
    const timestamp = finiteNumber(normalized.now, monotonicNow());
    const force = normalized.force !== false;
    const cooldownRemainingMs = Math.max(
      0,
      this.options.cooldownMs - (timestamp - this.lastTriggeredAt)
    );
    if (!force && (this.latched || cooldownRemainingMs > 0)) {
      const snapshot = this.getSnapshot(timestamp);
      snapshot.triggered = false;
      return snapshot;
    }

    const detail = this.#trigger({
      at: timestamp,
      source: normalized.source ?? "simulation",
      confidence: clamp(finiteNumber(normalized.confidence, 1)),
      hand: null
    });
    if (normalized.latch === false) this.latched = false;
    const snapshot = this.getSnapshot(timestamp);
    snapshot.triggered = true;
    snapshot.event = detail;
    return snapshot;
  }

  release() {
    this.openPalm = false;
    this.holdStartedAt = null;
    this.latched = false;
    return this.getSnapshot();
  }

  #trigger({ at, source, confidence, hand }) {
    this.lastTriggeredAt = at;
    this.latched = true;
    const detail = {
      type: "open_palm_toggle",
      action: "toggle",
      at,
      source,
      confidence,
      handedness: hand?.handedness ?? null
    };
    this.dispatchEvent(customEvent("gesture", detail));
    this.onGesture?.(detail);
    return detail;
  }

  getSnapshot(now = monotonicNow()) {
    const timestamp = finiteNumber(now, monotonicNow());
    const heldMs = this.holdStartedAt === null ? 0 : Math.max(0, timestamp - this.holdStartedAt);
    const cooldownRemainingMs = Math.max(
      0,
      this.options.cooldownMs - (timestamp - this.lastTriggeredAt)
    );
    return {
      openPalm: this.openPalm,
      confidence: this.confidence,
      holding: this.openPalm && !this.latched,
      heldMs,
      holdProgress: this.options.holdMs === 0 ? 1 : clamp(heldMs / this.options.holdMs),
      latched: this.latched,
      cooldownRemainingMs,
      ready: !this.latched && cooldownRemainingMs === 0,
      lastTriggeredAt: Number.isFinite(this.lastTriggeredAt) ? this.lastTriggeredAt : null,
      lastSeenAt: this.lastSeenAt
    };
  }
}

export function createPalmGestureController(options) {
  return new PalmGestureController(options);
}
