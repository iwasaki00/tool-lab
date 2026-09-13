import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { ObjectContext } from "../objects/primitives";
import { createStreetLight } from "../objects/streetLight";
import { SeededRandom } from "../random/seededRandom";
import { createBuilding, type BuildingType, type RoofShape } from "./buildingGenerator";
import { createPark, createPlaza } from "./parkGenerator";
import { createIntersection, createRoad } from "./roadGenerator";
import type { CitySettings, GeneratedCity, HeightProfile } from "./types";

const COLORS = [
  new Color3(.61, .33, .24), new Color3(.28, .49, .58), new Color3(.62, .55, .36),
  new Color3(.48, .44, .52), new Color3(.36, .53, .4), new Color3(.68, .65, .57),
];
const TYPES: BuildingType[] = ["house", "shop", "office", "warehouse", "tower"];
const ROOFS: RoofShape[] = ["flat", "gable", "stepped"];

export function createCity(ctx: ObjectContext, settings: CitySettings, mobile: boolean): GeneratedCity {
  const started = performance.now();
  const random = new SeededRandom(settings.seed);
  const extent = settings.size === "small" ? 24 : settings.size === "medium" ? 32 : 40;
  const roadWidth = 7;
  const lampMaterials: StandardMaterial[] = [];
  const meshStart = ctx.scene.meshes.length;
  const xRoads = [0];
  const zRoads = settings.size === "small" ? [0] : settings.size === "medium" ? [-20, 20] : [-22, 0, 22];

  xRoads.forEach((x) => createRoad(ctx, { position: new Vector3(x, .05, 0), width: roadWidth, length: extent * 2 + 8 }));
  zRoads.forEach((z) => createRoad(ctx, { position: new Vector3(0, .055, z), width: roadWidth, length: extent * 2 + 8, rotation: Math.PI / 2 }));
  xRoads.forEach((x) => zRoads.forEach((z) => createIntersection(ctx, new Vector3(x, 0, z), roadWidth)));

  const targetBase = settings.size === "small" ? 10 : settings.size === "medium" ? 16 : 24;
  const multiplier = settings.density === "low" ? .65 : settings.density === "high" ? 1.35 : 1;
  const target = Math.min(Math.round(targetBase * multiplier), mobile ? 20 : 34);
  const parkCenter = settings.size === "medium"
    ? new Vector3(extent - 7, .08, 0)
    : new Vector3(extent - 8, .08, extent - 8);
  const plazaCenter = settings.size === "medium"
    ? new Vector3(-extent + 7, .08, 0)
    : new Vector3(-extent + 8, .08, -extent + 8);
  const lotPositions = makeLots(extent, roadWidth, target, xRoads, zRoads, random);
  let buildingCount = 0;
  for (const lot of lotPositions) {
    if (distance2D(lot.position, parkCenter) < 12 || distance2D(lot.position, plazaCenter) < 11) continue;
    const type = selectType(random, settings.height);
    const floors = selectFloors(random, settings.height, type, mobile);
    createBuilding(ctx, {
      position: lot.position,
      width: random.range(type === "tower" ? 6 : 5, type === "warehouse" ? 7.5 : 7.2),
      depth: random.range(5.5, type === "warehouse" ? 9 : 7.5),
      floors,
      color: random.pick(COLORS).clone(),
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

  createPark(ctx, parkCenter, 10, random, lampMaterials);
  createPlaza(ctx, plazaCenter, 10, lampMaterials);
  for (let z = -extent + 6; z <= extent - 6; z += 12) {
    createStreetLight(ctx, new Vector3(-5.4, .12, z), lampMaterials);
    createStreetLight(ctx, new Vector3(5.4, .12, z), lampMaterials);
  }

  const generationTime = performance.now() - started;
  return {
    lampMaterials,
    spawn: { x: 0, y: 2.55, z: -extent + 7 },
    stats: {
      seed: settings.seed,
      buildingCount,
      roadCount: xRoads.length + zRoads.length,
      objectCount: ctx.scene.meshes.length - meshStart,
      generationTime,
    },
  };
}

function makeLots(
  extent: number,
  roadWidth: number,
  target: number,
  xRoads: number[],
  zRoads: number[],
  random: SeededRandom,
): Array<{ position: Vector3; rotation: number }> {
  const lots: Array<{ position: Vector3; rotation: number }> = [];
  // Road half-width + sidewalk + the deepest building half-size + a safety gap.
  const offset = roadWidth / 2 + 7.8;
  const intersectionClearance = roadWidth / 2 + 6.2;
  const spacing = target > 12 ? 8 : 10;
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

function selectType(random: SeededRandom, profile: HeightProfile): BuildingType {
  if (profile === "low") return random.pick(["house", "shop", "warehouse"] as const);
  if (profile === "high") return random.pick(["office", "tower", "office"] as const);
  return random.pick(TYPES);
}

function selectFloors(random: SeededRandom, profile: HeightProfile, type: BuildingType, mobile: boolean): number {
  let floors = profile === "low" ? random.integer(1, 3) : profile === "high" ? random.integer(6, 10) : random.integer(2, 7);
  if (type === "house" || type === "warehouse") floors = Math.min(floors, 3);
  return mobile ? Math.min(floors, 8) : floors;
}

function distance2D(a: Vector3, b: Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
