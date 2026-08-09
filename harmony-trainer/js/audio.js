import { detectPitch, midiToFrequency } from "./pitchDetector.js";

export class AudioEngine {
  constructor() {
    this.context = null;
    this.stream = null;
    this.source = null;
    this.analyser = null;
    this.pitchFrame = null;
    this.activeNodes = new Set();
    this.mediaRecorder = null;
    this.recordedChunks = [];
  }

  async ensureContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error("このブラウザはWeb Audio APIに対応していません。");
    if (!this.context) this.context = new AudioContextClass();
    if (this.context.state === "suspended") await this.context.resume();
    return this.context;
  }

  playMidi(midi, duration = 0.9, startDelay = 0, volume = 0.24) {
    const context = this.context;
    if (!context) return;
    const start = context.currentTime + startDelay;
    const end = start + duration;
    const output = context.createGain();
    output.gain.setValueAtTime(0.0001, start);
    output.gain.exponentialRampToValueAtTime(volume, start + 0.025);
    output.gain.exponentialRampToValueAtTime(0.0001, end);
    output.connect(context.destination);
    // sine + triangle を薄く重ね、長時間聴いても疲れにくいガイド音にします。
    [["sine", 1, 0.72], ["triangle", 2, 0.12]].forEach(([type, ratio, mix]) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(midiToFrequency(midi) * ratio, start);
      gain.gain.value = mix;
      oscillator.connect(gain).connect(output);
      oscillator.start(start); oscillator.stop(end + 0.02);
      this.activeNodes.add(oscillator);
      oscillator.onended = () => this.activeNodes.delete(oscillator);
    });
  }

  playSequence(midis, bpm = 80, volume = 0.22, offset = 0) {
    const beat = 60 / bpm;
    midis.forEach((midi, index) => this.playMidi(midi, beat * 0.84, offset + index * beat, volume));
    return midis.length * beat;
  }

  playTogether(melody, harmony, bpm = 80) {
    const duration = this.playSequence(melody, bpm, 0.2);
    this.playSequence(harmony, bpm, 0.13);
    return duration;
  }

  stopTones() {
    this.activeNodes.forEach((node) => { try { node.stop(); } catch (_) { /* already stopped */ } });
    this.activeNodes.clear();
  }

  async ensureMicrophone() {
    await this.ensureContext();
    if (this.stream?.active) return this.stream;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("マイクを利用できません。HTTPSで開いてください。");
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: false }, video: false
    });
    this.source = this.context.createMediaStreamSource(this.stream);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 4096;
    this.analyser.smoothingTimeConstant = 0;
    this.source.connect(this.analyser);
    return this.stream;
  }

  startPitchTracking(callback) {
    if (!this.analyser || this.pitchFrame) return;
    const buffer = new Float32Array(this.analyser.fftSize);
    let lastAnalysisAt = 0;
    const tick = (now) => {
      // iPhoneの発熱と電池消費を抑えつつ、判定に十分な約20fpsで解析します。
      if (now - lastAnalysisAt >= 50) {
        this.analyser.getFloatTimeDomainData(buffer);
        callback(detectPitch(buffer, this.context.sampleRate));
        lastAnalysisAt = now;
      }
      this.pitchFrame = requestAnimationFrame(tick);
    };
    this.pitchFrame = requestAnimationFrame(tick);
  }

  stopPitchTracking() {
    if (this.pitchFrame) cancelAnimationFrame(this.pitchFrame);
    this.pitchFrame = null;
  }

  async startRecording() {
    const stream = await this.ensureMicrophone();
    if (!window.MediaRecorder) throw new Error("このブラウザは録音に対応していません。");
    this.recordedChunks = [];
    const preferred = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type));
    this.mediaRecorder = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream);
    this.mediaRecorder.ondataavailable = (event) => { if (event.data.size) this.recordedChunks.push(event.data); };
    this.mediaRecorder.start();
  }

  stopRecording() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") return reject(new Error("録音されていません。"));
      this.mediaRecorder.onstop = () => resolve(new Blob(this.recordedChunks, { type: this.mediaRecorder.mimeType || "audio/mp4" }));
      this.mediaRecorder.onerror = () => reject(new Error("録音を保存できませんでした。"));
      this.mediaRecorder.stop();
    });
  }

  closeMicrophone() {
    this.stopPitchTracking();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null; this.source = null; this.analyser = null;
  }
}
