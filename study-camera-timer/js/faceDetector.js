"use strict";

/**
 * Face presence is deliberately tracked separately from MediaPipe.  Keeping the
 * policy here makes it possible to test absence handling without a camera and
 * prevents a single dropped frame from pausing a study session.
 */
export const DEFAULT_FACE_TRACKER_OPTIONS = Object.freeze({
  windowSize: 10,
  absentThreshold: 7,
  presentThreshold: 6,
  minDetectionScore: 0.5,
  warmupMs: 3_000
});

export const FACE_STATES = Object.freeze({
  PREPARING: "preparing",
  UNKNOWN: "unknown",
  PRESENT: "present",
  ABSENT: "absent"
});

function monotonicNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function finiteNumber(value, fallback) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function cloneBoundingBox(box) {
  if (!box) return null;
  return {
    originX: finiteNumber(box.originX, 0),
    originY: finiteNumber(box.originY, 0),
    width: finiteNumber(box.width, 0),
    height: finiteNumber(box.height, 0),
    angle: finiteNumber(box.angle, 0)
  };
}

function cloneKeypoints(keypoints) {
  if (!Array.isArray(keypoints)) return [];
  return keypoints.map((point) => ({
    x: finiteNumber(point.x, 0),
    y: finiteNumber(point.y, 0),
    label: point.label ?? point.displayName ?? "",
    score: finiteNumber(point.score, null)
  }));
}

function getDetectionScore(detection) {
  const categories = detection?.categories;
  if (!Array.isArray(categories) || categories.length === 0) return 1;
  return finiteNumber(categories[0]?.score, 0);
}

/** Return the highest-confidence face without retaining a video frame. */
export function extractBestFace(result, minDetectionScore = 0.5) {
  const detections = Array.isArray(result?.detections) ? result.detections : [];
  let best = null;

  for (const detection of detections) {
    const score = getDetectionScore(detection);
    if (score < minDetectionScore || (best && best.score >= score)) continue;
    best = {
      score,
      boundingBox: cloneBoundingBox(detection.boundingBox),
      keypoints: cloneKeypoints(detection.keypoints)
    };
  }

  return best;
}

/**
 * Ten-sample hysteresis tracker.
 *
 * - 7 misses in the latest 10 samples moves to `absent`.
 * - 6 detections moves to `present`.
 * - The 4/5-detection gap preserves the current stable state.
 */
export class FacePresenceTracker {
  constructor(options = {}) {
    const merged = { ...DEFAULT_FACE_TRACKER_OPTIONS, ...options };
    this.options = {
      windowSize: Math.max(1, Math.round(finiteNumber(merged.windowSize, 10))),
      absentThreshold: Math.max(1, Math.round(finiteNumber(merged.absentThreshold, 7))),
      presentThreshold: Math.max(1, Math.round(finiteNumber(merged.presentThreshold, 6))),
      minDetectionScore: clamp(finiteNumber(merged.minDetectionScore, 0.5), 0, 1),
      warmupMs: Math.max(0, finiteNumber(merged.warmupMs, 3_000))
    };

    if (this.options.absentThreshold > this.options.windowSize) {
      throw new RangeError("absentThreshold must not exceed windowSize");
    }
    if (this.options.presentThreshold > this.options.windowSize) {
      throw new RangeError("presentThreshold must not exceed windowSize");
    }

    this.reset();
  }

  reset(now = monotonicNow()) {
    this.history = [];
    this.state = FACE_STATES.PREPARING;
    this.startedAt = finiteNumber(now, monotonicNow());
    this.lastUpdatedAt = null;
    this.lastPresentAt = null;
    this.lastAbsentAt = null;
    this.bestFace = null;
    return this.getSnapshot(this.startedAt);
  }

  /** Accept a MediaPipe FaceDetector result. */
  updateResult(result, now = monotonicNow()) {
    const bestFace = extractBestFace(result, this.options.minDetectionScore);
    return this.updateDetected(Boolean(bestFace), {
      now,
      score: bestFace?.score ?? 0,
      boundingBox: bestFace?.boundingBox ?? null,
      keypoints: bestFace?.keypoints ?? [],
      faceCount: Array.isArray(result?.detections) ? result.detections.length : 0
    });
  }

  /** Accept a synthetic/normalized result for tests and debug controls. */
  updateDetected(detected, metadata = {}) {
    const now = finiteNumber(metadata.now, monotonicNow());
    const sample = {
      detected: Boolean(detected),
      score: clamp(finiteNumber(metadata.score, detected ? 1 : 0), 0, 1),
      at: now
    };

    this.history.push(sample);
    if (this.history.length > this.options.windowSize) this.history.shift();
    this.lastUpdatedAt = now;

    if (sample.detected) {
      this.lastPresentAt = now;
      this.bestFace = {
        score: sample.score,
        boundingBox: cloneBoundingBox(metadata.boundingBox),
        keypoints: cloneKeypoints(metadata.keypoints),
        faceCount: Math.max(1, Math.round(finiteNumber(metadata.faceCount, 1)))
      };
    } else {
      this.lastAbsentAt = now;
      this.bestFace = null;
    }

    const previousState = this.state;
    this.state = this.#nextState(now);
    const snapshot = this.getSnapshot(now);
    snapshot.previousState = previousState;
    snapshot.changed = previousState !== this.state;
    return snapshot;
  }

  #nextState(now) {
    if (now - this.startedAt < this.options.warmupMs) {
      return FACE_STATES.PREPARING;
    }

    const detectedCount = this.history.reduce(
      (count, sample) => count + (sample.detected ? 1 : 0),
      0
    );
    const missedCount = this.history.length - detectedCount;
    const enoughSamples = this.history.length >= Math.min(
      this.options.windowSize,
      Math.max(this.options.absentThreshold, this.options.presentThreshold)
    );

    if (!enoughSamples) return FACE_STATES.UNKNOWN;
    if (detectedCount >= this.options.presentThreshold) return FACE_STATES.PRESENT;
    if (missedCount >= this.options.absentThreshold) return FACE_STATES.ABSENT;

    // This gap is intentional: it prevents state flapping around the boundary.
    if (this.state === FACE_STATES.PRESENT || this.state === FACE_STATES.ABSENT) {
      return this.state;
    }
    return FACE_STATES.UNKNOWN;
  }

  getSnapshot(now = monotonicNow()) {
    const timestamp = finiteNumber(now, monotonicNow());
    const detectedCount = this.history.reduce(
      (count, sample) => count + (sample.detected ? 1 : 0),
      0
    );
    const missedCount = this.history.length - detectedCount;

    return {
      state: this.state,
      present: this.state === FACE_STATES.PRESENT,
      absent: this.state === FACE_STATES.ABSENT,
      preparing: this.state === FACE_STATES.PREPARING,
      score: this.bestFace?.score ?? 0,
      boundingBox: this.bestFace?.boundingBox ?? null,
      keypoints: this.bestFace?.keypoints ?? [],
      faceCount: this.bestFace?.faceCount ?? 0,
      sampleCount: this.history.length,
      detectedCount,
      missedCount,
      detectedRatio: this.history.length ? detectedCount / this.history.length : 0,
      recent: this.history.map((sample) => sample.detected),
      warmupRemainingMs: Math.max(0, this.options.warmupMs - (timestamp - this.startedAt)),
      startedAt: this.startedAt,
      updatedAt: this.lastUpdatedAt,
      lastPresentAt: this.lastPresentAt,
      lastAbsentAt: this.lastAbsentAt
    };
  }
}

export function createFacePresenceTracker(options) {
  return new FacePresenceTracker(options);
}
