import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { ObjectContext } from "../objects/primitives";
import { createStreetLight } from "../objects/streetLight";
import { SeededRandom } from "../random/seededRandom";
import { createMaterial } from "../utils/materials";
import { createBuilding, INTERIOR_FLOOR_HEIGHT, type BuildingType, type RoofShape } from "./buildingGenerator";
import { resolveCityStyle, type ResolvedCityStyle } from "./cityStyles";
import { createPark, createPlaza } from "./parkGenerator";
import { createIntersection, createRoad } from "./roadGenerator";
import { createLandmark, createStyleDecoration, createWaterfront } from "./styleObjects";
import type { CitySettings, GeneratedCity, HeightProfile } from "./types";
import type { InteriorBuildingSite } from "../interior/Room";
import { createBounds, type AreaTag, type AreaType } from "./SemanticTypes";
import type { WorldRegistry } from "./WorldRegistry";

const ROOFS: RoofShape[] = ["flat", "gable", "stepped"];

export function createCity(ctx: ObjectContext, settings: CitySettings, mobile: boolean, registry: WorldRegistry): GeneratedCity {
  const started = performance.now();
  const random = new SeededRandom(settings.seed);
  const style = resolveCityStyle(settings);
  const extent = settings.size === "small" ? 24 : settings.size === "medium" ? 32 : 40;
  const roadWidth = style.roadWidth;
  const lampMaterials: StandardMaterial[] = [];
  const interiorSites: InteriorBuildingSite[] = [];
  const meshStart = ctx.scene.meshes.length;
  const materialStart = ctx.scene.materials.length;
  const xRoads = [0];
  const zRoads = settings.size === "small" ? [0] : settings.size === "medium" ? [-20, 20] : [-22, 0, 22];
  const shade = style.darkPalette ? .68 : 1;
  const roadColor = Color3.FromHexString(style.colors.road).scale(shade);
  const sidewalkColor = Color3.FromHexString(style.colors.sidewalk).scale(shade);

  const groundOverlay = MeshBuilder.CreateBox("city-style-ground", { width: extent * 2 + 12, depth: extent * 2 + 12, height: .035 }, ctx.scene);
  groundOverlay.position.y = .018;
  groundOverlay.material = createMaterial(ctx.scene, "city-style-ground-material", Color3.FromHexString(style.colors.ground).scale(shade));
  groundOverlay.receiveShadows = true;
  const shoreX = style.water ? createWaterfront(ctx, extent) : Number.POSITIVE_INFINITY;

  const roadLength = extent * 2 + 8;
  xRoads.forEach((x, index) => {
    const position = new Vector3(x, .05, 0);
    createRoad(ctx, { position, width: roadWidth, length: roadLength, sidewalkWidth: style.sidewalkWidth, roadColor, sidewalkColor });
    registerRoadAreas(registry, `road_ns_${index}`, position, roadWidth, roadLength, 0, style.sidewalkWidth, "ROAD", ["outdoor", "public", "wide"]);
  });
  zRoads.forEach((z, index) => {
    const position = new Vector3(0, .055, z);
    createRoad(ctx, { position, width: roadWidth, length: roadLength, rotation: Math.PI / 2, sidewalkWidth: style.sidewalkWidth, roadColor, sidewalkColor });
    registerRoadAreas(registry, `road_ew_${index}`, position, roadWidth, roadLength, Math.PI / 2, style.sidewalkWidth, "ROAD", ["outdoor", "public", "wide"]);
  });
  xRoads.forEach((x, xi) => zRoads.forEach((z, zi) => {
    const position = new Vector3(x, 0, z);
    createIntersection(ctx, position, roadWidth);
    registry.register({ id: `intersection_${xi}_${zi}`, type: "INTERSECTION", position, bounds: createBounds(position, roadWidth + 3, roadWidth + 3, 0, 3), connections: [`road_ns_${xi}`, `road_ew_${zi}`], tags: ["outdoor", "public", "wide"], importance: 4 });
    registry.connect(`intersection_${xi}_${zi}`, `road_ns_${xi}`);
    registry.connect(`intersection_${xi}_${zi}`, `road_ew_${zi}`);
  }));
  const alleyCount = createAlleys(ctx, style, extent, roadColor, random, mobile, registry);

  const targetBase = settings.size === "small" ? 10 : settings.size === "medium" ? 16 : 24;
  const target = Math.min(Math.round(targetBase * style.densityScale), mobile ? 20 : 34);
  const parkCenter = settings.size === "medium"
    ? new Vector3(extent - 7, .08, 0)
    : new Vector3(extent - 6, .08, extent - 6);
  const plazaCenter = settings.size === "medium"
    ? new Vector3(-extent + 7, .08, 0)
    : new Vector3(-extent + 8, .08, -extent + 8);
  const lotPositions = makeLots(extent, roadWidth, style.sidewalkWidth, style.lotSpacing, target, xRoads, zRoads, random);
  // Reserve a reachable landmark lot without overlapping the generated park or plaza.
  const missionCenter = extent === 24 ? new Vector3(-12, 0, 8) : extent === 32 ? new Vector3(-14, 0, 10) : new Vector3(-15, 0, -11);
  registry.register({ id: "mission_site", type: "BUILDING", position: missionCenter, bounds: createBounds(missionCenter, 12, 20, 0, INTERIOR_FLOOR_HEIGHT * 2), connections: [], tags: ["private", "landmark", "mission"], importance: 10, metadata: { reserved: true, floors: 2, hasInterior: true } });
  let buildingCount = 0;
  for (const lot of lotPositions) {
    if (distance2D(lot.position, parkCenter) < 12 || distance2D(lot.position, plazaCenter) < 11) continue;
    if (lot.position.x > shoreX - 5) continue;
    if (Math.abs(lot.position.x - missionCenter.x) < 12 && Math.abs(lot.position.z - missionCenter.z) < 8) continue;
    const type = selectType(random, settings.height, style);
    const floors = selectFloors(random, type, mobile, style);
    const buildingId = `building_${String(buildingCount + 1).padStart(3, "0")}`;
    const interiorRoll = random.next();
    const hasInterior = buildingCount === 0 || interiorRoll < .25;
    const width = Math.max(hasInterior ? 6.4 : 0, random.range(type === "tower" ? 5.2 : 4.8, type === "warehouse" ? 8.5 : 7.1));
    const depth = Math.max(hasInterior ? 8.5 : 0, random.range(5.2, type === "warehouse" ? 10 : 7.4));
    const root = createBuilding(ctx, {
      position: lot.position,
      width,
      depth,
      floors,
      color: Color3.FromHexString(random.pick(style.colors.buildings)).scale(shade),
      windowColumns: random.integer(2, type === "office" || type === "tower" ? 5 : 3),
      doorPosition: random.pick(["left", "center", "right"] as const),
      roofShape: type === "house" ? "gable" : random.pick(ROOFS),
      type,
      rotation: lot.rotation,
      interiorMode: hasInterior ? "interior-ready" : "exterior",
      hasInterior,
      buildingId,
    });
    registerBuildingAreas(registry, root.position, lot.rotation, buildingId, width, depth, floors, hasInterior, Boolean(root.metadata?.landmark));
    if (hasInterior) interiorSites.push({ id: buildingId, root, width, depth, floors: Math.min(floors, mobile ? 2 : 3), floorHeight: INTERIOR_FLOOR_HEIGHT, seed: settings.seed + buildingCount * 7919, state: "NOT_GENERATED" });
    buildingCount += 1;
    if (buildingCount >= target) break;
  }

  const parkSize = style.landmark === "park" ? 14 : 10;
  const hasPark = style.landmark === "park" || random.next() < style.parkProbability;
  const hasPlaza = style.id === "downtown" || style.id === "coastal" || random.next() < .45;
  if (hasPark) {
    createPark(ctx, parkCenter, parkSize, random, lampMaterials);
    registry.register({ id: "park_main", type: "PARK", position: parkCenter, bounds: createBounds(parkCenter, parkSize, parkSize, 0, 4), connections: [], tags: ["outdoor", "public", "safe", "bright", ...(style.landmark === "park" ? ["landmark" as const] : [])], importance: style.landmark === "park" ? 9 : 6 });
    const parkAccess = registry.getNearestArea(parkCenter, ["ROAD", "SIDEWALK"]); if (parkAccess) registry.connect("park_main", parkAccess.id);
  }
  if (hasPlaza) {
    createPlaza(ctx, plazaCenter, 10, lampMaterials);
    registry.register({ id: "plaza_main", type: "PLAZA", position: plazaCenter, bounds: createBounds(plazaCenter, 10, 10, 0, 4), connections: [], tags: ["outdoor", "public", "safe", "wide", "bright"], importance: 7 });
    const plazaAccess = registry.getNearestArea(plazaCenter, ["ROAD", "SIDEWALK"]); if (plazaAccess) registry.connect("plaza_main", plazaAccess.id);
  }
  if (style.landmark !== "park") {
    createLandmark(ctx, style, plazaCenter, lampMaterials);
    registry.register({ id: "landmark_main", type: "BUILDING", position: plazaCenter, bounds: createBounds(plazaCenter, 7, 7, 0, 30), connections: [], tags: ["outdoor", "landmark"], importance: 10, metadata: { style: style.id } });
  }
  for (let z = -extent + 6; z <= extent - 6; z += 12) {
    if (random.next() < style.streetLightProbability) createStreetLight(ctx, new Vector3(-(roadWidth / 2 + style.sidewalkWidth + .8), .12, z), lampMaterials);
    if (random.next() < style.streetLightProbability) createStreetLight(ctx, new Vector3(roadWidth / 2 + style.sidewalkWidth + .8, .12, z), lampMaterials);
  }
  const decorationCount = mobile ? 3 : 6;
  for (let i = 0; i < decorationCount; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    createStyleDecoration(ctx, style, new Vector3(side * (extent - 6), .12, -extent + 8 + i * 7), random, lampMaterials);
  }

  const generationTime = performance.now() - started;
  const generatedMeshes = ctx.scene.meshes.slice(meshStart);
  const generatedMaterials = ctx.scene.materials.slice(materialStart);
  let disposed = false;
  const spawn = { x: 0, y: 2.55, z: -extent + 7 };
  const startRoad = registry.getNearestArea(spawn, ["ROAD", "PLAZA", "PARK"]);
  registry.register({ id: "start_area", type: "START", position: spawn, bounds: createBounds(spawn, 3, 3, 0, 4), connections: startRoad ? [startRoad.id] : [], tags: ["outdoor", "safe", "public", "spawn"], importance: 10 });
  return {
    lampMaterials,
    spawn,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      generatedMeshes.forEach((mesh) => { if (!mesh.isDisposed()) mesh.dispose(false, false); });
      generatedMaterials.forEach((material) => material.dispose());
    },
    interiorSites,
    registry,
    stats: {
      seed: settings.seed,
      buildingCount,
      roadCount: xRoads.length + zRoads.length + alleyCount,
      objectCount: ctx.scene.meshes.length - meshStart,
      generationTime,
      style: settings.style,
      styleLabel: style.label,
      interpretation: style.interpretation,
    },
  };
}

