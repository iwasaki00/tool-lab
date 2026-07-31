import {
  DEFAULT_POMODORO,
  EXAM_WARNING_THRESHOLDS_MS,
  FACE_DETECTION,
  POMODORO_PHASES,
  RESUME_MODES,
  TIMER_DISPLAY_MODES,
  TIMER_EVENTS,
  TIMER_MODES,
  TIMER_STATES,
  TIMER_TICK_INTERVAL_MS,
} from "./constants.js";

const MINUTE_MS = 60_000;

const TRANSITIONS = Object.freeze({
  [TIMER_STATES.IDLE]: new Set([
    TIMER_STATES.RUNNING,
    TIMER_STATES.BREAK,
  ]),
  [TIMER_STATES.RUNNING]: new Set([
    TIMER_STATES.PAUSED,
    TIMER_STATES.ABSENCE_PENDING,
    TIMER_STATES.ABSENCE_PAUSED,
    TIMER_STATES.BREAK,
    TIMER_STATES.COMPLETED,
  ]),
  [TIMER_STATES.PAUSED]: new Set([
    TIMER_STATES.IDLE,
    TIMER_STATES.RUNNING,
    TIMER_STATES.BREAK,
    TIMER_STATES.COMPLETED,
  ]),
  [TIMER_STATES.ABSENCE_PENDING]: new Set([
    TIMER_STATES.RUNNING,
    TIMER_STATES.PAUSED,
    TIMER_STATES.ABSENCE_PAUSED,
    TIMER_STATES.BREAK,
    TIMER_STATES.COMPLETED,
  ]),
  [TIMER_STATES.ABSENCE_PAUSED]: new Set([
    TIMER_STATES.IDLE,
    TIMER_STATES.RUNNING,
    TIMER_STATES.COMPLETED,
  ]),
  [TIMER_STATES.BREAK]: new Set([
    TIMER_STATES.RUNNING,
    TIMER_STATES.PAUSED,
    TIMER_STATES.COMPLETED,
  ]),
  [TIMER_STATES.COMPLETED]: new Set([
    TIMER_STATES.IDLE,
    TIMER_STATES.RUNNING,
    TIMER_STATES.BREAK,
  ]),
  [TIMER_STATES.CAMERA_ERROR]: new Set([
    TIMER_STATES.IDLE,
    TIMER_STATES.RUNNING,
    TIMER_STATES.PAUSED,
  ]),
});

