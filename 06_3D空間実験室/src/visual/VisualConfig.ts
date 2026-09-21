export type EnvironmentPreset = "CLEAR_DAY" | "CLOUDY" | "SUNSET" | "NIGHT" | "FOGGY";
export type VisualQuality = "AUTO" | "LOW" | "MEDIUM" | "HIGH";
export type ResolvedVisualQuality = Exclude<VisualQuality, "AUTO">;
export type FogPreset = "OFF" | "LIGHT" | "MEDIUM" | "HEAVY";

export interface VisualFeatureConfig {
  sky: boolean;
  clouds: boolean;
  fog: boolean;
  shadows: boolean;
  vegetation: boolean;
  streetProps: boolean;
}

export interface VisualConfig {
  environmentPreset: EnvironmentPreset;
  quality: VisualQuality;
  fog?: FogPreset;
  features: VisualFeatureConfig;
}

export interface VisualState {
  environment: EnvironmentPreset;
  quality: VisualQuality;
  resolvedQuality: ResolvedVisualQuality;
  fog: FogPreset;
  shadow: boolean;
  lod: 0 | 1 | 2;
  activeLights: number;
  materials: number;
  meshes: number;
  activeMeshes: number;
  shadowCasters: number;
  textures: number;
  drawCalls: number;
  frameTimeMs: number;
  visibleBuildings: number;
  windowObjects: number;
  vegetation: number;
  streetLights: number;
  budgetStatus: "OK" | "WARNING";
  budgetWarnings: string[];
  materialDuplicateGroups: string[];
  features: VisualFeatureConfig;
}

export const PERFORMANCE_BUDGETS: Record<ResolvedVisualQuality, { activeMeshes: number; materials: number; lights: number; shadowCasters: number }> = {
  LOW: { activeMeshes: 420, materials: 130, lights: 6, shadowCasters: 0 },
  MEDIUM: { activeMeshes: 650, materials: 230, lights: 12, shadowCasters: 180 },
  HIGH: { activeMeshes: 900, materials: 300, lights: 16, shadowCasters: 280 },
};

export const DEFAULT_VISUAL_FEATURES: VisualFeatureConfig = { sky: true, clouds: true, fog: true, shadows: true, vegetation: true, streetProps: true };

export const VISUAL_PALETTE = {
  clearDay: { sky: "#72b8e6", horizon: "#c4e1eb", sun: "#fff1ce", ambient: "#d8e8ef" },
  cloudy: { sky: "#80939e", horizon: "#b8c1c2", sun: "#d9e1e1", ambient: "#c5ced0" },
  sunset: { sky: "#d56f55", horizon: "#f3b06c", sun: "#ffb067", ambient: "#c89582" },
  night: { sky: "#071426", horizon: "#172a43", sun: "#7389ad", ambient: "#64738d" },
  foggy: { sky: "#829096", horizon: "#aeb8b8", sun: "#cad1ce", ambient: "#b9c3c1" },
} as const;