function createAlleys(ctx: ObjectContext, style: ResolvedCityStyle, extent: number, roadColor: Color3, random: SeededRandom, mobile: boolean, registry: WorldRegistry): number {
  const count = Math.round(style.alleyProbability * (mobile ? 4 : 7));
  for (let i = 0; i < count; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = random.range(-extent + 8, extent - 8);
    const position = new Vector3(side * extent * .22, .052, z);
    const width = Math.max(2.4, style.roadWidth * .48);
    const length = extent * .48;
    createRoad(ctx, {
      position,
      width,
      length,
      rotation: Math.PI / 2,
      markings: false,
      sidewalkWidth: 0,
      roadColor,
    });
    const tags: AreaTag[] = ["outdoor", "public", "narrow", "dead_end"];
    if (style.id === "industrial" || style.id === "ruins" || style.id === "maze" || style.darkPalette) tags.push("danger", "dark");
    registerRoadAreas(registry, `alley_${i}`, position, width, length, Math.PI / 2, 0, "ALLEY", tags);
    const deadEndPosition = new Vector3(position.x + length / 2 - 1, position.y, position.z);
    registry.register({ id: `alley_${i}_dead_end`, type: "DEAD_END", position: deadEndPosition, bounds: createBounds(deadEndPosition, 2, width, 0, 3), connections: [`alley_${i}`], tags: [...tags, "dead_end"], importance: 6 });
    registry.connect(`alley_${i}_dead_end`, `alley_${i}`);
  }
  return count;
}

