import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { InteriorBuildingSite } from "../interior/Room";

export type WorldMode = "field" | "city";
export type CitySize = "small" | "medium" | "large";
export type BuildingDensity = "low" | "normal" | "high";
export type HeightProfile = "low" | "mixed" | "high";
export type CityStyle = "japanese" | "downtown" | "future" | "industrial" | "ruins" | "suburban" | "coastal" | "maze";

export interface CitySettings {
  seed: number;
  size: CitySize;
  density: BuildingDensity;
  height: HeightProfile;
  style: CityStyle;
  customText: string;
}

export interface CityStats {
  seed: number;
  buildingCount: number;
  roadCount: number;
  objectCount: number;
  generationTime: number;
  style: CityStyle;
  styleLabel: string;
  interpretation: string;
}

export interface GeneratedCity {
  stats: CityStats;
  lampMaterials: StandardMaterial[];
  spawn: { x: number; y: number; z: number };
  dispose: () => void;
  interiorSites: InteriorBuildingSite[];
}

export const DEFAULT_CITY_SETTINGS: CitySettings = {
  seed: 12345,
  size: "medium",
  density: "normal",
  height: "mixed",
  style: "japanese",
  customText: "",
};
