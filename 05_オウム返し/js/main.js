(() => {
  "use strict";

  const STORAGE_KEY = "oumu-gaeshi-settings-v2";
  const LEGACY_STORAGE_KEY = "oumu-gaeshi-settings-v1";
  const MAX_HISTORY = 10;
  const STATES = Object.freeze({ IDLE: "IDLE", LISTENING: "LISTENING", RECORDING: "RECORDING", PROCESSING: "PROCESSING", PLAYING: "PLAYING", ERROR: "ERROR" });
  const DEFAULTS = Object.freeze({
    threshold: 0.055, preRollMs: 400, silenceMs: 800, minRecordingMs: 300,
    maxRecordingSeconds: 15, responseDelayMs: 250, restartDelayMs: 500,
    voiceMode: "parrot", emotion: "normal", reaction: "normal", randomBehavior: false, appMode: "normal",
    custom: { pitch: 0, speed: 1, echo: 0, reverb: 0, robot: false, tremolo: 0, lowPass: 0, highPass: 0, volume: 1, reverse: false },
  });
  const STATUS = {
    IDLE: ["準備できました", "開始するとマイクの許可を確認します"],
    LISTENING: ["聞いています", "話しかけてください"],
    RECORDING: ["録音中", "話し終わるまで聞いています"],
    PROCESSING: ["考え中", "まねする準備をしています"],
    PLAYING: ["しゃべっています", "オウムがまねしています"],
    ERROR: ["エラー", "下の案内を確認してください"],
  };
  const PARROT_FACE = { IDLE: "🦜", LISTENING: "🦜", RECORDING: "👂🦜", PROCESSING: "🤔🦜", PLAYING: "🗣️🦜", ERROR: "⚠️🦜" };

  const byId = (id) => document.getElementById(id);
  const ui = {
    parrot: byId("parrot"), statusLabel: byId("statusLabel"), statusHint: byId("statusHint"), startButton: byId("startButton"), controls: byId("controls"), stopButton: byId("stopButton"),
    meterTrack: byId("meterTrack"), meterFill: byId("meterFill"), thresholdMarker: byId("thresholdMarker"), levelValue: byId("levelValue"),
    liveWaveCanvas: byId("liveWaveCanvas"), resultWaveCanvas: byId("resultWaveCanvas"), latestWavePanel: byId("latestWavePanel"), latestDuration: byId("latestDuration"),
    modeGrid: byId("modeGrid"), currentMode: byId("currentMode"), voiceAnnouncement: byId("voiceAnnouncement"), pitchSlider: byId("pitchSlider"), pitchValue: byId("pitchValue"), speedSlider: byId("speedSlider"), speedValue: byId("speedValue"),
    customEchoInput: byId("customEchoInput"), customEchoValue: byId("customEchoValue"), customReverbInput: byId("customReverbInput"), customReverbValue: byId("customReverbValue"),
    customTremoloInput: byId("customTremoloInput"), customTremoloValue: byId("customTremoloValue"), customLowPassInput: byId("customLowPassInput"), customLowPassValue: byId("customLowPassValue"),
    customHighPassInput: byId("customHighPassInput"), customHighPassValue: byId("customHighPassValue"), customVolumeInput: byId("customVolumeInput"), customVolumeValue: byId("customVolumeValue"), customRobotInput: byId("customRobotInput"), customReverseInput: byId("customReverseInput"),
    emotionSelect: byId("emotionSelect"), reactionSelect: byId("reactionSelect"), appModeSelect: byId("appModeSelect"), randomBehaviorToggle: byId("randomBehaviorToggle"), historyCount: byId("historyCount"), historyList: byId("historyList"), favoriteList: byId("favoriteList"),
    thresholdInput: byId("thresholdInput"), thresholdOutput: byId("thresholdOutput"), preRollInput: byId("preRollInput"), silenceInput: byId("silenceInput"), minRecordingInput: byId("minRecordingInput"), maxRecordingInput: byId("maxRecordingInput"), responseDelayInput: byId("responseDelayInput"), restartDelayInput: byId("restartDelayInput"), resetSettingsButton: byId("resetSettingsButton"),
    clearLogButton: byId("clearLogButton"), debugLog: byId("debugLog"), debugPermission: byId("debugPermission"), debugAudioContext: byId("debugAudioContext"), debugRecorder: byId("debugRecorder"), debugState: byId("debugState"), debugLevel: byId("debugLevel"), debugThreshold: byId("debugThreshold"), debugSilence: byId("debugSilence"), debugStartedAt: byId("debugStartedAt"), debugDuration: byId("debugDuration"),
    debugPitchMethod: byId("debugPitchMethod"), debugBuffer: byId("debugBuffer"), debugSampleRate: byId("debugSampleRate"), debugNodeCount: byId("debugNodeCount"), debugEffectChain: byId("debugEffectChain"), debugPreset: byId("debugPreset"), debugIndexedDb: byId("debugIndexedDb"), debugHistoryCount: byId("debugHistoryCount"), debugBlobSize: byId("debugBlobSize"), debugMime: byId("debugMime"), debugError: byId("debugError"),
  };

  let settings = loadSettings();
  let state = STATES.IDLE;
  let audioContext = null, stream = null, sourceNode = null, analyser = null, analyserData = null, mediaRecorder = null;
  let captureMode = "none", captureNode = null, captureMuteNode = null, animationFrame = 0;
  let recordingChunks = [], preRollChunks = [], preRollSampleCount = 0, recordingPcmChunks = [], recordingPcmSampleCount = 0;
  let recordingStartedAt = 0, silenceStartedAt = 0, speechCandidateAt = 0, smoothedLevel = 0, noiseFloor = 0.006, effectiveThreshold = settings.threshold;
  let activeTimers = new Set(), logs = [], lastMeterUpdate = 0, lastRecordingDuration = 0, historyItems = [], favoriteItems = [], indexedDbState = "未確認";

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { const stored = JSON.parse(raw); return { ...DEFAULTS, ...stored, custom: { ...DEFAULTS.custom, ...(stored.custom || {}) } }; }
      const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "{}");
      const migratedModes = { fast: "hyper", slow: "slow-monster" };
      return { ...DEFAULTS, threshold: legacy.threshold ?? DEFAULTS.threshold, preRollMs: legacy.preRollMs ?? DEFAULTS.preRollMs, silenceMs: legacy.silenceMs ?? DEFAULTS.silenceMs, minRecordingMs: legacy.minRecordingMs ?? DEFAULTS.minRecordingMs, maxRecordingSeconds: legacy.maxRecordingSeconds ?? DEFAULTS.maxRecordingSeconds, responseDelayMs: legacy.responseDelayMs ?? DEFAULTS.responseDelayMs, restartDelayMs: legacy.restartDelayMs ?? DEFAULTS.restartDelayMs, voiceMode: migratedModes[legacy.mode] || legacy.mode || DEFAULTS.voiceMode, custom: { ...DEFAULTS.custom } };
    } catch (error) { console.warn("Could not load settings", error); return { ...DEFAULTS, custom: { ...DEFAULTS.custom } }; }
  }

  function saveSettings() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (error) { console.warn("Could not save settings", error); } }
  function clampNumber(value, min, max, fallback) { const number = Number(value); return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback; }

  function setState(nextState, hint) {
    if (nextState === STATES.LISTENING) resetPreRoll();
    state = nextState; document.body.dataset.state = nextState;
    const [label, defaultHint] = STATUS[nextState];
    ui.statusLabel.textContent = label; ui.statusHint.textContent = hint || defaultHint; ui.debugState.textContent = nextState;
    ui.parrot.className = `parrot ${nextState.toLowerCase()}`; ui.parrot.textContent = PARROT_FACE[nextState];
  }

  function log(message) {
    const stamp = new Date().toLocaleTimeString("ja-JP", { hour12: false });
    logs.push(`${stamp} ${message}`); if (logs.length > 140) logs = logs.slice(-140);
    ui.debugLog.textContent = logs.join("\n") || "ログはまだありません"; ui.debugLog.scrollTop = ui.debugLog.scrollHeight;
    console.info(`[オウム返し] ${message}`);
  }

  function setTimer(callback, delay) { const timer = window.setTimeout(() => { activeTimers.delete(timer); callback(); }, delay); activeTimers.add(timer); return timer; }
  function wait(delay) { return new Promise((resolve) => setTimer(resolve, delay)); }
  function clearTimers() { activeTimers.forEach((timer) => clearTimeout(timer)); activeTimers.clear(); }
  function formatBytes(bytes) { return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`; }

  function baseConfigForMode(mode) {
    if (mode === "custom") return { label: "カスタム", ...settings.custom };
    if (mode === "random") return { label: "ランダム", pitch: 0, speed: 1 };
    if (mode === "chaos") return { label: "カオス", pitch: 0, speed: 1 };
    return window.OumuEffects.PRESETS[mode] || window.OumuEffects.PRESETS.parrot;
  }

  function renderSettings() {
    const base = baseConfigForMode(settings.voiceMode); const variableMode = ["random", "chaos"].includes(settings.voiceMode);
    ui.currentMode.textContent = base.label; ui.pitchSlider.value = base.pitch || 0; ui.speedSlider.value = base.speed || 1;
    ui.pitchSlider.disabled = variableMode; ui.speedSlider.disabled = variableMode;
    ui.pitchValue.textContent = variableMode ? "毎回変化" : `${base.pitch > 0 ? "+" : ""}${base.pitch || 0} semitone`;
    ui.speedValue.textContent = variableMode ? "毎回変化" : `${Number(base.speed || 1).toFixed(2)}×`;
    ui.modeGrid.querySelectorAll("button[data-mode]").forEach((button) => button.classList.toggle("selected", button.dataset.mode === settings.voiceMode));
    const custom = settings.custom;
    ui.customEchoInput.value = custom.echo; ui.customEchoValue.textContent = `${Math.round(custom.echo * 100)}%`;
    ui.customReverbInput.value = custom.reverb; ui.customReverbValue.textContent = `${Math.round(custom.reverb * 100)}%`;
    ui.customTremoloInput.value = custom.tremolo; ui.customTremoloValue.textContent = `${Math.round(custom.tremolo * 100)}%`;
    ui.customLowPassInput.value = custom.lowPass; ui.customLowPassValue.textContent = custom.lowPass ? `${Math.round(custom.lowPass)}Hz` : "OFF";
    ui.customHighPassInput.value = custom.highPass; ui.customHighPassValue.textContent = custom.highPass ? `${Math.round(custom.highPass)}Hz` : "OFF";
    ui.customVolumeInput.value = custom.volume; ui.customVolumeValue.textContent = `${Math.round(custom.volume * 100)}%`;
    ui.customRobotInput.checked = custom.robot; ui.customReverseInput.checked = custom.reverse;
    ui.emotionSelect.value = settings.emotion; ui.reactionSelect.value = settings.reaction; ui.appModeSelect.value = settings.appMode; ui.randomBehaviorToggle.checked = settings.randomBehavior;
    ui.thresholdInput.value = settings.threshold; ui.thresholdOutput.textContent = `${(settings.threshold * 100).toFixed(1)}%`; ui.preRollInput.value = settings.preRollMs;
    ui.silenceInput.value = settings.silenceMs; ui.minRecordingInput.value = settings.minRecordingMs; ui.maxRecordingInput.value = settings.maxRecordingSeconds; ui.responseDelayInput.value = settings.responseDelayMs; ui.restartDelayInput.value = settings.restartDelayMs;
    updateThresholdMarker(); updateDebug();
  }

  function updateThresholdMarker() { ui.thresholdMarker.style.left = `${Math.min(100, Math.max(0, effectiveThreshold * 400))}%`; }
  function updateDebug() {
    const effectDebug = window.OumuEffects.getDiagnostics();
    ui.debugAudioContext.textContent = audioContext ? audioContext.state : "未作成";
    if (captureMode === "audio-worklet") ui.debugRecorder.textContent = "PCM / AudioWorklet";
    else if (captureMode === "script-processor") ui.debugRecorder.textContent = "PCM / ScriptProcessor";
    else ui.debugRecorder.textContent = mediaRecorder ? `MediaRecorder / ${mediaRecorder.state}` : "未作成";
    ui.debugLevel.textContent = smoothedLevel.toFixed(3); ui.debugThreshold.textContent = effectiveThreshold.toFixed(3);
    ui.debugSilence.textContent = silenceStartedAt ? `${Math.round(performance.now() - silenceStartedAt)} ms` : "0 ms";
    ui.debugDuration.textContent = recordingStartedAt && state === STATES.RECORDING ? `${Math.round(performance.now() - recordingStartedAt)} ms` : `${lastRecordingDuration} ms`;
    ui.debugPitchMethod.textContent = effectDebug.pitchMethod; ui.debugSampleRate.textContent = audioContext ? `${audioContext.sampleRate} Hz` : "—";
    ui.debugNodeCount.textContent = String(effectDebug.activeNodes); ui.debugEffectChain.textContent = effectDebug.chain;
    ui.debugPreset.textContent = effectDebug.preset === "—" ? baseConfigForMode(settings.voiceMode).label : effectDebug.preset;
    ui.debugIndexedDb.textContent = indexedDbState; ui.debugHistoryCount.textContent = `${historyItems.length} / ★${favoriteItems.length}`;
  }

  function resetPreRoll() { preRollChunks = []; preRollSampleCount = 0; }
  function pushPreRoll(chunk) {
    preRollChunks.push(chunk); preRollSampleCount += chunk.length;
    const maximumSamples = Math.ceil((audioContext.sampleRate * settings.preRollMs) / 1000);
    while (preRollSampleCount > maximumSamples && preRollChunks.length > 1) { const removed = preRollChunks.shift(); preRollSampleCount -= removed.length; }
    const overflow = preRollSampleCount - maximumSamples;
    if (overflow > 0 && preRollChunks.length) { preRollChunks[0] = preRollChunks[0].slice(overflow); preRollSampleCount -= overflow; }
  }
  function handlePcmChunk(chunk) {
    if (!chunk?.length) return;
    if (state === STATES.LISTENING) pushPreRoll(chunk);
    else if (state === STATES.RECORDING) { recordingPcmChunks.push(chunk); recordingPcmSampleCount += chunk.length; }
  }

  async function setupCapture() {
    captureMode = "none"; captureMuteNode = audioContext.createGain(); captureMuteNode.gain.value = 0; captureMuteNode.connect(audioContext.destination);
    if (audioContext.audioWorklet && window.AudioWorkletNode) {
      try {
        await audioContext.audioWorklet.addModule(new URL("js/pcm-recorder-worklet.js", document.baseURI).href);
        captureNode = new AudioWorkletNode(audioContext, "pcm-recorder"); captureNode.port.onmessage = (event) => handlePcmChunk(new Float32Array(event.data));
        sourceNode.connect(captureNode); captureNode.connect(captureMuteNode); captureMode = "audio-worklet"; log(`pre-roll ready (${settings.preRollMs} ms, AudioWorklet)`); return;
      } catch (error) { console.warn("AudioWorklet initialization failed", error); log("AudioWorklet unavailable; trying compatibility capture"); }
    }
    if (audioContext.createScriptProcessor) {
      captureNode = audioContext.createScriptProcessor(2048, 1, 1); captureNode.onaudioprocess = (event) => handlePcmChunk(new Float32Array(event.inputBuffer.getChannelData(0)));
      sourceNode.connect(captureNode); captureNode.connect(captureMuteNode); captureMode = "script-processor"; log(`pre-roll ready (${settings.preRollMs} ms, compatibility mode)`); return;
    }
    captureMuteNode.disconnect(); captureMuteNode = null;
    if (!window.MediaRecorder) throw new Error("このブラウザは音声録音に対応していません。");
    captureMode = "media-recorder"; log("pre-roll unavailable; using MediaRecorder fallback");
  }

  function disconnectCapture() {
    if (captureNode) {
      if ("onaudioprocess" in captureNode) captureNode.onaudioprocess = null;
      if (captureNode.port) captureNode.port.onmessage = null;
      try { captureNode.disconnect(); } catch (_) { /* disconnected */ }
    }
    try { captureMuteNode?.disconnect(); } catch (_) { /* disconnected */ }
    captureNode = null; captureMuteNode = null; captureMode = "none"; resetPreRoll(); recordingPcmChunks = []; recordingPcmSampleCount = 0;
  }

  async function queryPermission() {
    if (!navigator.permissions?.query) return;
    try { const result = await navigator.permissions.query({ name: "microphone" }); ui.debugPermission.textContent = result.state; result.onchange = () => { ui.debugPermission.textContent = result.state; }; }
    catch (_) { ui.debugPermission.textContent = "ブラウザ管理"; }
  }

  async function startApp() {
    ui.startButton.disabled = true; ui.startButton.textContent = "マイクを準備しています…"; ui.debugError.textContent = "なし";
    try {
      if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(location.hostname)) throw new Error("マイクを使うにはHTTPSでページを開いてください。");
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("このブラウザではマイクを利用できません。");
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("このブラウザは音声処理に対応していません。");
      if (audioContext && audioContext.state !== "closed") await audioContext.close();
      audioContext = new AudioContextClass(); if (audioContext.state === "suspended") await audioContext.resume(); log("AudioContext ready");
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      ui.debugPermission.textContent = "granted"; log("microphone ready"); sourceNode = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.45; analyserData = new Float32Array(analyser.fftSize); sourceNode.connect(analyser);
      await setupCapture(); noiseFloor = 0.006; ui.controls.hidden = false; ui.startButton.hidden = true; setState(STATES.LISTENING); monitorAudio(); queryPermission();
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop()); stream = null; disconnectCapture();
      if (audioContext && audioContext.state !== "closed") audioContext.close().catch(() => {}); audioContext = null;
      handleError(error, microphoneErrorMessage(error)); ui.startButton.disabled = false; ui.startButton.textContent = "もう一度試す";
    }
  }

  function microphoneErrorMessage(error) {
    if (error?.name === "NotAllowedError" || error?.name === "SecurityError") return "マイクが許可されませんでした。Safariのサイト設定からマイクを許可してください。";
    if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") return "利用できるマイクが見つかりません。";
    if (error?.name === "NotReadableError") return "マイクを開始できません。他のアプリが使用していないか確認してください。";
    return error?.message || "マイクの開始に失敗しました。";
  }

  function readLevel() {
    analyser.getFloatTimeDomainData(analyserData); let sum = 0;
    for (let index = 0; index < analyserData.length; index += 1) sum += analyserData[index] * analyserData[index];
    smoothedLevel = smoothedLevel * 0.55 + Math.sqrt(sum / analyserData.length) * 0.45; return smoothedLevel;
  }

  function drawLiveWave() {
    if (!analyserData) return;
    const canvas = ui.liveWaveCanvas, context = canvas.getContext("2d"), width = canvas.width, height = canvas.height;
    context.clearRect(0, 0, width, height); context.strokeStyle = state === STATES.RECORDING ? "#f0785d" : "#6aa78a"; context.lineWidth = 3; context.beginPath();
    for (let index = 0; index < analyserData.length; index += 1) { const x = (index / (analyserData.length - 1)) * width, y = height / 2 + analyserData[index] * height * 1.8; if (index === 0) context.moveTo(x, y); else context.lineTo(x, y); }
    context.stroke();
  }

  function drawResultWave(buffer) {
    const canvas = ui.resultWaveCanvas, context = canvas.getContext("2d"), data = buffer.getChannelData(0), width = canvas.width, height = canvas.height, block = Math.max(1, Math.floor(data.length / width));
    context.clearRect(0, 0, width, height); context.fillStyle = "#237b5c";
    for (let x = 0; x < width; x += 1) { let peak = 0; const start = x * block; for (let index = start; index < Math.min(data.length, start + block); index += 1) peak = Math.max(peak, Math.abs(data[index])); const barHeight = Math.max(1, peak * height * 0.92); context.fillRect(x, (height - barHeight) / 2, 1, barHeight); }
    ui.latestWavePanel.hidden = false; ui.latestDuration.textContent = `${buffer.duration.toFixed(1)}秒`;
  }

  function monitorAudio(timestamp = performance.now()) {
    if (!analyser || !stream) return;
    const level = readLevel();
    if (state === STATES.LISTENING) {
      if (level < settings.threshold * 0.9) noiseFloor = noiseFloor * 0.985 + level * 0.015;
      effectiveThreshold = Math.min(0.3, Math.max(settings.threshold, noiseFloor * 2.6 + 0.004));
      if (level >= effectiveThreshold) { if (!speechCandidateAt) speechCandidateAt = timestamp; if (timestamp - speechCandidateAt >= (captureMode === "media-recorder" ? 35 : 90)) beginRecording(); }
      else speechCandidateAt = 0;
    } else if (state === STATES.RECORDING) {
      const duration = timestamp - recordingStartedAt;
      if (level < effectiveThreshold * 0.68) { if (!silenceStartedAt) silenceStartedAt = timestamp; if (duration >= settings.minRecordingMs && timestamp - silenceStartedAt >= settings.silenceMs) { log("silence detected"); stopRecording(); } }
      else silenceStartedAt = 0;
      if (duration >= settings.maxRecordingSeconds * 1000) { log("maximum recording time reached"); stopRecording(); }
    }
    if (timestamp - lastMeterUpdate > 50) {
      const meterPercent = Math.min(100, level * 400); ui.meterFill.style.width = `${meterPercent}%`; ui.levelValue.textContent = `${Math.round(meterPercent)}%`; ui.meterTrack.setAttribute("aria-valuenow", String(Math.round(meterPercent)));
      updateThresholdMarker(); drawLiveWave(); updateDebug(); lastMeterUpdate = timestamp;
    }
    animationFrame = requestAnimationFrame(monitorAudio);
  }

  function chooseMimeType() { return ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || ""; }
  function createRecorder() { const mimeType = chooseMimeType(); ui.debugMime.textContent = mimeType || "ブラウザ既定"; return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream); }

  function beginRecording() {
    if (state !== STATES.LISTENING) return;
    try {
      if (["audio-worklet", "script-processor"].includes(captureMode)) { recordingPcmChunks = preRollChunks; recordingPcmSampleCount = preRollSampleCount; resetPreRoll(); }
      else { recordingChunks = []; mediaRecorder = createRecorder(); mediaRecorder.ondataavailable = (event) => { if (event.data?.size) recordingChunks.push(event.data); }; mediaRecorder.onerror = (event) => handleError(event.error || new Error("録音中にエラーが発生しました。")); mediaRecorder.onstop = processMediaRecording; mediaRecorder.start(100); }
      recordingStartedAt = performance.now(); silenceStartedAt = 0; speechCandidateAt = 0; ui.debugStartedAt.textContent = new Date().toLocaleTimeString("ja-JP", { hour12: false }); setState(STATES.RECORDING); log("speech detected"); log("recording started");
    } catch (error) { handleError(error, "録音を開始できませんでした。"); }
  }

  function stopRecording() {
    if (state !== STATES.RECORDING) return;
    setState(STATES.PROCESSING); log("recording stopped");
    try {
      if (["audio-worklet", "script-processor"].includes(captureMode)) processPcmRecording().catch((error) => handleError(error, "音声データの生成に失敗しました。"));
      else if (mediaRecorder?.state === "recording") mediaRecorder.stop(); else throw new Error("Recorder is not active");
    } catch (error) { handleError(error, "録音の停止に失敗しました。"); }
  }

  async function processMediaRecording() {
    const duration = Math.round(performance.now() - recordingStartedAt), type = mediaRecorder?.mimeType || recordingChunks[0]?.type || "audio/mp4", blob = new Blob(recordingChunks, { type });
    recordingChunks = []; await processBlob(blob, duration);
  }

  async function processPcmRecording() {
    const sampleRate = audioContext.sampleRate, sampleCount = recordingPcmSampleCount, chunks = recordingPcmChunks;
    recordingPcmChunks = []; recordingPcmSampleCount = 0;
    if (!sampleCount || !chunks.length) throw new Error("PCM recording is empty");
    await processBlob(encodeWav(chunks, sampleCount, sampleRate), Math.round((sampleCount / sampleRate) * 1000));
  }

  function encodeWav(chunks, sampleCount, sampleRate) {
    const buffer = new ArrayBuffer(44 + sampleCount * 2), view = new DataView(buffer), writeText = (offset, text) => { for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index)); };
    writeText(0, "RIFF"); view.setUint32(4, 36 + sampleCount * 2, true); writeText(8, "WAVE"); writeText(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); writeText(36, "data"); view.setUint32(40, sampleCount * 2, true);
    let outputOffset = 44;
    chunks.forEach((chunk) => chunk.forEach((rawSample) => { const sample = Math.max(-1, Math.min(1, rawSample)); view.setInt16(outputOffset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true); outputOffset += 2; }));
    return new Blob([buffer], { type: "audio/wav" });
  }

  async function decodeBlob(blob) { const data = await blob.arrayBuffer(); return audioContext.decodeAudioData(data.slice(0)); }
  function chooseVoiceConfig() {
    const config = window.OumuEffects.resolvePreset(settings.voiceMode, settings.custom, settings.emotion), special = ["random", "chaos"].includes(settings.voiceMode);
    ui.voiceAnnouncement.textContent = special ? `${settings.voiceMode === "chaos" ? "⚡" : "🎲"} 今回は「${config.label}」！` : `🦜 ${config.label}の声で返します`; return config;
  }
  function reactionProbability() { const probability = { off: 0, few: 0.22, normal: 0.5, many: 0.9 }[settings.reaction] ?? 0.5; return settings.emotion === "happy" ? Math.max(0.75, probability) : probability; }
  function randomVariations() {
    if (!settings.randomBehavior || Math.random() >= 0.28) return { name: "通常", items: [{ pitchOffset: 0, volume: 1, pan: 0 }] };
    const actions = [
      { name: "二回返し", items: [{}, {}] }, { name: "だんだん高く", items: [{ pitchOffset: -2 }, { pitchOffset: 2 }, { pitchOffset: 6 }] },
      { name: "だんだん低く", items: [{ pitchOffset: 4 }, { pitchOffset: 0 }, { pitchOffset: -4 }] }, { name: "山びこ", items: [{ volume: 1 }, { volume: 0.6 }, { volume: 0.3 }] },
      { name: "左右パン", items: [{ pan: -0.85 }, { pan: 0 }, { pan: 0.85 }] },
    ];
    const action = actions[Math.floor(Math.random() * actions.length)];
    return { name: action.name, items: action.items.map((item) => ({ pitchOffset: item.pitchOffset || 0, volume: item.volume ?? 1, pan: item.pan || 0 })) };
  }

  async function playConfiguredBuffer(buffer, config) {
    setState(STATES.PLAYING); if (settings.voiceMode === "random") ui.parrot.textContent = "🎲🦜"; if (settings.voiceMode === "chaos") ui.parrot.textContent = "⚡🦜⚡";
    if (Math.random() < reactionProbability()) await window.OumuEffects.playReaction(audioContext, "before");
    const behavior = randomVariations(); if (behavior.name !== "通常") ui.voiceAnnouncement.textContent = `🦜 ${behavior.name}！`;
    log(`playback started (${config.label}, pitch ${config.pitch}, speed ${config.speed.toFixed(2)}, ${behavior.name})`);
    for (let index = 0; index < behavior.items.length; index += 1) { if (state !== STATES.PLAYING) break; await window.OumuEffects.applyEffect(audioContext, buffer, config, behavior.items[index]); if (index < behavior.items.length - 1 && state === STATES.PLAYING) await wait(260); }
    if (state === STATES.PLAYING && Math.random() < reactionProbability() * 0.65) await window.OumuEffects.playReaction(audioContext, "after");
  }

  async function processBlob(blob, duration) {
    lastRecordingDuration = duration; recordingStartedAt = 0; silenceStartedAt = 0; ui.debugDuration.textContent = `${duration} ms`; ui.debugBlobSize.textContent = formatBytes(blob.size); ui.debugMime.textContent = blob.type || "unknown"; log(`blob created (${formatBytes(blob.size)}, ${blob.type || "unknown"})`);
    if (!blob.size) { handleError(new Error("Recorded blob is empty"), "音声データを作成できませんでした。"); return; }
    try {
      const buffer = await decodeBlob(blob); ui.debugBuffer.textContent = `${buffer.sampleRate}Hz / ${buffer.duration.toFixed(2)}s / ${buffer.numberOfChannels}ch`; drawResultWave(buffer);
      await wait(settings.responseDelayMs); if (state !== STATES.PROCESSING) return;
      const config = chooseVoiceConfig(); addHistory(blob, duration, config); await playConfiguredBuffer(buffer, config);
      if (state !== STATES.PLAYING) return;
      log("playback ended"); setState(STATES.PROCESSING, "もう一度聞く準備をしています"); await wait(settings.restartDelayMs);
      if (state === STATES.PROCESSING) { noiseFloor = Math.max(0.006, noiseFloor * 0.85); speechCandidateAt = 0; setState(STATES.LISTENING); log("listening resumed"); }
    } catch (error) { handleError(error, "録音した音声を処理・再生できませんでした。"); }
  }

  async function ensurePlaybackContext() {
    if (!audioContext || audioContext.state === "closed") { const AudioContextClass = window.AudioContext || window.webkitAudioContext; if (!AudioContextClass) throw new Error("音声処理に対応していません。"); audioContext = new AudioContextClass(); }
    if (audioContext.state === "suspended") await audioContext.resume();
  }
  async function playStoredBlob(blob, config) {
    if ([STATES.RECORDING, STATES.PROCESSING, STATES.PLAYING].includes(state)) return;
    const previousState = state;
    setState(STATES.PROCESSING, "保存した声を準備しています");
    try { await ensurePlaybackContext(); const buffer = await decodeBlob(blob); ui.debugBuffer.textContent = `${buffer.sampleRate}Hz / ${buffer.duration.toFixed(2)}s / ${buffer.numberOfChannels}ch`; drawResultWave(buffer); ui.voiceAnnouncement.textContent = `🦜 「${config.label}」で履歴を再生`; await playConfiguredBuffer(buffer, config); if (state === STATES.PLAYING) setState(previousState === STATES.LISTENING ? STATES.LISTENING : STATES.IDLE); }
    catch (error) { handleError(error, "保存した音声を再生できませんでした。"); }
  }

  function addHistory(blob, duration, config) { historyItems.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, blob, timestamp: Date.now(), duration, effectConfig: { ...config } }); if (historyItems.length > MAX_HISTORY) historyItems.length = MAX_HISTORY; renderHistory(); }
  function createAudioItem(item, favorite) {
    const row = document.createElement("article"); row.className = "audio-item";
    const info = document.createElement("div"); info.className = "audio-item-info";
    const title = document.createElement("strong"); title.className = "audio-item-title"; title.textContent = favorite ? item.name : new Date(item.timestamp).toLocaleTimeString("ja-JP", { hour12: false });
    const meta = document.createElement("span"); meta.className = "audio-item-meta"; meta.textContent = `${(item.duration / 1000).toFixed(1)}秒・${item.effectConfig?.label || "普通"}`; info.append(title, meta);
    const actions = document.createElement("div"); actions.className = "audio-actions";
    const definitions = favorite ? [["play", "再生"], ["effect", "加工変更"], ["rename", "名前変更"], ["delete", "削除"]] : [["play", "再生"], ["effect", "加工変更"], ["favorite", "★お気に入り"], ["delete", "削除"]];
    definitions.forEach(([action, label]) => { const button = document.createElement("button"); button.type = "button"; button.dataset.action = action; button.dataset.id = item.id; button.textContent = label; actions.append(button); }); row.append(info, actions); return row;
  }
  function renderHistory() { ui.historyList.replaceChildren(); if (!historyItems.length) ui.historyList.innerHTML = '<p class="empty-message">録音はまだありません</p>'; else historyItems.forEach((item) => ui.historyList.append(createAudioItem(item, false))); ui.historyCount.textContent = String(historyItems.length); updateDebug(); }
  function renderFavorites() { ui.favoriteList.replaceChildren(); if (!favoriteItems.length) ui.favoriteList.innerHTML = '<p class="empty-message">お気に入りはまだありません</p>'; else favoriteItems.sort((a, b) => b.updatedAt - a.updatedAt).forEach((item) => ui.favoriteList.append(createAudioItem(item, true))); updateDebug(); }
  async function refreshFavorites() { try { favoriteItems = await window.OumuFavoriteStore.list(); indexedDbState = "利用可能"; renderFavorites(); } catch (error) { indexedDbState = `利用不可: ${error.message}`; console.warn("Favorite storage unavailable", error); updateDebug(); } }
  async function initializeFavorites() { try { await window.OumuFavoriteStore.open(); indexedDbState = "利用可能"; await refreshFavorites(); } catch (error) { indexedDbState = `利用不可: ${error.message}`; updateDebug(); } }
  async function handleAudioAction(event, favorite) {
    const button = event.target.closest("button[data-action]"); if (!button) return;
    const items = favorite ? favoriteItems : historyItems, item = items.find((candidate) => candidate.id === button.dataset.id); if (!item) return;
    const action = button.dataset.action;
    if (action === "play") await playStoredBlob(item.blob, item.effectConfig || window.OumuEffects.resolvePreset("normal", settings.custom, "normal"));
    else if (action === "effect") { const config = chooseVoiceConfig(); item.effectConfig = { ...config }; if (favorite) { await window.OumuFavoriteStore.put(item); await refreshFavorites(); } else renderHistory(); await playStoredBlob(item.blob, config); }
    else if (action === "favorite") { await window.OumuFavoriteStore.put({ ...item, name: `お気に入り ${new Date(item.timestamp).toLocaleTimeString("ja-JP", { hour12: false })}`, updatedAt: Date.now() }); await refreshFavorites(); }
    else if (action === "rename") { const name = window.prompt("お気に入りの名前", item.name); if (name?.trim()) { await window.OumuFavoriteStore.rename(item.id, name.trim()); await refreshFavorites(); } }
    else if (action === "delete") { if (favorite) { await window.OumuFavoriteStore.remove(item.id); await refreshFavorites(); } else { historyItems = historyItems.filter((candidate) => candidate.id !== item.id); renderHistory(); } }
  }

  function stopApp() {
    clearTimers(); cancelAnimationFrame(animationFrame); animationFrame = 0; window.OumuEffects.stopAll();
    if (mediaRecorder?.state === "recording") { mediaRecorder.onstop = null; try { mediaRecorder.stop(); } catch (_) { /* stopped */ } }
    stream?.getTracks().forEach((track) => track.stop()); disconnectCapture(); try { sourceNode?.disconnect(); } catch (_) { /* disconnected */ } try { analyser?.disconnect(); } catch (_) { /* disconnected */ }
    if (audioContext && audioContext.state !== "closed") audioContext.close().catch(() => {});
    stream = null; sourceNode = null; analyser = null; analyserData = null; mediaRecorder = null; audioContext = null; smoothedLevel = 0;
    ui.meterFill.style.width = "0%"; ui.levelValue.textContent = "0%"; ui.controls.hidden = true; ui.startButton.hidden = false; ui.startButton.disabled = false; ui.startButton.textContent = "● オウム返しを開始"; setState(STATES.IDLE); log("stopped"); updateDebug();
  }
  function handleError(error, userMessage) { console.error("[オウム返し]", error); const detail = error?.message || String(error); ui.debugError.textContent = detail; setState(STATES.ERROR, userMessage || detail); log(`error: ${detail}`); }
  function updateSetting(key, value) { settings[key] = value; saveSettings(); renderSettings(); }
  function switchToCustom() { if (settings.voiceMode !== "custom" && !["random", "chaos"].includes(settings.voiceMode)) { const base = baseConfigForMode(settings.voiceMode); settings.custom = { ...settings.custom, ...base }; delete settings.custom.label; } settings.voiceMode = "custom"; }
  function updateCustom(key, value) { switchToCustom(); settings.custom[key] = value; saveSettings(); renderSettings(); }

  ui.startButton.addEventListener("click", startApp); ui.stopButton.addEventListener("click", stopApp);
  ui.modeGrid.addEventListener("click", (event) => { const button = event.target.closest("button[data-mode]"); if (!button) return; settings.voiceMode = button.dataset.mode; saveSettings(); renderSettings(); });
  ui.pitchSlider.addEventListener("input", () => updateCustom("pitch", Number(ui.pitchSlider.value))); ui.speedSlider.addEventListener("input", () => updateCustom("speed", Number(ui.speedSlider.value)));
  [[ui.customEchoInput, "echo"], [ui.customReverbInput, "reverb"], [ui.customTremoloInput, "tremolo"], [ui.customLowPassInput, "lowPass"], [ui.customHighPassInput, "highPass"], [ui.customVolumeInput, "volume"]].forEach(([input, key]) => input.addEventListener("input", () => updateCustom(key, Number(input.value))));
  ui.customRobotInput.addEventListener("change", () => updateCustom("robot", ui.customRobotInput.checked)); ui.customReverseInput.addEventListener("change", () => updateCustom("reverse", ui.customReverseInput.checked));
  ui.emotionSelect.addEventListener("change", () => updateSetting("emotion", ui.emotionSelect.value)); ui.reactionSelect.addEventListener("change", () => updateSetting("reaction", ui.reactionSelect.value)); ui.randomBehaviorToggle.addEventListener("change", () => updateSetting("randomBehavior", ui.randomBehaviorToggle.checked));
  ui.appModeSelect.addEventListener("change", () => { updateSetting("appMode", ui.appModeSelect.value); if (ui.appModeSelect.value === "game") ui.voiceAnnouncement.textContent = "🎮 ゲームモードの土台を準備しました（通常動作を継続します）"; });
  ui.thresholdInput.addEventListener("input", () => updateSetting("threshold", clampNumber(ui.thresholdInput.value, 0.01, 0.25, DEFAULTS.threshold))); ui.preRollInput.addEventListener("change", () => updateSetting("preRollMs", clampNumber(ui.preRollInput.value, 100, 1000, DEFAULTS.preRollMs)));
  ui.silenceInput.addEventListener("change", () => updateSetting("silenceMs", clampNumber(ui.silenceInput.value, 300, 3000, DEFAULTS.silenceMs))); ui.minRecordingInput.addEventListener("change", () => updateSetting("minRecordingMs", clampNumber(ui.minRecordingInput.value, 100, 3000, DEFAULTS.minRecordingMs)));
  ui.maxRecordingInput.addEventListener("change", () => updateSetting("maxRecordingSeconds", clampNumber(ui.maxRecordingInput.value, 3, 60, DEFAULTS.maxRecordingSeconds))); ui.responseDelayInput.addEventListener("change", () => updateSetting("responseDelayMs", clampNumber(ui.responseDelayInput.value, 0, 1500, DEFAULTS.responseDelayMs))); ui.restartDelayInput.addEventListener("change", () => updateSetting("restartDelayMs", clampNumber(ui.restartDelayInput.value, 0, 2000, DEFAULTS.restartDelayMs)));
  ui.resetSettingsButton.addEventListener("click", () => { settings = { ...DEFAULTS, custom: { ...DEFAULTS.custom } }; saveSettings(); renderSettings(); }); ui.clearLogButton.addEventListener("click", () => { logs = []; ui.debugLog.textContent = "ログはまだありません"; });
  ui.historyList.addEventListener("click", (event) => handleAudioAction(event, false).catch((error) => handleError(error, "履歴の操作に失敗しました。"))); ui.favoriteList.addEventListener("click", (event) => handleAudioAction(event, true).catch((error) => handleError(error, "お気に入りの操作に失敗しました。")));
  window.addEventListener("pagehide", stopApp);

  setState(STATES.IDLE); renderSettings(); renderHistory(); initializeFavorites();
})();