function registerRoadAreas(registry: WorldRegistry, id: string, position: Vector3, width: number, length: number, rotation: number, sidewalkWidth: number, type: AreaType, tags: AreaTag[]): void {
  const rotated = Math.abs(Math.sin(rotation)) > .5;
  const roadWidth = rotated ? length : width; const roadDepth = rotated ? width : length;
  registry.register({ id, type, position, bounds: createBounds(position, roadWidth, roadDepth, 0, 3), connections: [], tags, importance: type === "ALLEY" ? 2 : 3 });
  if (type === "ALLEY") { const access = registry.getNearestArea(position, ["ROAD"]); if (access) registry.connect(id, access.id); }
  if (sidewalkWidth <= 0) return;
  for (const side of [-1, 1]) {
    const offset = side * (width / 2 + sidewalkWidth / 2);
    const sidewalkPosition = rotated ? new Vector3(position.x, position.y, position.z + offset) : new Vector3(position.x + offset, position.y, position.z);
    const sidewalkW = rotated ? length : sidewalkWidth; const sidewalkD = rotated ? sidewalkWidth : length;
    const sidewalkId = `${id}_sidewalk_${side < 0 ? "a" : "b"}`;
    registry.register({ id: sidewalkId, type: "SIDEWALK", position: sidewalkPosition, bounds: createBounds(sidewalkPosition, sidewalkW, sidewalkD, 0, 3), connections: [id], tags: ["outdoor", "public", "safe"], importance: 2 });
    registry.connect(id, sidewalkId);
  }
}

