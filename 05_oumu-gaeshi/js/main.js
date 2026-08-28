(() => {
  "use strict";

  const STORAGE_KEY = "oumu-gaeshi-settings-v1";
  const STATES = Object.freeze({
    IDLE: "IDLE",
    LISTENING: "LISTENING",
    RECORDING: "RECORDING",
    PROCESSING: "PROCESSING",
    PLAYING: "PLAYING",
    ERROR: "ERROR",
  });
  const DEFAULTS = Object.freeze({
    threshold: 0.055,
    preRollMs: 400,
    silenceMs: 800,
    minRecordingMs: 300,
    maxRecordingSeconds: 15,
    responseDelayMs: 250,
    restartDelayMs: 500,
    playbackRate: 1.25,
    mode: "parrot",
    echoEnabled: false,
    echoCount: 3,
    echoIntervalMs: 400,
  });
  const STATUS = {
    IDLE: ["準備できました", "開始するとマイクの許可を確認します"],
    LISTENING: ["聞いています", "話しかけてください"],
    RECORDING: ["録音中", "話し終わるまで聞いています"],
    PROCESSING: ["考え中", "まねする準備をしています"],
    PLAYING: ["しゃべっています", "オウムがまねしています"],
    ERROR: ["エラー", "下の案内を確認してください"],
  };
  const MODE_NAMES = {
    normal: "普通", parrot: "オウム", tiny: "チビ声", monster: "怪物",
    fast: "早口", slow: "スロー", random: "ランダム", custom: "カスタム",
  };

  const byId = (id) => document.getElementById(id);
  const ui = {
    parrot: byId("parrot"), statusLabel: byId("statusLabel"), statusHint: byId("statusHint"),
    startButton: byId("startButton"), controls: byId("controls"), stopButton: byId("stopButton"),
    meterTrack: byId("meterTrack"), meterFill: byId("meterFill"), thresholdMarker: byId("thresholdMarker"), levelValue: byId("levelValue"),
    rateSlider: byId("rateSlider"), rateValue: byId("rateValue"), pitchPresets: byId("pitchPresets"), currentMode: byId("currentMode"), modeGrid: byId("modeGrid"),
    echoToggle: byId("echoToggle"), thresholdInput: byId("thresholdInput"), thresholdOutput: byId("thresholdOutput"),
    preRollInput: byId("preRollInput"), silenceInput: byId("silenceInput"), minRecordingInput: byId("minRecordingInput"), maxRecordingInput: byId("maxRecordingInput"),
    responseDelayInput: byId("responseDelayInput"), restartDelayInput: byId("restartDelayInput"),
    echoCountInput: byId("echoCountInput"), echoIntervalInput: byId("echoIntervalInput"), resetSettingsButton: byId("resetSettingsButton"),
    clearLogButton: byId("clearLogButton"), debugLog: byId("debugLog"),
    debugPermission: byId("debugPermission"), debugAudioContext: byId("debugAudioContext"), debugRecorder: byId("debugRecorder"),
    debugState: byId("debugState"), debugLevel: byId("debugLevel"), debugThreshold: byId("debugThreshold"),
    debugSilence: byId("debugSilence"), debugStartedAt: byId("debugStartedAt"), debugDuration: byId("debugDuration"),
    debugRate: byId("debugRate"), debugBlobSize: byId("debugBlobSize"), debugMime: byId("debugMime"), debugError: byId("debugError"),
  };

  let settings = loadSettings();
  let state = STATES.IDLE;
  let audioContext = null;
  let stream = null;
  let sourceNode = null;
  let analyser = null;
  let analyserData = null;
  let mediaRecorder = null;
  let captureMode = "none";
  let captureNode = null;
  let captureMuteNode = null;
  let animationFrame = 0;
  let recordingChunks = [];
  let preRollChunks = [];
  let preRollSampleCount = 0;
  let recordingPcmChunks = [];
  let recordingPcmSampleCount = 0;
  let recordingStartedAt = 0;
  let silenceStartedAt = 0;
  let speechCandidateAt = 0;
  let smoothedLevel = 0;
  let noiseFloor = 0.006;
  let effectiveThreshold = settings.threshold;
  let activePlayback = [];
  let activeTimers = new Set();
  let logs = [];
  let lastMeterUpdate = 0;
  let lastPlaybackRate = settings.playbackRate;
  let lastRecordingDuration = 0;

  function loadSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return { ...DEFAULTS, ...stored };
    } catch (error) {
      console.warn("Could not load settings", error);
      return { ...DEFAULTS };
    }
  }

  function saveSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }
    catch (error) { console.warn("Could not save settings", error); }
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function setState(nextState, hint) {
    if (nextState === STATES.LISTENING) resetPreRoll();
    state = nextState;
    document.body.dataset.state = nextState;
    const [label, defaultHint] = STATUS[nextState];
    ui.statusLabel.textContent = label;
    ui.statusHint.textContent = hint || defaultHint;
    ui.debugState.textContent = nextState;
    ui.parrot.className = `parrot ${nextState.toLowerCase()}`;
  }

  function log(message) {
    const stamp = new Date().toLocaleTimeString("ja-JP", { hour12: false });
    logs.push(`${stamp} ${message}`);
    if (logs.length > 120) logs = logs.slice(-120);
    ui.debugLog.textContent = logs.join("\n") || "ログはまだありません";
    ui.debugLog.scrollTop = ui.debugLog.scrollHeight;
    console.info(`[オウム返し] ${message}`);
  }

  function setTimer(callback, delay) {
    const timer = window.setTimeout(() => {
      activeTimers.delete(timer);
      callback();
    }, delay);
    activeTimers.add(timer);
    return timer;
  }

  function clearTimers() {
    activeTimers.forEach((timer) => clearTimeout(timer));
    activeTimers.clear();
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  function updateDebug() {
    ui.debugAudioContext.textContent = audioContext ? audioContext.state : "未作成";
    if (captureMode === "audio-worklet") ui.debugRecorder.textContent = "PCM / AudioWorklet";
    else if (captureMode === "script-processor") ui.debugRecorder.textContent = "PCM / ScriptProcessor";
    else ui.debugRecorder.textContent = mediaRecorder ? `MediaRecorder / ${mediaRecorder.state}` : "未作成";
    ui.debugLevel.textContent = smoothedLevel.toFixed(3);
    ui.debugThreshold.textContent = effectiveThreshold.toFixed(3);
    ui.debugSilence.textContent = silenceStartedAt ? `${Math.round(performance.now() - silenceStartedAt)} ms` : "0 ms";
    ui.debugDuration.textContent = recordingStartedAt && state === STATES.RECORDING
      ? `${Math.round(performance.now() - recordingStartedAt)} ms`
      : `${lastRecordingDuration} ms`;
    ui.debugRate.textContent = Number(lastPlaybackRate).toFixed(2);
  }

  function renderSettings() {
    ui.rateSlider.value = settings.playbackRate;
    ui.rateValue.textContent = `${Number(settings.playbackRate).toFixed(2)}×`;
    ui.currentMode.textContent = MODE_NAMES[settings.mode] || MODE_NAMES.custom;
    ui.echoToggle.checked = settings.echoEnabled;
    ui.thresholdInput.value = settings.threshold;
    ui.thresholdOutput.textContent = `${(settings.threshold * 100).toFixed(1)}%`;
    ui.preRollInput.value = settings.preRollMs;
    ui.silenceInput.value = settings.silenceMs;
    ui.minRecordingInput.value = settings.minRecordingMs;
    ui.maxRecordingInput.value = settings.maxRecordingSeconds;
    ui.responseDelayInput.value = settings.responseDelayMs;
    ui.restartDelayInput.value = settings.restartDelayMs;
    ui.echoCountInput.value = settings.echoCount;
    ui.echoIntervalInput.value = settings.echoIntervalMs;
    ui.modeGrid.querySelectorAll("button").forEach((button) => button.classList.toggle("selected", button.dataset.mode === settings.mode));
    ui.pitchPresets.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("selected", Math.abs(Number(button.dataset.rate) - settings.playbackRate) < 0.001);
    });
    updateThresholdMarker();
    updateDebug();
  }

  function updateThresholdMarker() {
    const percent = Math.min(100, Math.max(0, effectiveThreshold * 400));
    ui.thresholdMarker.style.left = `${percent}%`;
  }

  function getPlaybackRate() {
    if (settings.mode === "random") return 0.65 + Math.random() * 0.95;
    return clampNumber(settings.playbackRate, 0.5, 2, 1);
  }

  function chooseMimeType() {
    const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
    return candidates.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || "";
  }

  function resetPreRoll() {
    preRollChunks = [];
    preRollSampleCount = 0;
  }

  function pushPreRoll(chunk) {
    preRollChunks.push(chunk);
    preRollSampleCount += chunk.length;
    const maximumSamples = Math.ceil((audioContext.sampleRate * settings.preRollMs) / 1000);
    while (preRollSampleCount > maximumSamples && preRollChunks.length > 1) {
      const removed = preRollChunks.shift();
      preRollSampleCount -= removed.length;
    }
    const overflow = preRollSampleCount - maximumSamples;
    if (overflow > 0 && preRollChunks.length) {
      preRollChunks[0] = preRollChunks[0].slice(overflow);
      preRollSampleCount -= overflow;
    }
  }

  function handlePcmChunk(chunk) {
    if (!chunk?.length) return;
    if (state === STATES.LISTENING) {
      pushPreRoll(chunk);
    } else if (state === STATES.RECORDING) {
      recordingPcmChunks.push(chunk);
      recordingPcmSampleCount += chunk.length;
    }
  }

  async function setupCapture() {
    captureMode = "none";
    captureMuteNode = audioContext.createGain();
    captureMuteNode.gain.value = 0;
    captureMuteNode.connect(audioContext.destination);

    if (audioContext.audioWorklet && window.AudioWorkletNode) {
      try {
        const moduleUrl = new URL("js/pcm-recorder-worklet.js", document.baseURI).href;
        await audioContext.audioWorklet.addModule(moduleUrl);
        captureNode = new AudioWorkletNode(audioContext, "pcm-recorder");
        captureNode.port.onmessage = (event) => handlePcmChunk(new Float32Array(event.data));
        sourceNode.connect(captureNode);
        captureNode.connect(captureMuteNode);
        captureMode = "audio-worklet";
        log(`pre-roll ready (${settings.preRollMs} ms, AudioWorklet)`);
        return;
      } catch (error) {
        console.warn("AudioWorklet initialization failed; using fallback", error);
        log("AudioWorklet unavailable; trying compatibility capture");
      }
    }

    if (audioContext.createScriptProcessor) {
      captureNode = audioContext.createScriptProcessor(2048, 1, 1);
      captureNode.onaudioprocess = (event) => {
        handlePcmChunk(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      sourceNode.connect(captureNode);
      captureNode.connect(captureMuteNode);
      captureMode = "script-processor";
      log(`pre-roll ready (${settings.preRollMs} ms, compatibility mode)`);
      return;
    }

    captureMuteNode.disconnect();
    captureMuteNode = null;
    if (!window.MediaRecorder) throw new Error("このブラウザは音声録音に対応していません。");
    captureMode = "media-recorder";
    log("pre-roll unavailable; using MediaRecorder fallback");
  }

  function disconnectCapture() {
    if (captureNode) {
      if ("onaudioprocess" in captureNode) captureNode.onaudioprocess = null;
      if (captureNode.port) captureNode.port.onmessage = null;
      try { captureNode.disconnect(); } catch (_) { /* already disconnected */ }
    }
    try { captureMuteNode?.disconnect(); } catch (_) { /* already disconnected */ }
    captureNode = null;
    captureMuteNode = null;
    captureMode = "none";
    resetPreRoll();
    recordingPcmChunks = [];
    recordingPcmSampleCount = 0;
  }

  async function queryPermission() {
    if (!navigator.permissions?.query) return;
    try {
      const result = await navigator.permissions.query({ name: "microphone" });
      ui.debugPermission.textContent = result.state;
      result.onchange = () => { ui.debugPermission.textContent = result.state; };
    } catch (_) {
      ui.debugPermission.textContent = "ブラウザ管理";
    }
  }

  async function startApp() {
    ui.startButton.disabled = true;
    ui.startButton.textContent = "マイクを準備しています…";
    ui.debugError.textContent = "なし";
    try {
      if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(location.hostname)) {
        throw new Error("マイクを使うにはHTTPSでページを開いてください。");
      }
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("このブラウザではマイクを利用できません。");
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("このブラウザは音声処理に対応していません。");

      audioContext = new AudioContextClass();
      if (audioContext.state === "suspended") await audioContext.resume();
      log("AudioContext ready");
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      ui.debugPermission.textContent = "granted";
      log("microphone ready");
      sourceNode = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.45;
      analyserData = new Float32Array(analyser.fftSize);
      sourceNode.connect(analyser);
      await setupCapture();
      noiseFloor = 0.006;
      ui.controls.hidden = false;
      ui.startButton.hidden = true;
      setState(STATES.LISTENING);
      monitorAudio();
      queryPermission();
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      disconnectCapture();
      if (audioContext && audioContext.state !== "closed") audioContext.close().catch(() => {});
      audioContext = null;
      handleError(error, microphoneErrorMessage(error));
      ui.startButton.disabled = false;
      ui.startButton.textContent = "もう一度試す";
    }
  }

  function microphoneErrorMessage(error) {
    if (error?.name === "NotAllowedError" || error?.name === "SecurityError") return "マイクが許可されませんでした。Safariのサイト設定からマイクを許可してください。";
    if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") return "利用できるマイクが見つかりません。";
    if (error?.name === "NotReadableError") return "マイクを開始できません。他のアプリが使用していないか確認してください。";
    return error?.message || "マイクの開始に失敗しました。";
  }

  function readLevel() {
    analyser.getFloatTimeDomainData(analyserData);
    let sum = 0;
    for (let i = 0; i < analyserData.length; i += 1) sum += analyserData[i] * analyserData[i];
    const rms = Math.sqrt(sum / analyserData.length);
    smoothedLevel = smoothedLevel * 0.55 + rms * 0.45;
    return smoothedLevel;
  }

  function monitorAudio(timestamp = performance.now()) {
    if (!analyser || !stream) return;
    const level = readLevel();

    if (state === STATES.LISTENING) {
      if (level < settings.threshold * 0.9) noiseFloor = noiseFloor * 0.985 + level * 0.015;
      effectiveThreshold = Math.min(0.3, Math.max(settings.threshold, noiseFloor * 2.6 + 0.004));
      if (level >= effectiveThreshold) {
        if (!speechCandidateAt) speechCandidateAt = timestamp;
        const confirmationMs = captureMode === "media-recorder" ? 35 : 90;
        if (timestamp - speechCandidateAt >= confirmationMs) beginRecording();
      } else {
        speechCandidateAt = 0;
      }
    } else if (state === STATES.RECORDING) {
      const duration = timestamp - recordingStartedAt;
      if (level < effectiveThreshold * 0.68) {
        if (!silenceStartedAt) silenceStartedAt = timestamp;
        if (duration >= settings.minRecordingMs && timestamp - silenceStartedAt >= settings.silenceMs) {
          log("silence detected");
          stopRecording();
        }
      } else {
        silenceStartedAt = 0;
      }
      if (duration >= settings.maxRecordingSeconds * 1000) {
        log("maximum recording time reached");
        stopRecording();
      }
    }

    if (timestamp - lastMeterUpdate > 50) {
      const meterPercent = Math.min(100, level * 400);
      ui.meterFill.style.width = `${meterPercent}%`;
      ui.levelValue.textContent = `${Math.round(meterPercent)}%`;
      ui.meterTrack.setAttribute("aria-valuenow", String(Math.round(meterPercent)));
      updateThresholdMarker();
      updateDebug();
      lastMeterUpdate = timestamp;
    }
    animationFrame = requestAnimationFrame(monitorAudio);
  }

  function createRecorder() {
    const mimeType = chooseMimeType();
    ui.debugMime.textContent = mimeType || "ブラウザ既定";
    return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  }

  function beginRecording() {
    if (state !== STATES.LISTENING) return;
    try {
      if (captureMode === "audio-worklet" || captureMode === "script-processor") {
        recordingPcmChunks = preRollChunks;
        recordingPcmSampleCount = preRollSampleCount;
        resetPreRoll();
      } else {
        recordingChunks = [];
        mediaRecorder = createRecorder();
        mediaRecorder.ondataavailable = (event) => { if (event.data?.size) recordingChunks.push(event.data); };
        mediaRecorder.onerror = (event) => handleError(event.error || new Error("録音中にエラーが発生しました。"));
        mediaRecorder.onstop = processMediaRecording;
        mediaRecorder.start(100);
      }
      recordingStartedAt = performance.now();
      silenceStartedAt = 0;
      speechCandidateAt = 0;
      ui.debugStartedAt.textContent = new Date().toLocaleTimeString("ja-JP", { hour12: false });
      setState(STATES.RECORDING);
      log("speech detected");
      log("recording started");
    } catch (error) {
      handleError(error, "録音を開始できませんでした。");
    }
  }

  function stopRecording() {
    if (state !== STATES.RECORDING) return;
    setState(STATES.PROCESSING);
    log("recording stopped");
    try {
      if (captureMode === "audio-worklet" || captureMode === "script-processor") {
        processPcmRecording().catch((error) => handleError(error, "音声データの生成に失敗しました。"));
      } else if (mediaRecorder?.state === "recording") {
        mediaRecorder.stop();
      } else {
        throw new Error("Recorder is not active");
      }
    } catch (error) {
      handleError(error, "録音の停止に失敗しました。");
    }
  }

  async function processMediaRecording() {
    const duration = Math.round(performance.now() - recordingStartedAt);
    const type = mediaRecorder?.mimeType || recordingChunks[0]?.type || "audio/mp4";
    const blob = new Blob(recordingChunks, { type });
    recordingChunks = [];
    await processBlob(blob, duration);
  }

  async function processPcmRecording() {
    const sampleRate = audioContext.sampleRate;
    const sampleCount = recordingPcmSampleCount;
    const chunks = recordingPcmChunks;
    recordingPcmChunks = [];
    recordingPcmSampleCount = 0;
    if (!sampleCount || !chunks.length) throw new Error("PCM recording is empty");
    const duration = Math.round((sampleCount / sampleRate) * 1000);
    const blob = encodeWav(chunks, sampleCount, sampleRate);
    await processBlob(blob, duration);
  }

  async function processBlob(blob, duration) {
    lastRecordingDuration = duration;
    recordingStartedAt = 0;
    silenceStartedAt = 0;
    ui.debugDuration.textContent = `${duration} ms`;
    ui.debugBlobSize.textContent = formatBytes(blob.size);
    ui.debugMime.textContent = blob.type || type;
    log(`blob created (${formatBytes(blob.size)}, ${blob.type || "unknown"})`);
    if (!blob.size) {
      handleError(new Error("Recorded blob is empty"), "音声データを作成できませんでした。");
      return;
    }

    try {
      await wait(settings.responseDelayMs);
      if (state !== STATES.PROCESSING) return;
      const playbackRate = getPlaybackRate();
      lastPlaybackRate = playbackRate;
      ui.debugRate.textContent = playbackRate.toFixed(2);
      await playBlob(blob, playbackRate);
      if (state !== STATES.PLAYING) return;
      log("playback ended");
      setState(STATES.PROCESSING, "もう一度聞く準備をしています");
      await wait(settings.restartDelayMs);
      if (state === STATES.PROCESSING) {
        noiseFloor = Math.max(0.006, noiseFloor * 0.85);
        speechCandidateAt = 0;
        setState(STATES.LISTENING);
        log("listening resumed");
      }
    } catch (error) {
      handleError(error, "録音した音声を再生できませんでした。");
    }
  }

  function encodeWav(chunks, sampleCount, sampleRate) {
    const bytesPerSample = 2;
    const buffer = new ArrayBuffer(44 + sampleCount * bytesPerSample);
    const view = new DataView(buffer);
    const writeText = (offset, text) => {
      for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
    };

    writeText(0, "RIFF");
    view.setUint32(4, 36 + sampleCount * bytesPerSample, true);
    writeText(8, "WAVE");
    writeText(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * bytesPerSample, true);
    view.setUint16(32, bytesPerSample, true);
    view.setUint16(34, 16, true);
    writeText(36, "data");
    view.setUint32(40, sampleCount * bytesPerSample, true);

    let outputOffset = 44;
    chunks.forEach((chunk) => {
      for (let index = 0; index < chunk.length; index += 1) {
        const sample = Math.max(-1, Math.min(1, chunk[index]));
        view.setInt16(outputOffset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        outputOffset += bytesPerSample;
      }
    });
    return new Blob([buffer], { type: "audio/wav" });
  }

  function wait(delay) {
    return new Promise((resolve) => setTimer(resolve, delay));
  }

  async function decodeBlob(blob) {
    const data = await blob.arrayBuffer();
    return audioContext.decodeAudioData(data.slice(0));
  }

  async function playBlob(blob, playbackRate) {
    if (audioContext.state === "suspended") await audioContext.resume();
    const audioBuffer = await decodeBlob(blob);
    setState(STATES.PLAYING);
    log(`playback started (rate ${playbackRate.toFixed(2)})`);
    const count = settings.echoEnabled ? settings.echoCount : 1;
    for (let index = 0; index < count; index += 1) {
      if (state !== STATES.PLAYING) return;
      const volume = index === 0 ? 1 : index === 1 ? 0.6 : Math.max(0.12, 0.3 * Math.pow(0.72, index - 2));
      await playAudioBuffer(audioBuffer, playbackRate, volume);
      if (index < count - 1) await wait(settings.echoIntervalMs);
    }
  }

  function playAudioBuffer(buffer, rate, volume) {
    return new Promise((resolve, reject) => {
      try {
        const source = audioContext.createBufferSource();
        const gain = audioContext.createGain();
        source.buffer = buffer;
        source.playbackRate.value = rate;
        gain.gain.value = volume;
        source.connect(gain).connect(audioContext.destination);
        activePlayback.push(source);
        source.onended = () => {
          activePlayback = activePlayback.filter((item) => item !== source);
          resolve();
        };
        source.start();
      } catch (error) { reject(error); }
    });
  }

  function stopPlayback() {
    activePlayback.forEach((source) => {
      try { source.stop(); } catch (_) { /* already stopped */ }
    });
    activePlayback = [];
  }

  function stopApp() {
    clearTimers();
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    stopPlayback();
    if (mediaRecorder?.state === "recording") {
      mediaRecorder.onstop = null;
      try { mediaRecorder.stop(); } catch (_) { /* recorder already stopped */ }
    }
    stream?.getTracks().forEach((track) => track.stop());
    disconnectCapture();
    sourceNode?.disconnect();
    analyser?.disconnect();
    if (audioContext && audioContext.state !== "closed") audioContext.close().catch(() => {});
    stream = null;
    sourceNode = null;
    analyser = null;
    analyserData = null;
    mediaRecorder = null;
    audioContext = null;
    smoothedLevel = 0;
    ui.meterFill.style.width = "0%";
    ui.levelValue.textContent = "0%";
    ui.controls.hidden = true;
    ui.startButton.hidden = false;
    ui.startButton.disabled = false;
    ui.startButton.textContent = "● オウム返しを開始";
    setState(STATES.IDLE);
    log("stopped");
    updateDebug();
  }

  function handleError(error, userMessage) {
    console.error("[オウム返し]", error);
    const detail = error?.message || String(error);
    ui.debugError.textContent = detail;
    setState(STATES.ERROR, userMessage || detail);
    log(`error: ${detail}`);
  }

  function updateSetting(key, value) {
    settings[key] = value;
    saveSettings();
    renderSettings();
  }

  ui.startButton.addEventListener("click", startApp);
  ui.stopButton.addEventListener("click", stopApp);
  ui.modeGrid.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-mode]");
    if (!button) return;
    settings.mode = button.dataset.mode;
    if (button.dataset.rate) settings.playbackRate = Number(button.dataset.rate);
    saveSettings();
    renderSettings();
  });
  ui.rateSlider.addEventListener("input", () => {
    settings.playbackRate = Number(ui.rateSlider.value);
    settings.mode = "custom";
    saveSettings();
    renderSettings();
  });
  ui.pitchPresets.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-rate]");
    if (!button) return;
    settings.playbackRate = Number(button.dataset.rate);
    settings.mode = "custom";
    saveSettings();
    renderSettings();
  });
  ui.echoToggle.addEventListener("change", () => updateSetting("echoEnabled", ui.echoToggle.checked));
  ui.thresholdInput.addEventListener("input", () => updateSetting("threshold", clampNumber(ui.thresholdInput.value, 0.01, 0.25, DEFAULTS.threshold)));
  ui.preRollInput.addEventListener("change", () => updateSetting("preRollMs", clampNumber(ui.preRollInput.value, 100, 1000, DEFAULTS.preRollMs)));
  ui.silenceInput.addEventListener("change", () => updateSetting("silenceMs", clampNumber(ui.silenceInput.value, 300, 3000, DEFAULTS.silenceMs)));
  ui.minRecordingInput.addEventListener("change", () => updateSetting("minRecordingMs", clampNumber(ui.minRecordingInput.value, 100, 3000, DEFAULTS.minRecordingMs)));
  ui.maxRecordingInput.addEventListener("change", () => updateSetting("maxRecordingSeconds", clampNumber(ui.maxRecordingInput.value, 3, 60, DEFAULTS.maxRecordingSeconds)));
  ui.responseDelayInput.addEventListener("change", () => updateSetting("responseDelayMs", clampNumber(ui.responseDelayInput.value, 0, 1500, DEFAULTS.responseDelayMs)));
  ui.restartDelayInput.addEventListener("change", () => updateSetting("restartDelayMs", clampNumber(ui.restartDelayInput.value, 0, 2000, DEFAULTS.restartDelayMs)));
  ui.echoCountInput.addEventListener("change", () => updateSetting("echoCount", clampNumber(ui.echoCountInput.value, 1, 5, DEFAULTS.echoCount)));
  ui.echoIntervalInput.addEventListener("change", () => updateSetting("echoIntervalMs", clampNumber(ui.echoIntervalInput.value, 100, 1500, DEFAULTS.echoIntervalMs)));
  ui.resetSettingsButton.addEventListener("click", () => { settings = { ...DEFAULTS }; saveSettings(); renderSettings(); });
  ui.clearLogButton.addEventListener("click", () => { logs = []; ui.debugLog.textContent = "ログはまだありません"; });
  window.addEventListener("pagehide", stopApp);

  setState(STATES.IDLE);
  renderSettings();
})();
