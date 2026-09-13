"use strict";

import { FacePresenceTracker } from "./faceDetector.js";
import { analyzeHandLandmarkerResult } from "./handDetector.js";
import { PalmGestureController } from "./gestureController.js";

export const MEDIAPIPE_VERSION = "0.10.35";
export const MEDIAPIPE_TASKS_VISION_URL =
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/+esm`;
export const MEDIAPIPE_WASM_URL =
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
export const FACE_DETECTOR_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
export const HAND_LANDMARKER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export const CAMERA_STATES = Object.freeze({
  IDLE: "idle",
  REQUESTING: "requesting_permission",
  LOADING: "loading_models",
  RUNNING: "running",
  SUSPENDED: "suspended",
  STOPPING: "stopping",
  ERROR: "camera_error"
});

export const DEFAULT_CAMERA_OPTIONS = Object.freeze({
  width: 640,
  height: 480,
  frameRate: 15,
  cameraRequestTimeoutMs: 15_000,
  activeIntervalMs: 250,
  idleIntervalMs: 1_000,
  maxAdaptiveIntervalMs: 1_500,
  frameStallTimeoutMs: 6_000,
  brightnessIntervalMs: 1_000,
  darkLuminanceThreshold: 0.18,
  blockedLuminanceThreshold: 0.04,
  handEnabled: false,
  debug: false,
  delegate: "GPU",
  moduleUrl: MEDIAPIPE_TASKS_VISION_URL,
  wasmUrl: MEDIAPIPE_WASM_URL,
  faceModelUrl: FACE_DETECTOR_MODEL_URL,
  handModelUrl: HAND_LANDMARKER_MODEL_URL,
  faceTracker: {},
  handAnalysis: {},
  gesture: {}
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

function callbackName(type) {
  return `on${type[0].toUpperCase()}${type.slice(1)}`;
}

export class CameraError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = "CameraError";
    this.code = code;
    this.recoverable = Boolean(options.recoverable);
    this.cause = options.cause;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      recoverable: this.recoverable
    };
  }
}

function normalizeCameraError(error, fallbackCode = "CAMERA_FAILED") {
  if (error instanceof CameraError) return error;
  const name = error?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
    return new CameraError("PERMISSION_DENIED", "カメラの使用が許可されませんでした。", { cause: error });
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return new CameraError("CAMERA_NOT_FOUND", "利用できるフロントカメラが見つかりません。", { cause: error });
  }
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") {
    return new CameraError("CAMERA_BUSY", "カメラを開始できません。別のアプリで使用中の可能性があります。", { cause: error });
  }
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return new CameraError("CAMERA_CONSTRAINT", "この端末では指定したカメラ設定を使用できません。", { cause: error });
  }
  return new CameraError(fallbackCode, error?.message || "カメラ処理でエラーが発生しました。", {
    cause: error
  });
}

function waitForMetadata(video, timeoutMs = 10_000) {
  if (video.readyState >= 1 && video.videoWidth > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new CameraError("VIDEO_TIMEOUT", "カメラ映像の準備がタイムアウトしました。"));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timeoutId);
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("error", onError);
    };
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new CameraError("VIDEO_PLAYBACK_FAILED", "カメラ映像を再生できません。"));
    };
    video.addEventListener("loadedmetadata", onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

function requestCameraStream(constraints, timeoutMs) {
  let timedOut = false;
  let timeoutId = 0;
  const request = navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    if (!timedOut) return stream;
    for (const track of stream.getTracks?.() ?? []) {
      try {
        track.stop();
      } catch {
        // Stopping a late stream is best-effort on interrupted WebKit sessions.
      }
    }
    throw new CameraError("CAMERA_TIMEOUT", "カメラの応答がタイムアウトしました。");
  });
  const timeout = new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      reject(new CameraError(
        "CAMERA_TIMEOUT",
        "カメラを開始できませんでした。もう一度お試しください。"
      ));
    }, Math.max(1_000, Number(timeoutMs) || 15_000));
  });
  return Promise.race([request, timeout]).finally(() => clearTimeout(timeoutId));
}

function summarizeTrack(track) {
  if (!track) return null;
  let settings = {};
  try {
    settings = track.getSettings?.() ?? {};
  } catch {
    // Some older Safari versions throw while a track is stopping.
  }
  return {
    label: track.label || "",
    readyState: track.readyState,
    enabled: track.enabled,
    muted: track.muted,
    settings: {
      width: settings.width,
      height: settings.height,
      frameRate: settings.frameRate,
      facingMode: settings.facingMode,
      deviceId: settings.deviceId
    }
  };
}

/**
 * Camera + on-device MediaPipe integration for static ES-module deployments.
 * Construction has no side effects: `getUserMedia()` is called only by start(),
 * which the UI must invoke from an explicit user action.
 */
export class CameraController extends EventTarget {
  constructor(options = {}) {
    super();
    this.options = { ...DEFAULT_CAMERA_OPTIONS, ...options };
    this.callbacks = options.callbacks ?? {};
    this.faceTracker = new FacePresenceTracker(this.options.faceTracker);
    this.gestureController = new PalmGestureController(this.options.gesture);
    this.state = CAMERA_STATES.IDLE;
    this.handEnabled = Boolean(this.options.handEnabled);
    this.debugEnabled = Boolean(this.options.debug);
    this.activity = { timerRunning: false, isBreak: false };
    this.stream = null;
    this.videoTrack = null;
    this.video = null;
    this.ownsVideo = false;
    this.visionModule = null;
    this.visionFileset = null;
    this.faceDetector = null;
    this.handLandmarker = null;
    this.startPromise = null;
    this.processing = false;
    this.scheduleTimerId = null;
    this.animationFrameId = null;
    this.runToken = 0;
    this.lastVideoTime = -1;
    this.lastFrameAdvancedAt = null;
    this.lastTaskTimestamp = -1;
    this.lastBrightnessAt = Number.NEGATIVE_INFINITY;
    this.latestFace = this.faceTracker.getSnapshot();
    this.latestHand = null;
    this.latestLuminance = null;
    this.brightnessState = "unknown";
    this.analysisTimes = [];
    this.metrics = {
      analysisFps: 0,
      processingMs: 0,
      faceProcessingMs: 0,
      handProcessingMs: 0,
      adaptiveIntervalMs: this.options.idleIntervalMs,
      analyzedFrames: 0,
      skippedFrames: 0,
      consecutiveErrors: 0,
      luminance: null,
      brightness: "unknown",
      updatedAt: null
    };
    this.canvas = null;
    this.canvasContext = null;
    this.boundVisibilityChange = () => this.#handleVisibilityChange();
    this.boundTrackEnded = () => void this.#enterRuntimeError(new CameraError(
      "CAMERA_ENDED",
      "カメラ映像が中断されました。通常のタイマーは引き続き使用できます。"
    ));
  }

  async start({ videoElement = null, handEnabled = this.handEnabled } = {}) {
    if (this.state === CAMERA_STATES.RUNNING || this.state === CAMERA_STATES.SUSPENDED) {
      return this.getSnapshot();
    }
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.#startInternal({ videoElement, handEnabled });
    try {
      return await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  async #startInternal({ videoElement, handEnabled }) {
    if (globalThis.isSecureContext === false) {
      const error = new CameraError(
        "INSECURE_CONTEXT",
        "カメラはHTTPS環境でのみ使用できます。"
      );
      this.#failStart(error);
      throw error;
    }
    if (!globalThis.navigator?.mediaDevices?.getUserMedia) {
      const error = new CameraError(
        "UNSUPPORTED",
        "このブラウザはカメラ取得APIに対応していません。"
      );
      this.#failStart(error);
      throw error;
    }

    this.runToken += 1;
    const token = this.runToken;
    this.handEnabled = Boolean(handEnabled);
    this.#setState(CAMERA_STATES.REQUESTING);

    try {
      this.stream = await requestCameraStream({
        audio: false,
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: this.options.width },
          height: { ideal: this.options.height },
          frameRate: { ideal: this.options.frameRate, max: 24 }
        }
      }, this.options.cameraRequestTimeoutMs);
      this.videoTrack = this.stream.getVideoTracks()[0] ?? null;
      this.video = videoElement ?? document.createElement("video");
      this.ownsVideo = !videoElement;
      this.#assertStartActive(token);
      this.videoTrack.addEventListener("ended", this.boundTrackEnded, { once: true });
      this.video.autoplay = true;
      this.video.muted = true;
      this.video.playsInline = true;
      this.video.setAttribute("playsinline", "");
      this.video.setAttribute("webkit-playsinline", "");
      this.video.srcObject = this.stream;
      await waitForMetadata(this.video);
      this.#assertStartActive(token);
      await this.video.play();
      this.#assertStartActive(token);

      this.#setState(CAMERA_STATES.LOADING);
      await this.#ensureFaceDetector();
      this.#assertStartActive(token);
      if (this.handEnabled) {
        try {
          await this.#ensureHandLandmarker();
        } catch (error) {
          this.#assertStartActive(token);
          // Face-based attendance can continue when the optional hand model fails.
          this.handEnabled = false;
          this.#emitError(new CameraError(
            "HAND_MODEL_LOAD_FAILED",
            "手の検出モデルを読み込めませんでした。顔検出のみで続行します。",
            { cause: error, recoverable: true }
          ));
        }
      }
      this.#assertStartActive(token);

      this.faceTracker.reset(monotonicNow());
      this.gestureController.reset();
      this.metrics.adaptiveIntervalMs = this.#baseInterval();
      this.metrics.consecutiveErrors = 0;
      this.lastVideoTime = -1;
      this.lastFrameAdvancedAt = monotonicNow();
      this.lastTaskTimestamp = -1;
      document.addEventListener("visibilitychange", this.boundVisibilityChange);
      this.#assertStartActive(token);

      if (document.visibilityState === "hidden") {
        this.#setState(CAMERA_STATES.SUSPENDED, { reason: "page_hidden" });
      } else {
        this.#setState(CAMERA_STATES.RUNNING);
        this.#scheduleNext(0, token);
      }
      return this.getSnapshot();
    } catch (rawError) {
      const cancelled = token !== this.runToken || rawError?.code === "START_CANCELLED";
      const error = cancelled
        ? new CameraError("START_CANCELLED", "カメラ開始が中断されました。", { recoverable: true })
        : normalizeCameraError(rawError, "MODEL_OR_CAMERA_FAILED");
      await this.#cleanupResources();
      if (cancelled) {
        if (this.state !== CAMERA_STATES.IDLE && this.state !== CAMERA_STATES.ERROR) {
          this.#setState(CAMERA_STATES.IDLE, { reason: "start_cancelled" });
        }
        throw error;
      }
      this.#setState(CAMERA_STATES.ERROR, { error: error.toJSON() });
      this.#emitError(error);
      throw error;
    }
  }

  #assertStartActive(token) {
    if (token !== this.runToken || !this.stream || !this.video) {
      throw new CameraError("START_CANCELLED", "カメラ開始が中断されました。", {
        recoverable: true
      });
    }
    if (!this.videoTrack || this.videoTrack.readyState === "ended") {
      throw new CameraError("CAMERA_ENDED", "カメラ映像が開始前に中断されました。");
    }
  }

  #failStart(error) {
    this.#setState(CAMERA_STATES.ERROR, { error: error.toJSON() });
    this.#emitError(error);
  }

  async stop() {
    this.runToken += 1;
    if (this.state !== CAMERA_STATES.IDLE) this.#setState(CAMERA_STATES.STOPPING);
    await this.#cleanupResources();
    this.faceTracker.reset(monotonicNow());
    this.gestureController.reset();
    this.latestFace = this.faceTracker.getSnapshot();
    this.latestHand = null;
    this.#setState(CAMERA_STATES.IDLE);
    return this.getSnapshot();
  }

  async dispose() {
    return this.stop();
  }

  async setHandEnabled(enabled) {
    const next = Boolean(enabled);
    this.handEnabled = next;
    if (!next) {
      this.gestureController.process(false, monotonicNow());
      try {
        this.handLandmarker?.close?.();
      } catch {
        // Releasing the optional model must not break the timer.
      }
      this.handLandmarker = null;
      this.latestHand = null;
      return this.getSnapshot();
    }

    if (this.state === CAMERA_STATES.RUNNING || this.state === CAMERA_STATES.SUSPENDED) {
      try {
        await this.#ensureHandLandmarker();
      } catch (cause) {
        this.handEnabled = false;
        const error = new CameraError(
          "HAND_MODEL_LOAD_FAILED",
          "手の検出モデルを読み込めませんでした。",
          { cause, recoverable: true }
        );
        this.#emitError(error);
        throw error;
      }
    }
    return this.getSnapshot();
  }

  setActivity(activity) {
    if (typeof activity === "boolean") {
      this.activity = { timerRunning: activity, isBreak: false };
    } else if (typeof activity === "string") {
      this.activity = {
        timerRunning: activity === "running" || activity === "active",
        isBreak: activity === "break"
      };
    } else {
      this.activity = {
        timerRunning: Boolean(activity?.timerRunning),
        isBreak: Boolean(activity?.isBreak)
      };
    }
    this.metrics.adaptiveIntervalMs = Math.max(
      this.#baseInterval(),
      Math.min(this.metrics.adaptiveIntervalMs, this.options.maxAdaptiveIntervalMs)
    );
    if (this.state === CAMERA_STATES.RUNNING) this.#scheduleNext(0, this.runToken);
    return this.getSnapshot();
  }

  setDebugEnabled(enabled) {
    this.debugEnabled = Boolean(enabled);
    return this.getDebugSnapshot();
  }

  simulateGesture(options = {}) {
    const result = this.gestureController.simulate(options);
    if (result.triggered) this.#emit("gesture", result.event);
    return result;
  }

  simulateFace(present, { samples = 10, now = monotonicNow(), intervalMs = 250 } = {}) {
    let snapshot = this.faceTracker.getSnapshot(now);
    for (let index = 0; index < samples; index += 1) {
      snapshot = this.faceTracker.updateDetected(Boolean(present), {
        now: now + index * intervalMs,
        score: present ? 1 : 0,
        faceCount: present ? 1 : 0
      });
    }
    this.latestFace = { ...snapshot, source: "simulation" };
    this.#emit("face", this.latestFace);
    return this.latestFace;
  }

  async #ensureVisionRuntime() {
    if (!this.visionModule) {
      try {
        this.visionModule = await import(this.options.moduleUrl);
      } catch (cause) {
        throw new CameraError(
          "MEDIAPIPE_IMPORT_FAILED",
          "MediaPipe Tasks Visionを読み込めませんでした。",
          { cause }
        );
      }
    }
    if (!this.visionFileset) {
      try {
        this.visionFileset = await this.visionModule.FilesetResolver.forVisionTasks(
          this.options.wasmUrl
        );
      } catch (cause) {
        throw new CameraError(
          "MEDIAPIPE_WASM_FAILED",
          "MediaPipeの実行ファイルを読み込めませんでした。",
          { cause }
        );
      }
    }
  }

  async #createTask(TaskClass, taskOptions) {
    const requestedDelegate = this.options.delegate || "GPU";
    const delegates = [...new Set([requestedDelegate, "CPU"])];
    let lastError = null;
    for (const delegate of delegates) {
      try {
        return await TaskClass.createFromOptions(this.visionFileset, {
          ...taskOptions,
          baseOptions: { ...taskOptions.baseOptions, delegate }
        });
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error("Unable to create MediaPipe task");
  }

  async #ensureFaceDetector() {
    if (this.faceDetector) return this.faceDetector;
    await this.#ensureVisionRuntime();
    try {
      this.faceDetector = await this.#createTask(this.visionModule.FaceDetector, {
        baseOptions: { modelAssetPath: this.options.faceModelUrl },
        runningMode: "VIDEO",
        minDetectionConfidence: this.faceTracker.options.minDetectionScore,
        minSuppressionThreshold: 0.3
      });
      return this.faceDetector;
    } catch (cause) {
      throw new CameraError(
        "FACE_MODEL_LOAD_FAILED",
        "顔検出モデルを読み込めませんでした。",
        { cause }
      );
    }
  }

  async #ensureHandLandmarker() {
    if (this.handLandmarker) return this.handLandmarker;
    await this.#ensureVisionRuntime();
    try {
      this.handLandmarker = await this.#createTask(this.visionModule.HandLandmarker, {
        baseOptions: { modelAssetPath: this.options.handModelUrl },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      return this.handLandmarker;
    } catch (cause) {
      throw new CameraError(
        "HAND_MODEL_LOAD_FAILED",
        "手の検出モデルを読み込めませんでした。",
        { cause, recoverable: true }
      );
    }
  }

  #scheduleNext(delayMs, token) {
    this.#cancelSchedule();
    if (token !== this.runToken || this.state !== CAMERA_STATES.RUNNING) return;
    this.scheduleTimerId = setTimeout(() => {
      this.scheduleTimerId = null;
      this.animationFrameId = requestAnimationFrame((timestamp) => {
        this.animationFrameId = null;
        void this.#tick(timestamp, token);
      });
    }, Math.max(0, delayMs));
  }

  async #tick(timestamp, token) {
    if (token !== this.runToken || this.state !== CAMERA_STATES.RUNNING) return;
    if (document.visibilityState === "hidden") {
      this.#handleVisibilityChange();
      return;
    }
    if (this.processing) {
      this.metrics.skippedFrames += 1;
      this.#scheduleNext(this.metrics.adaptiveIntervalMs, token);
      return;
    }
    if (!this.video || this.video.readyState < 2 || this.video.videoWidth === 0) {
      this.metrics.skippedFrames += 1;
      if (this.#frameHasStalled()) {
        await this.#enterRuntimeError(new CameraError(
          "VIDEO_STALLED",
          "カメラ映像が停止しました。通常のタイマーは引き続き使用できます。"
        ));
        return;
      }
      this.#scheduleNext(100, token);
      return;
    }
    if (this.video.currentTime === this.lastVideoTime) {
      this.metrics.skippedFrames += 1;
      if (this.#frameHasStalled()) {
        await this.#enterRuntimeError(new CameraError(
          "VIDEO_STALLED",
          "カメラ映像が更新されていません。通常のタイマーは引き続き使用できます。"
        ));
        return;
      }
      this.#scheduleNext(Math.min(100, this.metrics.adaptiveIntervalMs), token);
      return;
    }

    this.processing = true;
    this.lastVideoTime = this.video.currentTime;
    this.lastFrameAdvancedAt = monotonicNow();
    const startedAt = monotonicNow();
    try {
      await this.#analyzeFrame(timestamp);
      const processingMs = monotonicNow() - startedAt;
      this.metrics.consecutiveErrors = 0;
      this.#updateMetrics(timestamp, processingMs);
      this.#adaptInterval(processingMs);
      this.#emit("metrics", { ...this.metrics });
    } catch (cause) {
      this.metrics.consecutiveErrors += 1;
      this.metrics.skippedFrames += 1;
      this.#adaptInterval(this.metrics.adaptiveIntervalMs);
      const error = new CameraError(
        "PROCESSING_FAILED",
        "カメラ解析に失敗しました。通常のタイマーは引き続き使用できます。",
        { cause, recoverable: this.metrics.consecutiveErrors < 5 }
      );
      if (this.metrics.consecutiveErrors >= 5) {
        await this.#enterRuntimeError(error);
        return;
      }
      this.#emitError(error);
    } finally {
      this.processing = false;
    }

    this.#scheduleNext(this.metrics.adaptiveIntervalMs, token);
  }

  #frameHasStalled() {
    if (this.lastFrameAdvancedAt === null) return false;
    return monotonicNow() - this.lastFrameAdvancedAt >= this.options.frameStallTimeoutMs;
  }

  async #enterRuntimeError(error) {
    if ([CAMERA_STATES.IDLE, CAMERA_STATES.STOPPING, CAMERA_STATES.ERROR].includes(this.state)) {
      return;
    }
    this.runToken += 1;
    const normalized = normalizeCameraError(error, "CAMERA_RUNTIME_FAILED");
    await this.#cleanupResources();
    this.#setState(CAMERA_STATES.ERROR, { error: normalized.toJSON() });
    this.#emitError(normalized);
  }

  async #analyzeFrame(timestamp) {
    // MediaPipe VIDEO timestamps must be monotonically increasing.
    const taskTimestamp = Math.max(timestamp, this.lastTaskTimestamp + 0.01);
    this.lastTaskTimestamp = taskTimestamp;

    const faceStartedAt = monotonicNow();
    const faceResult = this.faceDetector.detectForVideo(this.video, taskTimestamp);
    this.metrics.faceProcessingMs = monotonicNow() - faceStartedAt;
    const face = this.faceTracker.updateResult(faceResult, taskTimestamp);
    this.latestFace = { ...face, timestamp: taskTimestamp, source: "camera" };
    this.#emit("face", this.latestFace);

    if (this.handEnabled && this.handLandmarker) {
      const handStartedAt = monotonicNow();
      const handResult = this.handLandmarker.detectForVideo(this.video, taskTimestamp);
      this.metrics.handProcessingMs = monotonicNow() - handStartedAt;
      this.latestHand = {
        ...analyzeHandLandmarkerResult(handResult, this.options.handAnalysis),
        timestamp: taskTimestamp,
        source: "camera"
      };
      this.#emit("hand", this.latestHand);
      const gesture = this.gestureController.process(this.latestHand, taskTimestamp);
      if (gesture.triggered) this.#emit("gesture", gesture.event);
    } else {
      this.metrics.handProcessingMs = 0;
      this.gestureController.process(false, taskTimestamp);
      this.latestHand = null;
    }

    if (taskTimestamp - this.lastBrightnessAt >= this.options.brightnessIntervalMs) {
      this.lastBrightnessAt = taskTimestamp;
      this.#measureBrightness();
    }
  }

  #measureBrightness() {
    try {
      if (!this.canvas) {
        this.canvas = document.createElement("canvas");
        this.canvas.width = 32;
        this.canvas.height = 24;
        this.canvasContext = this.canvas.getContext("2d", { willReadFrequently: true });
      }
      if (!this.canvasContext) return;
      this.canvasContext.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      const pixels = this.canvasContext.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
      let total = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        total += pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
      }
      const luminance = total / (pixels.length / 4) / 255;
      this.latestLuminance = clamp(luminance);
      this.brightnessState = luminance <= this.options.blockedLuminanceThreshold
        ? "possibly_blocked"
        : luminance < this.options.darkLuminanceThreshold
          ? "dark"
          : "normal";
      this.metrics.luminance = this.latestLuminance;
      this.metrics.brightness = this.brightnessState;
    } catch (cause) {
      this.latestLuminance = null;
      this.brightnessState = "unavailable";
      this.metrics.luminance = null;
      this.metrics.brightness = "unavailable";
      this.#emitError(new CameraError(
        "BRIGHTNESS_UNAVAILABLE",
        "映像の明るさを判定できませんでした。",
        { cause, recoverable: true }
      ));
    }
  }

  #updateMetrics(timestamp, processingMs) {
    this.metrics.processingMs = processingMs;
    this.metrics.analyzedFrames += 1;
    this.metrics.updatedAt = timestamp;
    this.analysisTimes.push(timestamp);
    const cutoff = timestamp - 5_000;
    while (this.analysisTimes.length > 1 && this.analysisTimes[0] < cutoff) {
      this.analysisTimes.shift();
    }
    if (this.analysisTimes.length > 1) {
      const span = this.analysisTimes[this.analysisTimes.length - 1] - this.analysisTimes[0];
      this.metrics.analysisFps = span > 0
        ? ((this.analysisTimes.length - 1) * 1_000) / span
        : 0;
    } else {
      this.metrics.analysisFps = 0;
    }
  }

  #adaptInterval(processingMs) {
    const base = this.#baseInterval();
    const current = Math.max(base, this.metrics.adaptiveIntervalMs);
    const maximum = Math.max(base, this.options.maxAdaptiveIntervalMs);
    if (processingMs > current * 0.65) {
      this.metrics.adaptiveIntervalMs = Math.min(
        maximum,
        Math.max(current * 1.25, processingMs * 1.8)
      );
    } else if (processingMs < current * 0.35 && current > base) {
      this.metrics.adaptiveIntervalMs = Math.max(base, current * 0.9);
    } else {
      this.metrics.adaptiveIntervalMs = current;
    }
    this.metrics.adaptiveIntervalMs = Math.round(this.metrics.adaptiveIntervalMs);
  }

  #baseInterval() {
    return this.activity.timerRunning && !this.activity.isBreak
      ? this.options.activeIntervalMs
      : this.options.idleIntervalMs;
  }

  #handleVisibilityChange() {
    if (document.visibilityState === "hidden") {
      if (this.state === CAMERA_STATES.RUNNING) {
        this.#cancelSchedule();
        this.#setState(CAMERA_STATES.SUSPENDED, { reason: "page_hidden" });
      }
      return;
    }
    if (this.state === CAMERA_STATES.SUSPENDED && this.stream) {
      this.lastVideoTime = -1;
      this.lastFrameAdvancedAt = monotonicNow();
      this.faceTracker.reset(monotonicNow());
      this.latestFace = this.faceTracker.getSnapshot();
      this.gestureController.reset({ preserveCooldown: true });
      this.latestHand = null;
      this.#setState(CAMERA_STATES.RUNNING, { reason: "page_visible" });
      this.#scheduleNext(0, this.runToken);
    }
  }

  #cancelSchedule() {
    if (this.scheduleTimerId !== null) clearTimeout(this.scheduleTimerId);
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
    this.scheduleTimerId = null;
    this.animationFrameId = null;
  }

  async #cleanupResources() {
    this.#cancelSchedule();
    document.removeEventListener("visibilitychange", this.boundVisibilityChange);
    this.processing = false;

    this.videoTrack?.removeEventListener("ended", this.boundTrackEnded);

    try {
      this.faceDetector?.close?.();
    } catch {
      // Cleanup is best-effort; tracks are still stopped below.
    }
    try {
      this.handLandmarker?.close?.();
    } catch {
      // Cleanup is best-effort.
    }
    this.faceDetector = null;
    this.handLandmarker = null;
    this.visionFileset = null;
    this.visionModule = null;

    for (const track of this.stream?.getTracks?.() ?? []) {
      try {
        track.stop();
      } catch {
        // A track may already have ended.
      }
    }
    if (this.video) {
      try {
        this.video.pause();
        this.video.srcObject = null;
      } catch {
        // Safari can throw while detaching an interrupted stream.
      }
    }
    this.stream = null;
    this.videoTrack = null;
    this.video = null;
    this.ownsVideo = false;
    this.canvas = null;
    this.canvasContext = null;
    this.lastFrameAdvancedAt = null;
  }

  #setState(state, metadata = {}) {
    const previousState = this.state;
    this.state = state;
    this.#emit("state", {
      state,
      previousState,
      ...metadata,
      snapshot: this.getSnapshot()
    });
  }

  #emitError(error) {
    const normalized = normalizeCameraError(error);
    this.#emit("error", {
      ...normalized.toJSON(),
      error: normalized,
      state: this.state
    });
  }

  #emit(type, detail) {
    this.dispatchEvent(customEvent(type, detail));
    this.callbacks?.[callbackName(type)]?.(detail);
  }

  getSnapshot() {
    const track = this.stream?.getVideoTracks?.()[0] ?? null;
    const streamActive = Boolean(
      track
      && track.readyState !== "ended"
      && ![CAMERA_STATES.IDLE, CAMERA_STATES.STOPPING, CAMERA_STATES.ERROR].includes(this.state)
    );
    return {
      state: this.state,
      active: streamActive,
      suspended: this.state === CAMERA_STATES.SUSPENDED,
      handEnabled: this.handEnabled,
      debugEnabled: this.debugEnabled,
      visibilityState: globalThis.document?.visibilityState ?? "unknown",
      activity: { ...this.activity },
      track: summarizeTrack(track),
      face: this.latestFace,
      hand: this.latestHand,
      gesture: this.gestureController.getSnapshot(),
      luminance: this.latestLuminance,
      brightness: this.brightnessState,
      metrics: { ...this.metrics },
      models: {
        runtime: Boolean(this.visionFileset),
        face: Boolean(this.faceDetector),
        hand: Boolean(this.handLandmarker)
      }
    };
  }

  getDebugSnapshot() {
    return {
      ...this.getSnapshot(),
      faceHistory: this.faceTracker.getSnapshot().recent,
      video: this.video
        ? {
            currentTime: this.video.currentTime,
            readyState: this.video.readyState,
            width: this.video.videoWidth,
            height: this.video.videoHeight
          }
        : null,
      privacy: {
        videoStored: false,
        videoUploaded: false,
        framesRetained: false
      }
    };
  }

  getVideoElement() {
    return this.video;
  }
}

export const CameraManager = CameraController;

export function createCameraController(options) {
  return new CameraController(options);
}
