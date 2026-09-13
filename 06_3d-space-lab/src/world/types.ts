import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";

export type WorldMode = "field" | "city";
export type CitySize = "small" | "medium" | "large";
export type BuildingDensity = "low" | "normal" | "high";
export type HeightProfile = "low" | "mixed" | "high";

export interface CitySettings {
  seed: number;
  size: CitySize;
  density: BuildingDensity;
  height: HeightProfile;
}

export interface CityStats {
  seed: number;
  buildingCount: number;
  roadCount: number;
  objectCount: number;
  generationTime: number;
}

export interface GeneratedCity {
  stats: CityStats;
  lampMaterials: StandardMaterial[];
  spawn: { x: number; y: number; z: number };
}

export const DEFAULT_CITY_SETTINGS: CitySettings = {
  seed: 12345,
  size: "medium",
  density: "normal",
  height: "mixed",
};