function registerBuildingAreas(registry: WorldRegistry, position: Vector3, rotation: number, buildingId: string, width: number, depth: number, floors: number, hasInterior: boolean, landmark: boolean): void {
  const rotated = Math.abs(Math.sin(rotation)) > .5;
  const worldWidth = rotated ? depth : width; const worldDepth = rotated ? width : depth;
  const buildingTags: AreaTag[] = ["private", ...(landmark ? ["landmark" as const] : [])];
  registry.register({ id: buildingId, type: "BUILDING", position, bounds: createBounds(position, worldWidth, worldDepth, 0, floors * INTERIOR_FLOOR_HEIGHT), connections: [`${buildingId}_entrance_001`], tags: buildingTags, importance: landmark ? 9 : 3, metadata: { floors, hasInterior } });
  const localEntrance = new Vector3(0, .12, -depth / 2 - .5);
  const cos = Math.cos(rotation); const sin = Math.sin(rotation);
  const entrance = new Vector3(position.x + localEntrance.x * cos + localEntrance.z * sin, .12, position.z - localEntrance.x * sin + localEntrance.z * cos);
  registry.register({ id: `${buildingId}_entrance_001`, type: "BUILDING_ENTRANCE", position: entrance, bounds: createBounds(entrance, 2.2, 2.2, 0, 3.2), connections: [buildingId], tags: ["outdoor", "public", "ground_floor", ...(landmark ? ["landmark" as const] : [])], importance: landmark ? 9 : 5, buildingId });
  const streetAccess = registry.getNearestArea(entrance, ["ROAD", "SIDEWALK", "ALLEY"]); if (streetAccess) registry.connect(`${buildingId}_entrance_001`, streetAccess.id);
}

