export class CameraController {
  constructor(log) {
    this.log = log;
    this.stream = null;
    this.track = null;
    this.capabilities = {};
  }

  async prepare() {
    if (!globalThis.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
      throw new Error("HTTPSでページを開いてください");
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("このブラウザはカメラを利用できません");
    }

    this.log("Camera request");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
      this.track = this.stream.getVideoTracks()[0];
      if (!this.track) throw new Error("背面カメラを取得できませんでした");
      this.log("Camera started");
      this.capabilities = typeof this.track.getCapabilities === "function"
        ? this.track.getCapabilities()
        : {};
      const supported = Boolean(this.capabilities.torch && typeof this.track.applyConstraints === "function");
      this.log(supported ? "Torch supported" : "Torch not supported");
      return supported;
    } catch (error) {
      if (error.name === "NotAllowedError") throw new Error("カメラの使用が許可されませんでした");
      if (error.name === "NotFoundError" || error.name === "OverconstrainedError") {
        throw new Error("背面カメラを取得できませんでした");
      }
      throw error;
    }
  }

  snapshot() {
    const track = this.track;
    return {
      label: track?.label || "—",
      readyState: track?.readyState || "—",
      enabled: track?.enabled ?? "—",
      muted: track?.muted ?? "—",
      capabilities: this.safeCall("getCapabilities"),
      settings: this.safeCall("getSettings"),
      constraints: this.safeCall("getConstraints")
    };
  }

  safeCall(method) {
    try {
      return typeof this.track?.[method] === "function" ? this.track[method]() : { unavailable: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  stop() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.track = null;
    this.capabilities = {};
  }
}

