import { stabilityLabel } from "./strobe.js";

const pretty = (value) => JSON.stringify(value, null, 2);
const fixed = (value, digits = 2) => value === null ? "未測定" : value.toFixed(digits);

export function diagnosticText({ camera, torch, strobe, recorder, state, logs }) {
  const cameraData = camera.snapshot();
  const stats = strobe.stats();
  return `Water Strobe Diagnostic

UserAgent:
${navigator.userAgent}

Environment:
Secure Context: ${globalThis.isSecureContext ? "YES" : "NO"}
Page Visibility: ${document.visibilityState}
Wake Lock: ${state.wakeLockSupported ? (state.wakeLockActive ? "Active" : "Available") : "Not Supported"}

Torch:
Capability: ${state.torchSupported ? "YES" : "NO"}
applyConstraints: ${typeof camera.track?.applyConstraints === "function" ? "YES" : "NO"}
Requested: ${torch.requested ? "ON" : "OFF"}
getSettings: ${String(camera.track?.getSettings?.().torch ?? "—")}

Camera:
Label: ${cameraData.label}
readyState: ${cameraData.readyState}
enabled: ${cameraData.enabled}
muted: ${cameraData.muted}
Capabilities: ${pretty(cameraData.capabilities)}
Settings: ${pretty(cameraData.settings)}
Constraints: ${pretty(cameraData.constraints)}

Strobe Timing:
Target Frequency: ${strobe.frequency.toFixed(2)} Hz
Target Period: ${(1000 / strobe.frequency).toFixed(2)} ms
Target ON: ${(1000 / strobe.frequency * strobe.duty / 100).toFixed(2)} ms
Target OFF: ${(1000 / strobe.frequency * (100 - strobe.duty) / 100).toFixed(2)} ms
JS Frequency: ${fixed(stats.frequency)} Hz
JS Average Interval: ${fixed(stats.average)} ms
JS Minimum Interval: ${fixed(stats.min)} ms
JS Maximum Interval: ${fixed(stats.max)} ms
Standard Deviation: ${fixed(stats.deviation)} ms
Error: ${fixed(stats.error)} Hz
Samples: ${stats.samples}
JS Timer Stability: ${stabilityLabel(stats)}
LED Actual Frequency: 未測定
Recent ON intervals: ${strobe.intervals.map((value) => value.toFixed(1)).join(", ") || "未測定"} ms

API Timing:
Torch ON API: ${fixed(torch.average("on"))} ms (average)
Torch OFF API: ${fixed(torch.average("off"))} ms (average)

Recorder:
Supported: ${globalThis.MediaRecorder ? "YES" : "NO"}
MIME Types: ${recorder.supportedTypes().join(", ") || "none"}
Recording: ${recorder.recording ? "YES" : "NO"}

Log:
${logs.join("\n") || "No entries"}`;
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText && globalThis.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}
