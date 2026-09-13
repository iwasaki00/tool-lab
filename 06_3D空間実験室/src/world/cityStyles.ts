import type { BuildingType } from "./buildingGenerator";
import type { CitySettings, CityStyle } from "./types";

export type LandmarkType = "park" | "tower" | "future-tower" | "chimney" | "monument" | "lookout" | "maze-tower";

export interface CityStyleConfig {
  id: CityStyle;
  label: string;
  roadWidth: number;
  sidewalkWidth: number;
  densityScale: number;
  minFloors: number;
  maxFloors: number;
  parkProbability: number;
  streetLightProbability: number;
  alleyProbability: number;
  lotSpacing: number;
  buildingTypes: BuildingType[];
  colors: { ground: string; road: string; sidewalk: string; buildings: string[] };
  darkPalette: boolean;
  water: boolean;
  landmark: LandmarkType;
  decoration: "utility" | "urban" | "future" | "industrial" | "ruins" | "open" | "coastal" | "maze";
}

export interface ResolvedCityStyle extends CityStyleConfig {
  interpretation: string;
}

const configs: Record<CityStyle, CityStyleConfig> = {
  japanese: { id: "japanese", label: "日本風住宅街", roadWidth: 5, sidewalkWidth: 1.1, densityScale: 1.08, minFloors: 1, maxFloors: 3, parkProbability: .65, streetLightProbability: .68, alleyProbability: .72, lotSpacing: 7.2, buildingTypes: ["house", "house", "shop"], colors: { ground: "#536044", road: "#303438", sidewalk: "#77766f", buildings: ["#a98e73", "#8b8580", "#b2a58e", "#71837b"] }, darkPalette: false, water: false, landmark: "park", decoration: "utility" },
  downtown: { id: "downtown", label: "都心", roadWidth: 9, sidewalkWidth: 2.2, densityScale: 1.28, minFloors: 4, maxFloors: 11, parkProbability: .22, streetLightProbability: .95, alleyProbability: .42, lotSpacing: 8, buildingTypes: ["office", "office", "tower", "shop"], colors: { ground: "#4b5355", road: "#20262b", sidewalk: "#777f80", buildings: ["#536b78", "#6c737c", "#756a63", "#425965"] }, darkPalette: false, water: false, landmark: "tower", decoration: "urban" },
  future: { id: "future", label: "未来都市", roadWidth: 8, sidewalkWidth: 2, densityScale: 1.12, minFloors: 5, maxFloors: 13, parkProbability: .28, streetLightProbability: 1, alleyProbability: .3, lotSpacing: 8.5, buildingTypes: ["tower", "office", "tower"], colors: { ground: "#253847", road: "#111b27", sidewalk: "#708a9b", buildings: ["#d4e3e8", "#6091ae", "#394f69", "#b8b17d"] }, darkPalette: false, water: false, landmark: "future-tower", decoration: "future" },
  industrial: { id: "industrial", label: "工業地帯", roadWidth: 10, sidewalkWidth: 1.3, densityScale: .72, minFloors: 1, maxFloors: 4, parkProbability: .08, streetLightProbability: .55, alleyProbability: .28, lotSpacing: 11, buildingTypes: ["warehouse", "warehouse", "office"], colors: { ground: "#45433c", road: "#252729", sidewalk: "#66645d", buildings: ["#595b58", "#6d5949", "#4d5559", "#756e5d"] }, darkPalette: true, water: false, landmark: "chimney", decoration: "industrial" },
  ruins: { id: "ruins", label: "廃墟", roadWidth: 6, sidewalkWidth: 1.2, densityScale: .85, minFloors: 1, maxFloors: 5, parkProbability: .12, streetLightProbability: .18, alleyProbability: .7, lotSpacing: 8.2, buildingTypes: ["warehouse", "office", "house"], colors: { ground: "#3d4038", road: "#292c2b", sidewalk: "#595b54", buildings: ["#4d4b46", "#5e574d", "#3f4846", "#66574d"] }, darkPalette: true, water: false, landmark: "monument", decoration: "ruins" },
  suburban: { id: "suburban", label: "郊外", roadWidth: 8, sidewalkWidth: 1.8, densityScale: .58, minFloors: 1, maxFloors: 3, parkProbability: .9, streetLightProbability: .58, alleyProbability: .12, lotSpacing: 12, buildingTypes: ["house", "house", "shop", "warehouse"], colors: { ground: "#526c48", road: "#343a3c", sidewalk: "#85847b", buildings: ["#c1ac8a", "#91a5a1", "#b7806e", "#7f8b70"] }, darkPalette: false, water: false, landmark: "park", decoration: "open" },
  coastal: { id: "coastal", label: "海沿い", roadWidth: 8, sidewalkWidth: 2, densityScale: .88, minFloors: 2, maxFloors: 7, parkProbability: .42, streetLightProbability: .82, alleyProbability: .2, lotSpacing: 9.5, buildingTypes: ["house", "shop", "office"], colors: { ground: "#657056", road: "#30383c", sidewalk: "#a09983", buildings: ["#e1d2b5", "#8eb3bb", "#d08d73", "#f0e5d2"] }, darkPalette: false, water: true, landmark: "lookout", decoration: "coastal" },
  maze: { id: "maze", label: "迷路都市", roadWidth: 4.5, sidewalkWidth: .7, densityScale: 1.38, minFloors: 2, maxFloors: 6, parkProbability: .04, streetLightProbability: .45, alleyProbability: 1, lotSpacing: 6.8, buildingTypes: ["house", "shop", "office", "warehouse"], colors: { ground: "#414741", road: "#252b2d", sidewalk: "#626965", buildings: ["#555d5c", "#6e6258", "#48565e", "#716f5a"] }, darkPalette: true, water: false, landmark: "maze-tower", decoration: "maze" },
};

