import { AudioEngine } from "./audio.js";
import { PHRASE_EXERCISES } from "../data/exercises.js";
import { Trainer } from "./trainer.js";
import { midiToNote } from "./pitchDetector.js";
import { loadHistory, loadSettings, saveSession, saveSettings } from "./storage.js";
import { configurePractice, drawPitchGraph, elements, renderHistory, showResults, showView, updateExercise, updatePitch } from "./ui.js";

const audio = new AudioEngine();
const trainer = new Trainer();
let settings = loadSettings();
let currentMode = "single";
let selectedInterval = "4";
let currentExercise = PHRASE_EXERCISES[0];
let sessionActive = false;
let finishTimer = null;
let graphFrame = null;
let micTestActive = false;
let recordingUrl = null;

function setStatus(message) { elements.statusLine.textContent = message; }

function syncSettingsControls() {
  elements.noteNameSetting.value = settings.noteNames;
  elements.rangeSetting.value = settings.range;
}

function prepareCurrentExercise() {
  let notes;
  if (currentMode === "single") notes = trainer.prepareSingle(selectedInterval, settings.range);
  else notes = trainer.preparePhrase(currentExercise, Number(elements.bpmSlider.value), currentMode, settings.range);
  if (currentMode !== "free") updateExercise(notes, settings.noteNames);
  elements.streakValue.textContent = trainer.streak;
}

async function openPractice(mode) {
  stopSession(false);
  currentMode = mode;
  currentExercise = PHRASE_EXERCISES[mode === "resistance" ? 2 : Math.floor(Math.random() * PHRASE_EXERCISES.length)];
  configurePractice(mode);
  prepareCurrentExercise();
  showView("practice");
  setStatus(mode === "resistance" ? "イヤホン推奨。主旋律を聴きながら別の音を保ちます。" : "開始するとマイクの利用許可を確認します。");
}

async function ensureAudio() {
  try { await audio.ensureContext(); return true; }
  catch (error) { setStatus(error.message); return false; }
}

async function playPreview(type) {
  if (!await ensureAudio()) return;
  audio.stopTones();
  if (currentMode === "single") {
    audio.playMidi(type === "guide" ? trainer.targetMidi : trainer.melodyMidi, 1.05);
    return;
  }
  const level = Number(elements.levelSelect.value);
  if (type === "melody") audio.playSequence(trainer.phrase.melodyMidi, trainer.bpm, level >= 3 ? .28 : .2);
  if (type === "guide") audio.playSequence(trainer.phrase.harmonyMidi, trainer.bpm, .2);
  if (type === "together") audio.playTogether(trainer.phrase.melodyMidi, trainer.phrase.harmonyMidi, trainer.bpm);
}

function onPitch(detection) {
  if (!sessionActive && !micTestActive) return;
  const result = trainer.processPitch(detection);
  updatePitch(result, settings.noteNames);
  if (micTestActive) {
    elements.micLevel.style.width = `${Math.min(100, (detection.rms ?? 0) * 900)}%`;
    elements.micTestReadout.textContent = result.voiced ? `${result.frequency.toFixed(1)} Hz ・ ${midiToNote(result.midiFloat)}` : "声を出すと音程を表示します";
  }
  if (result.correct) {
    elements.streakValue.textContent = trainer.streak;
    elements.judgement.textContent = "GOOD! 500msキープ";
    if (currentMode === "single") {
      window.setTimeout(() => { if (sessionActive) prepareCurrentExercise(); }, 700);
    }
  }
  if (trainer.phrase) {
    updateExercise(trainer.currentNotes(), settings.noteNames);
    if (currentMode === "free") elements.targetNote.innerHTML = "？<em>自由</em>";
  }
}

async function runCountIn() {
  elements.countIn.hidden = false;
  for (const count of [3, 2, 1]) {
    elements.countIn.textContent = count;
    if (audio.context) {
      const oscillator = audio.context.createOscillator();
      const gain = audio.context.createGain();
      oscillator.frequency.value = count === 1 ? 1000 : 720; gain.gain.value = .08;
      oscillator.connect(gain).connect(audio.context.destination); oscillator.start(); oscillator.stop(audio.context.currentTime + .06);
    }
    await new Promise((resolve) => window.setTimeout(resolve, 650));
  }
  elements.countIn.hidden = true;
}

async function startPractice() {
  if (sessionActive) return;
  elements.practiceStartButton.disabled = true;
  setStatus("マイクを準備しています…");
  try {
    await audio.ensureMicrophone();
    if (currentMode !== "single") await runCountIn();
    sessionActive = true;
    trainer.start();
    audio.startPitchTracking(onPitch);
    elements.practiceStartButton.hidden = true;
    elements.practiceStopButton.hidden = false;
    setStatus("練習中です。できるだけ一定の声で伸ばしてください。");
    if (trainer.phrase) {
      const level = Number(elements.levelSelect.value);
      audio.playSequence(trainer.phrase.melodyMidi, trainer.bpm, level === 1 ? .13 : level === 2 ? .2 : .3);
      graphFrame = requestAnimationFrame(drawLoop);
      finishTimer = window.setTimeout(() => finishPractice(), trainer.phraseDurationMs + 400);
    }
  } catch (error) {
    const denied = error.name === "NotAllowedError" ? "マイクが許可されていません。Safariのアドレスバー左側のページ設定からマイクを許可してください。" : error.message;
    setStatus(denied);
  } finally { elements.practiceStartButton.disabled = false; }
}