function clone(value) {
  if (value === undefined) return undefined;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function finiteNonNegative(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function positiveInteger(value, fallback) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeMode(mode) {
  return Object.values(TIMER_MODES).includes(mode) ? mode : TIMER_MODES.COUNTDOWN;
}

function normalizeConfig(options = {}) {
  const mode = normalizeMode(options.mode);
  const durationMinutes = finiteNonNegative(options.durationMinutes, mode === TIMER_MODES.EXAM ? 60 : 25);
  const durationMs = options.durationMs === null
    ? null
    : finiteNonNegative(options.durationMs, durationMinutes * MINUTE_MS);
  const absenceTimeoutSeconds = options.absenceTimeoutSeconds === null
    ? null
    : finiteNonNegative(options.absenceTimeoutSeconds, 30);
  const pomodoro = {
    ...DEFAULT_POMODORO,
    ...(options.pomodoro || {}),
  };
  pomodoro.studyMinutes = finiteNonNegative(pomodoro.studyMinutes, 25);
  pomodoro.shortBreakMinutes = finiteNonNegative(pomodoro.shortBreakMinutes, 5);
  pomodoro.longBreakMinutes = finiteNonNegative(pomodoro.longBreakMinutes, 15);
  pomodoro.longBreakEvery = positiveInteger(pomodoro.longBreakEvery, 4);
  pomodoro.autoStartBreak = Boolean(pomodoro.autoStartBreak);
  pomodoro.autoStartStudy = Boolean(pomodoro.autoStartStudy);

  const exam = {
    displayMode: TIMER_DISPLAY_MODES.REMAINING,
    pauseDisabled: false,
    lockEnabled: true,
    cameraAutoPauseEnabled: false,
    warningThresholdsMs: [...EXAM_WARNING_THRESHOLDS_MS],
    ...(options.exam || {}),
  };
  exam.pauseDisabled = Boolean(exam.pauseDisabled);
  exam.lockEnabled = Boolean(exam.lockEnabled);
  exam.cameraAutoPauseEnabled = Boolean(exam.cameraAutoPauseEnabled);
  exam.warningThresholdsMs = Array.isArray(exam.warningThresholdsMs)
    ? exam.warningThresholdsMs.map(Number).filter((value) => Number.isFinite(value) && value > 0)
    : [...EXAM_WARNING_THRESHOLDS_MS];

  const configuredThresholds = Array.isArray(options.thresholdsMs)
    ? options.thresholdsMs
    : mode === TIMER_MODES.EXAM
      ? exam.warningThresholdsMs
      : [];

  return {
    mode,
    durationMs: mode === TIMER_MODES.STOPWATCH ? null : durationMs,
    countUpEnabled: mode === TIMER_MODES.COUNTDOWN && Boolean(options.countUpEnabled),
    absenceDetectionEnabled: options.absenceDetectionEnabled !== false,
    absenceTimeoutMs: absenceTimeoutSeconds === null ? null : absenceTimeoutSeconds * 1_000,
    absencePendingAfterMs: finiteNonNegative(
      options.absencePendingAfterMs,
      FACE_DETECTION.pendingAfterMs,
    ),
    resumeMode: options.resumeMode === RESUME_MODES.AUTO
      ? RESUME_MODES.AUTO
      : RESUME_MODES.CONFIRM,
    thresholdsMs: [...new Set(configuredThresholds.map(Number)
      .filter((value) => Number.isFinite(value) && value > 0))]
      .sort((a, b) => b - a),
    pomodoro,
    exam,
  };
}

function customEvent(type, detail) {
  if (typeof CustomEvent === "function") return new CustomEvent(type, { detail });
  const event = new Event(type);
  Object.defineProperty(event, "detail", { value: detail });
  return event;
}

/**
 * Date-based timer and session state machine.
 *
 * Camera modules call reportFaceMissing/reportFacePresent with timestamps. UI
 * modules only consume snapshots and events; they never need to mutate state.
 */
export class StudyTimer extends EventTarget {
  constructor(options = {}) {
    super();
    this._clock = typeof options.now === "function" ? options.now : () => Date.now();
    this._autoTick = options.autoTick !== false;
    this._tickIntervalMs = positiveInteger(options.tickIntervalMs, TIMER_TICK_INTERVAL_MS);
    this._ticker = null;
    this._config = normalizeConfig(options);
    this._initializeRuntime(this._clock());
  }

  get mode() {
    return this._config.mode;
  }

  get config() {
    return clone(this._config);
  }

  get isRunning() {
    return [
      TIMER_STATES.RUNNING,
      TIMER_STATES.ABSENCE_PENDING,
      TIMER_STATES.BREAK,
    ].includes(this.state);
  }

  /** Configuration changes are accepted only outside an active session. */
  configure(update = {}, now = this._clock()) {
    if (![TIMER_STATES.IDLE, TIMER_STATES.COMPLETED].includes(this.state)) return false;
    const hasDurationMs = Object.prototype.hasOwnProperty.call(update, "durationMs");
    const hasDurationMinutes = Object.prototype.hasOwnProperty.call(update, "durationMinutes");
    const modeChanged = Object.prototype.hasOwnProperty.call(update, "mode")
      && update.mode !== this.mode;
    const hasAbsenceTimeout = Object.prototype.hasOwnProperty.call(update, "absenceTimeoutSeconds");
    const merged = {
      ...this._config,
      ...update,
      durationMs: hasDurationMs
        ? update.durationMs
        : hasDurationMinutes
          ? undefined
          : modeChanged
            ? undefined
            : this._config.durationMs,
      pomodoro: { ...this._config.pomodoro, ...(update.pomodoro || {}) },
      exam: { ...this._config.exam, ...(update.exam || {}) },
      absenceTimeoutSeconds: hasAbsenceTimeout
        ? update.absenceTimeoutSeconds
        : (this._config.absenceTimeoutMs === null ? null : this._config.absenceTimeoutMs / 1_000),
    };
    this._config = normalizeConfig(merged);
    this._initializeRuntime(now);
    this._emit(TIMER_EVENTS.CONFIG_CHANGE, { snapshot: this.getSnapshot(now) });
    return true;
  }

  start(now = this._clock()) {
    now = finiteNonNegative(now, this._clock());
    if (this._background) return false;

    if (this.state === TIMER_STATES.COMPLETED) {
      this._initializeRuntime(now);
    }

    if (this.state === TIMER_STATES.IDLE) {
      this.sessionStartedAt = now;
      this._lastAccountingAt = now;
      this._pauseReason = null;
      this._transition(this._activeStateForPhase(), "start", now);
    } else if (this.state === TIMER_STATES.PAUSED) {
      this.tick(now);
      this._pauseReason = null;
      this._lastAccountingAt = now;
      this._transition(this._activeStateForPhase(), "resume", now);
    } else {
      return this.isRunning;
    }

    this._ensureTicker();
    this._emitTick(now);
    return true;
  }

  pause(now = this._clock(), { force = false } = {}) {
    now = finiteNonNegative(now, this._clock());
    if (this._actionBlocked("pause", force, now)) return false;
    if (![TIMER_STATES.RUNNING, TIMER_STATES.ABSENCE_PENDING, TIMER_STATES.BREAK].includes(this.state)) {
      return false;
    }
    this.tick(now);
    if (![TIMER_STATES.RUNNING, TIMER_STATES.ABSENCE_PENDING, TIMER_STATES.BREAK].includes(this.state)) {
      return false;
    }
    this._cancelAbsenceCandidate("manual_pause", now);
    if (![TIMER_STATES.RUNNING, TIMER_STATES.ABSENCE_PENDING, TIMER_STATES.BREAK].includes(this.state)) {
      return false;
    }
    this._pauseReason = "manual";
    this._stats.pauseCount += 1;
    this._transition(TIMER_STATES.PAUSED, "manual_pause", now);
    this._emitTick(now);
    return true;
  }

  finish(now = this._clock(), options = {}) {
    now = finiteNonNegative(now, this._clock());
    const force = Boolean(options.force);
    if (this._actionBlocked("finish", force, now)) return null;
    if ([TIMER_STATES.IDLE, TIMER_STATES.COMPLETED].includes(this.state)) {
      return this.getSnapshot(now);
    }
    this.tick(now);
    if (this.state === TIMER_STATES.COMPLETED) return this.getSnapshot(now);
    const completed = options.completed
      ?? (this.mode === TIMER_MODES.STOPWATCH || this._targetReached);
    this._completeSession(Boolean(completed), now, completed ? "finished" : "stopped_early");
    this._emitTick(now);
    return this.getSnapshot(now);
  }

  reset(now = this._clock(), { force = false } = {}) {
    now = finiteNonNegative(now, this._clock());
    if (this._actionBlocked("reset", force, now)) return false;
    const previous = this.getSnapshot(now);
    this._initializeRuntime(now);
    this._emit(TIMER_EVENTS.RESET, {
      previous,
      snapshot: this.getSnapshot(now),
    });
    return true;
  }

  repeat(now = this._clock(), { force = false, autoStart = true } = {}) {
    if (!this.reset(now, { force })) return false;
    return autoStart ? this.start(now) : true;
  }

  /** End the current Pomodoro break without counting the skipped remainder. */
  skipBreak(now = this._clock()) {
    now = finiteNonNegative(now, this._clock());
    if (
      this.mode !== TIMER_MODES.POMODORO
      || this._phase.kind === POMODORO_PHASES.STUDY
      || ![TIMER_STATES.BREAK, TIMER_STATES.PAUSED].includes(this.state)
    ) return false;
    const breakKind = this._phase.kind;
    const completedStudySets = this._stats.completedStudySets;
    this.tick(now);
    if (
      this._phase.kind !== breakKind
      || this._stats.completedStudySets !== completedStudySets
      || ![TIMER_STATES.BREAK, TIMER_STATES.PAUSED].includes(this.state)
    ) return false;
    this._phase.elapsedMs = this._phase.durationMs;
    this._completeCurrentPhase(now);
    this._lastAccountingAt = now;
    this._ensureTicker();
    this._emitTick(now);
    return true;
  }

  /** Advance using wall-clock difference; delayed intervals do not lose time. */
  tick(now = this._clock()) {
    now = finiteNonNegative(now, this._clock());
    if (now < this._lastAccountingAt) now = this._lastAccountingAt;

    if (!this._background) {
      this._advanceBetween(this._lastAccountingAt, now);
      this._lastAccountingAt = now;
    }
    this._emitTick(now);
    return this.getSnapshot(now);
  }

  /** Start a possible absence. Stable face smoothing remains camera-owned. */
  reportFaceMissing(now = this._clock()) {
    now = finiteNonNegative(now, this._clock());
    this.tick(now);
    if (!this._canTrackAbsence() || this._absenceCandidate || this._activeAbsence) return false;

    const timeoutMs = this._config.absenceTimeoutMs;
    this._absenceCandidate = {
      detectedAt: now,
      warningAt: now + Math.min(this._config.absencePendingAfterMs, timeoutMs),
      pauseAt: now + timeoutMs,
    };
    this._emit(TIMER_EVENTS.ABSENCE_CHANGE, {
      type: "candidate_started",
      detectedAt: now,
      snapshot: this.getSnapshot(now),
    });
    return true;
  }

  beginAbsence(now = this._clock()) {
    return this.reportFaceMissing(now);
  }

  reportFacePresent(now = this._clock()) {
    now = finiteNonNegative(now, this._clock());
    this.tick(now);

    if (this._absenceCandidate) {
      this._cancelAbsenceCandidate("face_returned", now);
      return true;
    }

    if (this.state !== TIMER_STATES.ABSENCE_PAUSED || !this._activeAbsence) return false;
    if (this._activeAbsence.faceRedetectedAt !== null) return true;

    this._activeAbsence.faceRedetectedAt = now;
    this._activeAbsence.durationMs = Math.max(0, now - this._activeAbsence.detectedAt);
    this._emit(TIMER_EVENTS.ABSENCE_CHANGE, {
      type: "face_returned",
      event: clone(this._activeAbsence),
      requiresConfirmation: this._config.resumeMode !== RESUME_MODES.AUTO,
      snapshot: this.getSnapshot(now),
    });

    if (this._config.resumeMode === RESUME_MODES.AUTO) {
      this.resumeFromAbsence(now);
    }
    return true;
  }

  endAbsence(now = this._clock()) {
    return this.reportFacePresent(now);
  }

  resumeFromAbsence(now = this._clock(), { force = false } = {}) {
    now = finiteNonNegative(now, this._clock());
    this.tick(now);
    if (this.state !== TIMER_STATES.ABSENCE_PAUSED || !this._activeAbsence) return false;
    if (this._activeAbsence.faceRedetectedAt === null && !force) return false;

    this._activeAbsence.userResumedAt = now;
    this._emit(TIMER_EVENTS.ABSENCE_CHANGE, {
      type: "resumed",
      event: clone(this._activeAbsence),
      snapshot: this.getSnapshot(now),
    });
    this._activeAbsence = null;
    this._lastAccountingAt = now;
    this._transition(this._activeStateForPhase(), "absence_resume", now);
    this._ensureTicker();
    this._emitTick(now);
    return true;
  }

  /** Freeze accounting until the foreground confirmation has been answered. */
  enterBackground(now = this._clock()) {
    now = finiteNonNegative(now, this._clock());
    if (this._background) return false;
    this.tick(now);
    if ([TIMER_STATES.IDLE, TIMER_STATES.COMPLETED].includes(this.state)) return false;
    this._cancelAbsenceCandidate("background", now);
    if ([TIMER_STATES.IDLE, TIMER_STATES.COMPLETED, TIMER_STATES.PAUSED].includes(this.state)) {
      return false;
    }
    this._background = { startedAt: now, returnedAt: null };
    this._lastAccountingAt = now;
    this._stopTicker();
    this._emit(TIMER_EVENTS.BACKGROUND_CHANGE, {
      hidden: true,
      startedAt: now,
      snapshot: this.getSnapshot(now),
    });
    return true;
  }

  leaveBackground(now = this._clock()) {
    now = finiteNonNegative(now, this._clock());
    if (!this._background) return false;
    if (this._background.returnedAt === null) this._background.returnedAt = now;
    const durationMs = Math.max(0, this._background.returnedAt - this._background.startedAt);
    this._emit(TIMER_EVENTS.BACKGROUND_CHANGE, {
      hidden: false,
      returnedAt: this._background.returnedAt,
      durationMs,
      snapshot: this.getSnapshot(now),
    });
    this._emit(TIMER_EVENTS.BACKGROUND_QUESTION, {
      startedAt: this._background.startedAt,
      returnedAt: this._background.returnedAt,
      durationMs,
      snapshot: this.getSnapshot(now),
    });
    return true;
  }

  /**
   * Resolve the iOS background gap. If continued is false, the entire hidden
   * period is excluded. Time spent looking at the confirmation is never added.
   */
  resolveBackground(continued, now = this._clock()) {
    now = finiteNonNegative(now, this._clock());
    if (!this._background) return false;
    const background = this._background;
    const returnedAt = background.returnedAt ?? now;
    const durationMs = Math.max(0, returnedAt - background.startedAt);
    this._background = null;

    if (continued) {
      this._advanceBetween(background.startedAt, returnedAt);
    } else {
      this._stats.backgroundExcludedMs += durationMs;
    }
    this._lastAccountingAt = Math.max(now, returnedAt);
    this._emit(TIMER_EVENTS.BACKGROUND_CHANGE, {
      resolved: true,
      continued: Boolean(continued),
      durationMs,
      snapshot: this.getSnapshot(now),
    });
    this._ensureTicker();
    this._emitTick(now);
    return true;
  }

  handleVisibilityChange(visibilityState, now = this._clock()) {
    if (visibilityState === "hidden") return this.enterBackground(now);
    if (visibilityState === "visible") return this.leaveBackground(now);
    return false;
  }

  setExamLock(locked, now = this._clock()) {
    this._examLocked = this.mode === TIMER_MODES.EXAM && Boolean(locked);
    this._emit(TIMER_EVENTS.CONFIG_CHANGE, {
      examLocked: this._examLocked,
      snapshot: this.getSnapshot(now),
    });
    return this._examLocked;
  }

  setDisplayMode(displayMode, now = this._clock()) {
    if (!Object.values(TIMER_DISPLAY_MODES).includes(displayMode)) return false;
    this._displayMode = displayMode;
    this._emit(TIMER_EVENTS.CONFIG_CHANGE, {
      displayMode,
      snapshot: this.getSnapshot(now),
    });
    return true;
  }

  getSnapshot(now = this._clock()) {
    const remainingMs = this._remainingMs();
    const overtimeMs = this._targetReached
      ? Math.max(0, this._phase.elapsedMs - this._phase.durationMs)
      : 0;
    const setNumber = this._phase.kind === POMODORO_PHASES.STUDY
      ? this._stats.completedStudySets + 1
      : this._stats.completedStudySets;
    return {
      sessionId: this.sessionId,
      mode: this.mode,
      state: this.state,
      stateReason: this._stateReason,
      displayMode: this._displayMode,
      sessionStartedAt: this.sessionStartedAt,
      sessionEndedAt: this.sessionEndedAt,
      completionStatus: this.completionStatus,
      completed: this.completionStatus === "completed",
      targetReachedAt: this.targetReachedAt,
      durationMs: this._phase.durationMs,
      elapsedMs: this._phase.elapsedMs,
      remainingMs,
      overtimeMs,
      phase: {
        kind: this._phase.kind,
        durationMs: this._phase.durationMs,
        elapsedMs: this._phase.elapsedMs,
        remainingMs,
        setNumber,
        longBreakEvery: this._config.pomodoro.longBreakEvery,
      },
      stats: clone(this._stats),
      absenceCandidate: clone(this._absenceCandidate),
      activeAbsence: clone(this._activeAbsence),
      absenceEvents: clone(this._absenceEvents),
      background: this._background
        ? {
          ...clone(this._background),
          durationMs: Math.max(0, (this._background.returnedAt ?? now) - this._background.startedAt),
        }
        : null,
      pauseReason: this._pauseReason,
      examLocked: this._examLocked,
      notifiedThresholdsMs: [...this._notifiedThresholds],
      config: clone(this._config),
    };
  }

  destroy() {
    this._stopTicker();
  }

  _initializeRuntime(now) {
    this._stopTicker();
    this.sessionId = createId("session");
    this.state = TIMER_STATES.IDLE;
    this._stateReason = "initialized";
    this.sessionStartedAt = null;
    this.sessionEndedAt = null;
    this.completionStatus = null;
    this.targetReachedAt = null;
    this._targetReached = false;
    this._phase = this._createInitialPhase();
    this._stats = {
      actualStudyMs: 0,
      breakMs: 0,
      absenceMs: 0,
      manualPauseMs: 0,
      backgroundExcludedMs: 0,
      absenceCount: 0,
      pauseCount: 0,
      completedStudySets: 0,
    };
    this._absenceCandidate = null;
    this._activeAbsence = null;
    this._absenceEvents = [];
    this._background = null;
    this._pauseReason = null;
    this._lastAccountingAt = now;
    this._notifiedThresholds = new Set();
    this._examLocked = this.mode === TIMER_MODES.EXAM && this._config.exam.lockEnabled;
    this._displayMode = this.mode === TIMER_MODES.EXAM
      ? this._config.exam.displayMode
      : TIMER_DISPLAY_MODES.REMAINING;
  }

  _createInitialPhase() {
    if (this.mode === TIMER_MODES.POMODORO) {
      return this._newPhase(
        POMODORO_PHASES.STUDY,
        this._config.pomodoro.studyMinutes * MINUTE_MS,
      );
    }
    return this._newPhase(POMODORO_PHASES.STUDY, this._config.durationMs);
  }

  _newPhase(kind, durationMs) {
    this._notifiedThresholds?.clear();
    return {
      kind,
      durationMs: durationMs === null ? null : Math.max(0, durationMs),
      elapsedMs: 0,
    };
  }

  _activeStateForPhase() {
    return this._phase.kind === POMODORO_PHASES.STUDY
      ? TIMER_STATES.RUNNING
      : TIMER_STATES.BREAK;
  }

  _advanceBetween(from, to) {
    if (to <= from) {
      this._processDueBoundaries(to);
      return;
    }

    let cursor = from;
    let guard = 0;
    while (cursor < to && guard < 10_000) {
      guard += 1;
      if (this._processDueBoundaries(cursor)) continue;

      let next = to;
      if (this._absenceCandidate && this._canTrackAbsenceState()) {
        if (this.state === TIMER_STATES.RUNNING && this._absenceCandidate.warningAt > cursor) {
          next = Math.min(next, this._absenceCandidate.warningAt);
        }
        if (this._absenceCandidate.pauseAt > cursor) {
          next = Math.min(next, this._absenceCandidate.pauseAt);
        }
      }

      if (this._isPhaseAdvancing() && this._phase.durationMs !== null && !this._targetReached) {
        const remaining = this._remainingMs();
        if (remaining > 0) next = Math.min(next, cursor + remaining);
      }

      const delta = Math.max(0, next - cursor);
      if (delta === 0) break;
      this._accrueDelta(delta, next);
      cursor = next;
      this._processDueBoundaries(cursor);

      if (this.state === TIMER_STATES.COMPLETED) cursor = to;
    }
  }

  _processDueBoundaries(at) {
    if (this._absenceCandidate && this._canTrackAbsenceState()) {
      if (at >= this._absenceCandidate.pauseAt) {
        this._confirmAbsence(at);
        return true;
      }
      if (this.state === TIMER_STATES.RUNNING && at >= this._absenceCandidate.warningAt) {
        this._transition(TIMER_STATES.ABSENCE_PENDING, "absence_pending", at);
        this._emit(TIMER_EVENTS.ABSENCE_CHANGE, {
          type: "pending",
          detectedAt: this._absenceCandidate.detectedAt,
          pauseAt: this._absenceCandidate.pauseAt,
          snapshot: this.getSnapshot(at),
        });
        return true;
      }
    }

    if (
      this._isPhaseAdvancing()
      && this._phase.durationMs !== null
      && !this._targetReached
      && this._remainingMs() <= 0
    ) {
      // Presence is still ambiguous. Keep accruing until the candidate is
      // cancelled or confirmed, then either complete or roll the interval back.
      if (this._absenceCandidate) return false;
      if (this.mode === TIMER_MODES.COUNTDOWN && this._config.countUpEnabled) {
        this._targetReached = true;
        this.targetReachedAt = at;
        this._emit(TIMER_EVENTS.TARGET_REACHED, {
          at,
          snapshot: this.getSnapshot(at),
        });
      } else {
        this._completeCurrentPhase(at);
      }
      return true;
    }
    return false;
  }

  _accrueDelta(delta, at) {
    if (delta <= 0) return;
    if ([TIMER_STATES.RUNNING, TIMER_STATES.ABSENCE_PENDING].includes(this.state)) {
      const previousRemaining = this._remainingMs();
      this._phase.elapsedMs += delta;
      this._stats.actualStudyMs += delta;
      this._checkThresholds(previousRemaining, this._remainingMs(), at);
      return;
    }
    if (this.state === TIMER_STATES.BREAK) {
      this._phase.elapsedMs += delta;
      this._stats.breakMs += delta;
      return;
    }
    if (this.state === TIMER_STATES.PAUSED && this._pauseReason === "manual") {
      this._stats.manualPauseMs += delta;
      return;
    }
    if (
      this.state === TIMER_STATES.ABSENCE_PAUSED
      && this._activeAbsence
      && this._activeAbsence.faceRedetectedAt === null
    ) {
      this._stats.absenceMs += delta;
      this._activeAbsence.durationMs = Math.max(0, at - this._activeAbsence.detectedAt);
    }
  }

  _remainingMs() {
    if (this._phase.durationMs === null) return null;
    return Math.max(0, this._phase.durationMs - this._phase.elapsedMs);
  }

  _isPhaseAdvancing() {
    return [
      TIMER_STATES.RUNNING,
      TIMER_STATES.ABSENCE_PENDING,
      TIMER_STATES.BREAK,
    ].includes(this.state);
  }

  _completeCurrentPhase(at) {
    this._absenceCandidate = null;
    if (this.mode !== TIMER_MODES.POMODORO) {
      this._completeSession(true, at, "duration_elapsed");
      return;
    }

    const previousPhase = clone(this._phase);
    if (this._phase.kind === POMODORO_PHASES.STUDY) {
      this._stats.completedStudySets += 1;
      const isLongBreak = this._stats.completedStudySets % this._config.pomodoro.longBreakEvery === 0;
      const kind = isLongBreak ? POMODORO_PHASES.LONG_BREAK : POMODORO_PHASES.SHORT_BREAK;
      const minutes = isLongBreak
        ? this._config.pomodoro.longBreakMinutes
        : this._config.pomodoro.shortBreakMinutes;
      this._phase = this._newPhase(kind, minutes * MINUTE_MS);
      if (this._config.pomodoro.autoStartBreak) {
        this._pauseReason = null;
        this._transition(TIMER_STATES.BREAK, "pomodoro_break_started", at);
      } else {
        this._pauseReason = "phase_wait";
        this._transition(TIMER_STATES.PAUSED, "pomodoro_break_ready", at);
      }
    } else {
      this._phase = this._newPhase(
        POMODORO_PHASES.STUDY,
        this._config.pomodoro.studyMinutes * MINUTE_MS,
      );
      if (this._config.pomodoro.autoStartStudy) {
        this._pauseReason = null;
        this._transition(TIMER_STATES.RUNNING, "pomodoro_study_started", at);
      } else {
        this._pauseReason = "phase_wait";
        this._transition(TIMER_STATES.PAUSED, "pomodoro_study_ready", at);
      }
    }
    this._emit(TIMER_EVENTS.PHASE_CHANGE, {
      previousPhase,
      phase: clone(this._phase),
      snapshot: this.getSnapshot(at),
    });
  }

  _completeSession(completed, at, reason) {
    this._absenceCandidate = null;
    if (this._activeAbsence && this._activeAbsence.faceRedetectedAt === null) {
      this._activeAbsence.closedAt = at;
      this._activeAbsence.durationMs = Math.max(0, at - this._activeAbsence.detectedAt);
    }
    this.sessionEndedAt = at;
    this.completionStatus = completed ? "completed" : "interrupted";
    this._transition(TIMER_STATES.COMPLETED, reason, at);
    this._stopTicker();
    this._emit(TIMER_EVENTS.COMPLETED, {
      completed,
      reason,
      snapshot: this.getSnapshot(at),
    });
  }

  _canTrackAbsence() {
    return this._config.absenceDetectionEnabled
      && this._config.absenceTimeoutMs !== null
      && this._config.absenceTimeoutMs > 0
      && this.state === TIMER_STATES.RUNNING
      && this._phase.kind === POMODORO_PHASES.STUDY
      && (this.mode !== TIMER_MODES.EXAM || this._config.exam.cameraAutoPauseEnabled);
  }

  _canTrackAbsenceState() {
    return [TIMER_STATES.RUNNING, TIMER_STATES.ABSENCE_PENDING].includes(this.state)
      && this._phase.kind === POMODORO_PHASES.STUDY;
  }

  _confirmAbsence(at) {
    const candidate = this._absenceCandidate;
    if (!candidate) return false;
    const rollbackMs = Math.min(
      Math.max(0, at - candidate.detectedAt),
      this._phase.elapsedMs,
      this._stats.actualStudyMs,
    );
    this._phase.elapsedMs = Math.max(0, this._phase.elapsedMs - rollbackMs);
    this._stats.actualStudyMs = Math.max(0, this._stats.actualStudyMs - rollbackMs);
    if (
      this._targetReached
      && this._phase.durationMs !== null
      && this._phase.elapsedMs < this._phase.durationMs
    ) {
      this._targetReached = false;
      this.targetReachedAt = null;
    }
    this._stats.absenceMs += rollbackMs;
    this._stats.absenceCount += 1;

    const event = {
      id: createId("absence"),
      detectedAt: candidate.detectedAt,
      autoPausedAt: at,
      faceRedetectedAt: null,
      userResumedAt: null,
      closedAt: null,
      durationMs: rollbackMs,
      rollbackMs,
    };
    this._absenceEvents.push(event);
    this._activeAbsence = event;
    this._absenceCandidate = null;
    this._restoreRolledBackThresholds();
    this._transition(TIMER_STATES.ABSENCE_PAUSED, "absence_auto_pause", at);
    this._emit(TIMER_EVENTS.ABSENCE_CHANGE, {
      type: "auto_paused",
      event: clone(event),
      rollbackMs,
      snapshot: this.getSnapshot(at),
    });
    return true;
  }

  _cancelAbsenceCandidate(reason, at) {
    if (!this._absenceCandidate) return false;
    const candidate = this._absenceCandidate;
    this._absenceCandidate = null;
    const isCountUp = this.mode === TIMER_MODES.COUNTDOWN && this._config.countUpEnabled;
    if (!isCountUp && this._phase.durationMs !== null && this._phase.elapsedMs > this._phase.durationMs) {
      const deferredOverflowMs = this._phase.elapsedMs - this._phase.durationMs;
      this._phase.elapsedMs = this._phase.durationMs;
      this._stats.actualStudyMs = Math.max(0, this._stats.actualStudyMs - deferredOverflowMs);
    }
    if (this.state === TIMER_STATES.ABSENCE_PENDING) {
      this._transition(TIMER_STATES.RUNNING, reason, at);
    }
    this._emit(TIMER_EVENTS.ABSENCE_CHANGE, {
      type: "candidate_cancelled",
      reason,
      detectedAt: candidate.detectedAt,
      cancelledAt: at,
      snapshot: this.getSnapshot(at),
    });
    if (this._phase.durationMs !== null && !this._targetReached && this._remainingMs() <= 0) {
      this._processDueBoundaries(at);
    }
    return true;
  }

  _checkThresholds(previousRemaining, currentRemaining, at) {
    if (previousRemaining === null || currentRemaining === null) return;
    for (const thresholdMs of this._config.thresholdsMs) {
      if (
        !this._notifiedThresholds.has(thresholdMs)
        && previousRemaining > thresholdMs
        && currentRemaining <= thresholdMs
      ) {
        this._notifiedThresholds.add(thresholdMs);
        this._emit(TIMER_EVENTS.THRESHOLD, {
          thresholdMs,
          at,
          snapshot: this.getSnapshot(at),
        });
      }
    }
  }

  _restoreRolledBackThresholds() {
    const remaining = this._remainingMs();
    if (remaining === null) return;
    for (const thresholdMs of this._config.thresholdsMs) {
      if (remaining > thresholdMs) this._notifiedThresholds.delete(thresholdMs);
    }
  }

  _actionBlocked(action, force, now) {
    if (this.mode !== TIMER_MODES.EXAM || force) return false;
    const blocked = action === "pause"
      ? this._config.exam.pauseDisabled
      : ["reset", "finish"].includes(action) && this._examLocked;
    if (blocked) {
      this._emit(TIMER_EVENTS.LOCKED_ACTION, {
        action,
        at: now,
        snapshot: this.getSnapshot(now),
      });
    }
    return blocked;
  }

  _transition(nextState, reason, at) {
    if (nextState === this.state) {
      this._stateReason = reason;
      return true;
    }
    const allowed = TRANSITIONS[this.state];
    if (!allowed?.has(nextState)) {
      throw new Error(`Invalid timer transition: ${this.state} -> ${nextState}`);
    }
    const previousState = this.state;
    this.state = nextState;
    this._stateReason = reason;
    this._emit(TIMER_EVENTS.STATE_CHANGE, {
      from: previousState,
      to: nextState,
      reason,
      at,
      snapshot: this.getSnapshot(at),
    });
    return true;
  }

  _ensureTicker() {
    if (!this._autoTick || this._ticker || this._background) return;
    if ([TIMER_STATES.IDLE, TIMER_STATES.COMPLETED].includes(this.state)) return;
    this._ticker = setInterval(() => this.tick(this._clock()), this._tickIntervalMs);
  }

  _stopTicker() {
    if (this._ticker !== null) clearInterval(this._ticker);
    this._ticker = null;
  }

  _emitTick(now) {
    this._emit(TIMER_EVENTS.TICK, this.getSnapshot(now));
  }

  _emit(type, detail) {
    this.dispatchEvent(customEvent(type, detail));
  }
}

export default StudyTimer;