export const CITY_STYLE_OPTIONS = Object.values(configs).map(({ id, label }) => ({ id, label }));

export function resolveCityStyle(settings: CitySettings): ResolvedCityStyle {
  const base = configs[settings.style];
  const resolved: ResolvedCityStyle = {
    ...base,
    buildingTypes: [...base.buildingTypes],
    colors: { ...base.colors, buildings: [...base.colors.buildings] },
    interpretation: "",
  };
  const text = settings.customText.trim();
  const notes: string[] = [resolved.label];
  const includes = (...words: string[]) => words.some((word) => text.includes(word));

  if (includes("住宅", "低い", "低層")) { resolved.minFloors = 1; resolved.maxFloors = Math.min(resolved.maxFloors, 3); resolved.buildingTypes = ["house", "house", "shop"]; notes.push("低層住宅"); }
  if (includes("高層", "ビル", "タワー")) { resolved.minFloors = Math.max(4, resolved.minFloors); resolved.maxFloors = Math.max(10, resolved.maxFloors); resolved.buildingTypes = ["office", "tower", ...resolved.buildingTypes]; notes.push("高層化"); }
  if (includes("狭い", "細い")) { resolved.roadWidth = Math.max(3.6, resolved.roadWidth - 2); notes.push("狭い道路"); }
  if (includes("広い", "大通り")) { resolved.roadWidth = Math.min(12, resolved.roadWidth + 2); notes.push("広い道路"); }
  if (includes("公園", "緑")) { resolved.parkProbability = 1; notes.push("公園優先"); }
  if (includes("路地", "迷路", "分岐")) { resolved.alleyProbability = 1; resolved.lotSpacing = Math.max(6.4, resolved.lotSpacing - 1); notes.push("路地増加"); }
  if (includes("工場", "倉庫", "工業")) { resolved.buildingTypes = ["warehouse", "warehouse", "office"]; resolved.decoration = "industrial"; notes.push("工業設備"); }
  if (includes("未来", "発光", "ネオン")) { resolved.buildingTypes = ["tower", "office", "tower"]; resolved.decoration = "future"; resolved.streetLightProbability = 1; notes.push("未来的発光"); }
  if (includes("暗い", "夜", "廃墟")) { resolved.darkPalette = true; notes.push("暗色パレット"); }
  if (includes("海", "海沿い", "水辺")) { resolved.water = true; resolved.decoration = "coastal"; notes.push("水面"); }
  if (includes("密集", "高密度")) { resolved.densityScale *= 1.22; resolved.lotSpacing = Math.max(6.3, resolved.lotSpacing - .8); notes.push("高密度"); }
  if (includes("空き地", "開けた", "低密度")) { resolved.densityScale *= .7; resolved.lotSpacing += 2; notes.push("低密度"); }
  if (settings.density === "low") resolved.densityScale *= .65;
  if (settings.density === "high") resolved.densityScale *= 1.35;
  if (settings.height === "low") { resolved.minFloors = 1; resolved.maxFloors = Math.min(3, resolved.maxFloors); }
  if (settings.height === "high") { resolved.minFloors = Math.max(5, resolved.minFloors); resolved.maxFloors = Math.max(9, resolved.maxFloors); }

  resolved.interpretation = [
    notes.join(" / "),
    `道路 ${resolved.roadWidth.toFixed(1)}m`,
    `密度 ${resolved.densityScale.toFixed(2)}`,
    `高さ ${resolved.minFloors}–${resolved.maxFloors}階`,
    `路地 ${level(resolved.alleyProbability)}`,
    `公園 ${level(resolved.parkProbability)}`,
  ].join(" · ");
  return resolved;
}

export function getCityStyleLabel(style: CityStyle): string {
  return configs[style].label;
}

function level(value: number): string {
  return value >= .7 ? "HIGH" : value >= .3 ? "MEDIUM" : "LOW";
}