function drawLoop() {
  if (!sessionActive) return;
  drawPitchGraph(elements.pitchCanvas, trainer);
  graphFrame = requestAnimationFrame(drawLoop);
}

function stopSession(closeMic = true) {
  sessionActive = false;
  if (finishTimer) clearTimeout(finishTimer);
  if (graphFrame) cancelAnimationFrame(graphFrame);
  finishTimer = null; graphFrame = null;
  audio.stopPitchTracking(); audio.stopTones();
  if (closeMic) audio.closeMicrophone();
  elements.practiceStartButton.hidden = false;
  elements.practiceStopButton.hidden = true;
}

function finishPractice() {
  if (!sessionActive) return;
  const result = trainer.getResults();
  stopSession();
  saveSession({ mode: currentMode, exercise: currentMode === "single" ? trainer.currentNotes().melody : currentExercise.id, ...result });
  showResults(result);
}

function goHome() {
  stopSession();
  if (micTestActive) stopMicTest();
  renderHistory(loadHistory());
  showView("home");
}

async function toggleMicTest() {
  if (micTestActive) { stopMicTest(); return; }
  try {
    await audio.ensureMicrophone();
    trainer.prepareSingle(4, settings.range); trainer.start();
    micTestActive = true; audio.startPitchTracking(onPitch);
    elements.micTestButton.textContent = "テスト停止";
  } catch (error) { elements.micTestReadout.textContent = error.name === "NotAllowedError" ? "マイクの利用が許可されませんでした" : error.message; }
}

function stopMicTest() {
  micTestActive = false; audio.closeMicrophone();
  elements.micTestButton.textContent = "テスト開始"; elements.micLevel.style.width = "0";
}

async function startRecording() {
  try {
    await audio.startRecording();
    elements.recordOrb.classList.add("is-recording");
    elements.recordStatus.textContent = "録音中… ハモリを歌ってください。";
    elements.recordStartButton.hidden = true; elements.recordStopButton.hidden = false;
  } catch (error) { elements.recordStatus.textContent = error.name === "NotAllowedError" ? "マイクの利用を許可してください。" : error.message; }
}

async function stopRecording() {
  try {
    const blob = await audio.stopRecording();
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    recordingUrl = URL.createObjectURL(blob);
    elements.recordPlayback.src = recordingUrl; elements.recordPlayback.hidden = false;
    elements.recordStatus.textContent = "録音できました。イヤホンで聴き返すと違いが分かりやすくなります。";
  } catch (error) { elements.recordStatus.textContent = error.message; }
  elements.recordOrb.classList.remove("is-recording");
  elements.recordStartButton.hidden = false; elements.recordStopButton.hidden = true;
  audio.closeMicrophone();
}

document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => {
  const mode = button.dataset.mode;
  if (mode === "history") { renderHistory(loadHistory()); showView("history"); }
  else if (mode === "recording") showView("recording");
  else openPractice(mode);
}));
document.querySelectorAll("[data-interval]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-interval]").forEach((item) => item.classList.toggle("is-selected", item === button));
  selectedInterval = button.dataset.interval; prepareCurrentExercise();
}));
elements.quickStartButton.addEventListener("click", () => openPractice("single"));
elements.homeButton.addEventListener("click", goHome); elements.backButton.addEventListener("click", goHome);
document.querySelectorAll(".history-back,.recording-back").forEach((button) => button.addEventListener("click", goHome));
elements.playMelodyButton.addEventListener("click", () => playPreview("melody"));
elements.playGuideButton.addEventListener("click", () => playPreview("guide"));
elements.playTogetherButton.addEventListener("click", () => playPreview("together"));
elements.practiceStartButton.addEventListener("click", startPractice); elements.practiceStopButton.addEventListener("click", finishPractice);
elements.bpmSlider.addEventListener("input", () => { elements.bpmOutput.textContent = elements.bpmSlider.value; prepareCurrentExercise(); });
elements.settingsButton.addEventListener("click", () => { syncSettingsControls(); elements.settingsDialog.showModal(); });
elements.micTestButton.addEventListener("click", toggleMicTest);
elements.saveSettingsButton.addEventListener("click", () => { settings = { noteNames: elements.noteNameSetting.value, range: elements.rangeSetting.value }; saveSettings(settings); if (micTestActive) stopMicTest(); });
elements.settingsDialog.addEventListener("close", () => { if (micTestActive) stopMicTest(); });
elements.resultCloseButton.addEventListener("click", () => { elements.resultDialog.close(); goHome(); });
elements.recordStartButton.addEventListener("click", startRecording); elements.recordStopButton.addEventListener("click", stopRecording);

syncSettingsControls(); renderHistory(loadHistory()); prepareCurrentExercise();
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(() => {}));
