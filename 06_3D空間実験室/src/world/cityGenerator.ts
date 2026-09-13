import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { ObjectContext } from "../objects/primitives";
import { createStreetLight } from "../objects/streetLight";
import { SeededRandom } from "../random/seededRandom";
import { createMaterial } from "../utils/materials";
import { createBuilding, type BuildingType, type RoofShape } from "./buildingGenerator";
import { resolveCityStyle, type ResolvedCityStyle } from "./cityStyles";
import { createPark, createPlaza } from "./parkGenerator";
import { createIntersection, createRoad } from "./roadGenerator";
import { createLandmark, createStyleDecoration, createWaterfront } from "./styleObjects";
import type { CitySettings, GeneratedCity, HeightProfile } from "./types";

const ROOFS: RoofShape[] = ["flat", "gable", "stepped"];

export function createCity(ctx: ObjectContext, settings: CitySettings, mobile: boolean): GeneratedCity {
  const started = performance.now();
  const random = new SeededRandom(settings.seed);
  const style = resolveCityStyle(settings);
  const extent = settings.size === "small" ? 24 : settings.size === "medium" ? 32 : 40;
  const roadWidth = style.roadWidth;
  const lampMaterials: StandardMaterial[] = [];
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

  xRoads.forEach((x) => createRoad(ctx, { position: new Vector3(x, .05, 0), width: roadWidth, length: extent * 2 + 8, sidewalkWidth: style.sidewalkWidth, roadColor, sidewalkColor }));
  zRoads.forEach((z) => createRoad(ctx, { position: new Vector3(0, .055, z), width: roadWidth, length: extent * 2 + 8, rotation: Math.PI / 2, sidewalkWidth: style.sidewalkWidth, roadColor, sidewalkColor }));
  xRoads.forEach((x) => zRoads.forEach((z) => createIntersection(ctx, new Vector3(x, 0, z), roadWidth)));
  const alleyCount = createAlleys(ctx, style, extent, roadColor, random, mobile);

  const targetBase = settings.size === "small" ? 10 : settings.size === "medium" ? 16 : 24;
  const target = Math.min(Math.round(targetBase * style.densityScale), mobile ? 20 : 34);
  const parkCenter = settings.size === "medium"
    ? new Vector3(extent - 7, .08, 0)
    : new Vector3(extent - 6, .08, extent - 6);
  const plazaCenter = settings.size === "medium"
    ? new Vector3(-extent + 7, .08, 0)
    : new Vector3(-extent + 8, .08, -extent + 8);
  const lotPositions = makeLots(extent, roadWidth, style.sidewalkWidth, style.lotSpacing, target, xRoads, zRoads, random);
  let buildingCount = 0;
  for (const lot of lotPositions) {
    if (distance2D(lot.position, parkCenter) < 12 || distance2D(lot.position, plazaCenter) < 11) continue;
    if (lot.position.x > shoreX - 5) continue;
    const type = selectType(random, settings.height, style);
    const floors = selectFloors(random, type, mobile, style);
    createBuilding(ctx, {
      position: lot.position,
      width: random.range(type === "tower" ? 5.2 : 4.8, type === "warehouse" ? 8.5 : 7.1),
      depth: random.range(5.2, type === "warehouse" ? 10 : 7.4),
      floors,
      color: Color3.FromHexString(random.pick(style.colors.buildings)).scale(shade),
      windowColumns: random.integer(2, type === "office" || type === "tower" ? 5 : 3),
      doorPosition: random.pick(["left", "center", "right"] as const),
      roofShape: type === "house" ? "gable" : random.pick(ROOFS),
      type,
      rotation: lot.rotation,
      interiorMode: buildingCount % 5 === 0 ? "interior-ready" : "exterior",
    });
    buildingCount += 1;
    if (buildingCount >= target) break;
  }

  if (style.landmark === "park" || random.next() < style.parkProbability) createPark(ctx, parkCenter, style.landmark === "park" ? 14 : 10, random, lampMaterials);
  if (style.id === "downtown" || style.id === "coastal" || random.next() < .45) createPlaza(ctx, plazaCenter, 10, lampMaterials);
  if (style.landmark !== "park") createLandmark(ctx, style, plazaCenter, lampMaterials);
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
  return {
    lampMaterials,
    spawn: { x: 0, y: 2.55, z: -extent + 7 },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      generatedMeshes.forEach((mesh) => { if (!mesh.isDisposed()) mesh.dispose(false, false); });
      generatedMaterials.forEach((material) => material.dispose());
    },
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

function createAlleys(ctx: ObjectContext, style: ResolvedCityStyle, extent: number, roadColor: Color3, random: SeededRandom, mobile: boolean): number {
  const count = Math.round(style.alleyProbability * (mobile ? 4 : 7));
  for (let i = 0; i < count; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = random.range(-extent + 8, extent - 8);
    createRoad(ctx, {
      position: new Vector3(side * extent * .22, .052, z),
      width: Math.max(2.4, style.roadWidth * .48),
      length: extent * .48,
      rotation: Math.PI / 2,
      markings: false,
      sidewalkWidth: 0,
      roadColor,
    });
  }
  return count;
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
