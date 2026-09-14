import { DEFAULT_CITY_SETTINGS, type BuildingDensity, type CitySettings, type CitySize, type CityStyle, type HeightProfile } from "./types";
import type { MissionDifficulty, MissionType } from "../gameplay/MissionTypes";

const STORAGE_KEY = "3d-space-lab-city-settings-v3";
const styles: CityStyle[] = ["japanese", "downtown", "future", "industrial", "ruins", "suburban", "coastal", "maze"];

export function loadCitySettings(): CitySettings {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<CitySettings> | null;
    if (!value) return { ...DEFAULT_CITY_SETTINGS };
    return {
      seed: typeof value.seed === "number" && Number.isFinite(value.seed) ? Math.max(1, Math.trunc(value.seed)) : DEFAULT_CITY_SETTINGS.seed,
      missionSeed: typeof value.missionSeed === "number" && Number.isFinite(value.missionSeed) ? Math.max(1, Math.trunc(value.missionSeed)) : DEFAULT_CITY_SETTINGS.missionSeed,
      size: isOneOf(value.size, ["small", "medium", "large"] as CitySize[]) ? value.size : DEFAULT_CITY_SETTINGS.size,
      density: isOneOf(value.density, ["low", "normal", "high"] as BuildingDensity[]) ? value.density : DEFAULT_CITY_SETTINGS.density,
      height: isOneOf(value.height, ["low", "mixed", "high"] as HeightProfile[]) ? value.height : DEFAULT_CITY_SETTINGS.height,
      style: isOneOf(value.style, styles) ? value.style : DEFAULT_CITY_SETTINGS.style,
      customText: typeof value.customText === "string" ? value.customText.slice(0, 160) : "",
      missionType: isOneOf(value.missionType, ["ESCAPE", "ACCESS_CONTROL", "POWER_RESTORE", "MULTI_BUILDING", "TOWER"] as MissionType[]) ? value.missionType : DEFAULT_CITY_SETTINGS.missionType,
      missionDifficulty: isOneOf(value.missionDifficulty, ["EASY", "NORMAL", "HARD"] as MissionDifficulty[]) ? value.missionDifficulty : DEFAULT_CITY_SETTINGS.missionDifficulty,
    };
  } catch {
    return { ...DEFAULT_CITY_SETTINGS };
  }
}

export function saveCitySettings(settings: CitySettings): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* Private browsing may disable storage. */ }
}

function isOneOf<T extends string>(value: unknown, values: T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}
