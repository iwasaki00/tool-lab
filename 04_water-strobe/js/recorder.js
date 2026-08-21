const MIME_CANDIDATES = [
  "video/mp4;codecs=h264",
  "video/mp4",
  "video/webm;codecs=vp8",
  "video/webm"
];

export class RecorderController extends EventTarget {
  constructor(log) {
    super();
    this.log = log;
    this.recorder = null;
    this.chunks = [];
    this.url = "";
    this.mimeType = "";
  }

  supportedTypes() {
    if (!globalThis.MediaRecorder) return [];
    return MIME_CANDIDATES.filter((type) => MediaRecorder.isTypeSupported(type));
  }

  start(stream) {
    if (!globalThis.MediaRecorder) throw new Error("このブラウザは動画録画に対応していません");
    const supported = this.supportedTypes();
    this.mimeType = supported[0] || "";
    this.chunks = [];
    this.recorder = this.mimeType ? new MediaRecorder(stream, { mimeType: this.mimeType }) : new MediaRecorder(stream);
    this.recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) this.chunks.push(event.data);
    });
    this.recorder.addEventListener("stop", () => {
      if (this.url) URL.revokeObjectURL(this.url);
      const blob = new Blob(this.chunks, { type: this.recorder.mimeType || this.mimeType });
      this.url = URL.createObjectURL(blob);
      this.log(`Recording stopped (${blob.size} bytes)`);
      this.dispatchEvent(new CustomEvent("ready", { detail: { blob, url: this.url, type: blob.type } }));
    });
    this.recorder.start(500);
    this.log(`Recording started (${this.recorder.mimeType || "default"})`);
  }

  stop() {
    if (this.recorder?.state === "recording") this.recorder.stop();
  }

  get recording() {
    return this.recorder?.state === "recording";
  }
}

