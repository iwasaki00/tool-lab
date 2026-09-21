import type { VisualQuality } from "../visual/VisualConfig";

export interface FrameworkConfig {
  renderer: { antialias: boolean; stencil: boolean; hardwareScalingLimit: number };
  visual: { quality: VisualQuality };
  map: { autoExpansion: boolean; chunkUnload: boolean };
  performance: { telemetryIntervalMs: number };
  debug: { enabled: boolean };
}

export const DEFAULT_FRAMEWORK_CONFIG: FrameworkConfig = {
  renderer: { antialias: true, stencil: true, hardwareScalingLimit: 2 },
  visual: { quality: "AUTO" },
  map: { autoExpansion: true, chunkUnload: true },
  performance: { telemetryIntervalMs: 250 },
  debug: { enabled: false },
};
