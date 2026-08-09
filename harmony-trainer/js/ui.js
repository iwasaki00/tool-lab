import { midiToNote, SOLFEGE_NAMES } from "./pitchDetector.js";
import { getHistorySummary } from "./storage.js";

export const elements = Object.fromEntries([...document.querySelectorAll("[id]")].map((element) => [element.id, element]));

export function showView(viewName) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("is-active", view.id === `${viewName}View`));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function noteParts(midi) {
  const note = midiToNote(midi);
  return { note, solfege: SOLFEGE_NAMES[(Math.round(midi) % 12 + 12) % 12] };
}

export function formatNoteHTML(midi, preference = "both") {
  const { note, solfege } = noteParts(midi);
  if (preference === "letter") return `${note}<em>&nbsp;</em>`;
  if (preference === "solfege") return `${solfege}<em>&nbsp;</em>`;
  return `${solfege}<em>${note}</em>`;
}

export function updateExercise(notes, preference = "both") {
  elements.melodyNote.innerHTML = formatNoteHTML(notes.melodyMidi, preference);
  elements.targetNote.innerHTML = formatNoteHTML(notes.targetMidi, preference);
  const intervalNames = { 3: "短3度上", 4: "3度上", 5: "4度上", 7: "5度上", 8: "短6度上", 9: "6度上", "-3": "短3度下", "-4": "3度下", "-5": "4度下", "-7": "5度下", "-9": "6度下" };
  elements.intervalLabel.textContent = intervalNames[notes.interval] ?? `${Math.abs(notes.interval)}半音${notes.interval > 0 ? "上" : "下"}`;
  elements.instructionText.textContent = `${elements.intervalLabel.textContent}を歌ってください`;
}

export function updatePitch(result, preference = "both") {
  const hasPitch = result.voiced;
  if (!hasPitch) {
    elements.frequencyValue.textContent = result.unstable ? "音程を確かめています…" : "— Hz";
    elements.judgement.textContent = result.rms < .012 ? "声を少し大きくしてください" : "安定した声を伸ばしてください";
    elements.judgement.className = "judgement waiting";
    return;
  }
  const rounded = Math.round(result.midiFloat);
  const { note, solfege } = noteParts(rounded);
  elements.detectedSolfeggio.textContent = preference === "letter" ? note : solfege;
  elements.detectedNote.textContent = preference === "solfege" ? "" : note;
  elements.frequencyValue.textContent = `${result.frequency.toFixed(1)} Hz`;
  elements.centValue.textContent = `${result.cents > 0 ? "+" : ""}${Math.round(result.cents)}`;
  elements.tunerNeedle.style.left = `${50 + Math.max(-50, Math.min(50, result.cents)) * .78}%`;
  const labels = { excellent: "EXCELLENT", good: "GOOD", almost: "ALMOST", miss: "MISS" };
  elements.judgement.textContent = result.pulledNow ? "主旋律につられました" : labels[result.rating];
  elements.judgement.className = `judgement ${result.pulledNow ? "miss" : result.rating}`;
}

export function configurePractice(mode) {
  const configs = {
    single: ["SINGLE NOTE", "単音ハモリ", "主旋律を聴いて"],
    phrase: ["SHORT PHRASE", "フレーズハモリ", "短い流れを覚えて"],
    resistance: ["INDEPENDENCE", "つられ耐性", "主旋律に耳を奪われず"],
    free: ["FREE HARMONY", "フリーハモリ", "正解に縛られず響きを探す"]
  };
  const [eyebrow, title, hint] = configs[mode];
  elements.practiceEyebrow.textContent = eyebrow; elements.practiceTitle.textContent = title; elements.modeHint.textContent = hint;
  elements.singleConfig.hidden = mode !== "single";
  elements.phraseConfig.hidden = mode === "single";
  elements.pitchCanvas.hidden = mode === "single";
  elements.playTogetherButton.hidden = mode === "single";
  elements.playGuideButton.hidden = mode === "free";
  if (mode === "free") { elements.targetNote.innerHTML = "？<em>自由</em>"; elements.instructionText.textContent = "自由にハモってください"; }
}

export function drawPitchGraph(canvas, trainer) {
  const context = canvas.getContext("2d");
  const width = canvas.width, height = canvas.height;
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  context.clearRect(0, 0, width, height);
  context.strokeStyle = dark ? "#34504a" : "#d5ddd5"; context.lineWidth = 1;
  for (let y = 30; y < height; y += 45) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
  if (!trainer.phrase) return;
  const allNotes = [...trainer.phrase.melodyMidi, ...trainer.phrase.harmonyMidi];
  const minMidi = Math.min(...allNotes) - 1, maxMidi = Math.max(...allNotes) + 1;
  const yFor = (midi) => height - 18 - ((midi - minMidi) / (maxMidi - minMidi)) * (height - 36);
  const xFor = (time) => Math.max(0, Math.min(width, time / trainer.phraseDurationMs * width));
  const beatMs = 60000 / trainer.bpm;
  context.strokeStyle = "#e56f54"; context.lineWidth = 8; context.lineCap = "round";
  trainer.phrase.harmonyMidi.forEach((midi, index) => { context.beginPath(); context.moveTo(xFor(index * beatMs) + 4, yFor(midi)); context.lineTo(xFor((index + 1) * beatMs) - 4, yFor(midi)); context.stroke(); });
  if (trainer.samples.length) {
    context.strokeStyle = dark ? "#a7d7bf" : "#123f3a"; context.lineWidth = 3; context.beginPath();
    trainer.samples.forEach((sample, index) => { const x = xFor(sample.time), y = yFor(sample.midi); if (!index) context.moveTo(x, y); else context.lineTo(x, y); }); context.stroke();
  }
}

export function renderHistory(history) {
  const summary = getHistorySummary(history);
  elements.averageScore.textContent = summary.average ?? "—"; elements.bestScore.textContent = summary.best ?? "—"; elements.pulledCount.textContent = summary.pulled;
  if (!history.length) { elements.historyList.innerHTML = '<p class="empty-state">まだ履歴がありません。最初の練習を終えると、ここに記録されます。</p>'; return; }
  const labels = { single: "単音ハモリ", phrase: "フレーズハモリ", resistance: "つられ耐性", free: "フリーハモリ" };
  elements.historyList.innerHTML = history.map((item) => `<article class="history-item"><div><h3>${labels[item.mode] ?? item.mode}</h3><p>${new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.date))} ・ 音程 ${item.pitch}% ・ 安定度 ${item.stability}%${item.pulled ? ` ・ つられ ${item.pulled}回` : ""}</p></div><b>${item.score}</b></article>`).join("");
}

export function showResults(result) {
  elements.resultTotal.textContent = result.score;
  const rows = [["音程", result.pitch], ["安定度", result.stability], ["タイミング", result.timing], ["つられ耐性", result.resistance]];
  elements.scoreBars.innerHTML = rows.map(([label, value]) => `<div class="score-bar"><span>${label}</span><i style="--value:${value}%"></i><b>${value}</b></div>`).join("");
  elements.resultComment.textContent = result.comment;
  elements.resultDialog.showModal();
}