function makeLots(
  extent: number,
  roadWidth: number,
  sidewalkWidth: number,
  preferredSpacing: number,
  target: number,
  xRoads: number[],
  zRoads: number[],
  random: SeededRandom,
): Array<{ position: Vector3; rotation: number }> {
  const lots: Array<{ position: Vector3; rotation: number }> = [];
  // Road half-width + sidewalk + the deepest building half-size + a safety gap.
  const offset = roadWidth / 2 + sidewalkWidth + 5.1;
  const intersectionClearance = offset - .8;
  const spacing = Math.max(6.6, Math.min(preferredSpacing, target > 12 ? 8.5 : 10));
  const blockDepths: number[] = [];
  for (let depth = offset; depth <= extent - 4.5; depth += 8) blockDepths.push(depth);

  const addLot = (position: Vector3, rotation: number): void => {
    if (Math.abs(position.x) > extent - 4.5 || Math.abs(position.z) > extent - 4.5) return;
    if (xRoads.some((roadX) => Math.abs(position.x - roadX) < intersectionClearance)) return;
    if (zRoads.some((roadZ) => Math.abs(position.z - roadZ) < intersectionClearance)) return;
    if (lots.some((lot) => distance2D(lot.position, position) < 7.3)) return;
    lots.push({ position, rotation });
  };

  for (const roadX of xRoads) {
    for (let z = -extent + 6; z <= extent - 6; z += spacing) {
      const jitteredZ = z + random.range(-.7, .7);
      if (zRoads.some((roadZ) => Math.abs(jitteredZ - roadZ) < intersectionClearance)) continue;
      for (const depth of blockDepths) {
        addLot(new Vector3(roadX - depth - random.range(0, .35), .12, jitteredZ), -Math.PI / 2);
        addLot(new Vector3(roadX + depth + random.range(0, .35), .12, jitteredZ), Math.PI / 2);
      }
    }
  }

  for (const roadZ of zRoads) {
    for (let x = -extent + 6; x <= extent - 6; x += spacing) {
      const jitteredX = x + random.range(-.7, .7);
      if (xRoads.some((roadX) => Math.abs(jitteredX - roadX) < intersectionClearance)) continue;
      for (const depth of blockDepths) {
        addLot(new Vector3(jitteredX, .12, roadZ - depth - random.range(0, .35)), 0);
        addLot(new Vector3(jitteredX, .12, roadZ + depth + random.range(0, .35)), Math.PI);
      }
    }
  }
  for (let i = lots.length - 1; i > 0; i -= 1) {
    const swapIndex = random.integer(0, i);
    [lots[i], lots[swapIndex]] = [lots[swapIndex], lots[i]];
  }
  return lots;
}

function selectType(random: SeededRandom, profile: HeightProfile, style: ResolvedCityStyle): BuildingType {
  if (profile === "low") return random.pick(style.buildingTypes.filter((type) => type !== "tower").length ? style.buildingTypes.filter((type) => type !== "tower") : ["house"]);
  if (profile === "high") return random.pick([...style.buildingTypes, "office", "tower"]);
  return random.pick(style.buildingTypes);
}

function selectFloors(random: SeededRandom, type: BuildingType, mobile: boolean, style: ResolvedCityStyle): number {
  let floors = random.integer(Math.min(style.minFloors, style.maxFloors), Math.max(style.minFloors, style.maxFloors));
  if (type === "house" || type === "warehouse") floors = Math.min(floors, 3);
  return mobile ? Math.min(floors, 8) : floors;
}

function distance2D(a: Vector3, b: Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
