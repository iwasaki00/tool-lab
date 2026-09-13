import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { createMaterial } from "../utils/materials";
import type { ObjectContext } from "../objects/primitives";

export type BuildingType = "house" | "shop" | "office" | "warehouse" | "tower";
export type RoofShape = "flat" | "gable" | "stepped";

export const INTERIOR_FLOOR_HEIGHT = 3.4;

export interface CityBuildingOptions {
  position: Vector3;
  width: number;
  depth: number;
  floors: number;
  floorHeight?: number;
  color: Color3;
  windowColumns: number;
  doorPosition?: "left" | "center" | "right";
  roofShape: RoofShape;
  type: BuildingType;
  rotation?: number;
  interiorMode?: "exterior" | "interior-ready";
  hasInterior?: boolean;
  buildingId?: string;
}

export function createBuilding(ctx: ObjectContext, options: CityBuildingOptions): Mesh {
  const floorHeight = options.floorHeight ?? (options.hasInterior ? INTERIOR_FLOOR_HEIGHT : 2.7);
  const height = Math.max(3.2, options.floors * floorHeight);
  const root = new Mesh(`city-building-${options.type}`, ctx.scene);
  root.position.copyFrom(options.position); root.rotation.y = options.rotation ?? 0;
  root.metadata = { buildingId: options.buildingId, buildingType: options.type, interiorMode: options.interiorMode ?? "exterior", hasInterior: options.hasInterior ?? false };
  const bodyMat = createMaterial(ctx.scene, `building-${options.type}-body`, options.color, .1);
  const trimMat = createMaterial(ctx.scene, `building-${options.type}-trim`, options.color.scale(.5), .12);
  const glassMat = createMaterial(ctx.scene, "building-window", new Color3(.16, .42, .58), .5);
  glassMat.emissiveColor = new Color3(.015, .05, .07);

  if (options.hasInterior) createExteriorShell(ctx, root, options.width, options.depth, height, bodyMat);
  else {
    const body = MeshBuilder.CreateBox("building-body", { width: options.width, height, depth: options.depth }, ctx.scene);
    body.position.y = height / 2; body.parent = root; body.material = bodyMat; body.checkCollisions = true; body.receiveShadows = true;
    ctx.shadows.addShadowCaster(body);
  }
  createRoof(ctx, root, options.width, options.depth, height, options.roofShape, trimMat);
  createFacade(ctx, root, options, height, glassMat, trimMat);
  ctx.registerDynamic?.(root);
  return root;
}

function createFacade(ctx: ObjectContext, root: Mesh, options: CityBuildingOptions, height: number, glass: StandardMaterial, trim: StandardMaterial): void {
  const windows: Mesh[] = [];
  const columns = Math.max(1, Math.min(options.windowColumns, 5));
  const rows = Math.max(1, Math.min(options.floors, 7));
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (row === 0 && column === Math.floor(columns / 2)) continue;
      const window = MeshBuilder.CreateBox("window-part", { width: Math.min(1.25, options.width / (columns + 1) * .62), height: 1.15, depth: .09 }, ctx.scene);
      window.position.set(-options.width / 2 + (column + 1) * options.width / (columns + 1), .85 + row * (height / rows), -options.depth / 2 - .05);
      window.material = glass; window.isPickable = false; windows.push(window);
    }
  }
  const merged = windows.length ? Mesh.MergeMeshes(windows, true, true, undefined, false, true) : null;
  if (merged) { merged.name = "building-windows"; merged.parent = root; }

  if (options.hasInterior) return;
  const doorX = options.doorPosition === "left" ? -options.width * .28 : options.doorPosition === "right" ? options.width * .28 : 0;
  const door = MeshBuilder.CreateBox("building-door", { width: 1.25, height: 2.2, depth: .13 }, ctx.scene);
  door.position.set(doorX, 1.1, -options.depth / 2 - .08); door.parent = root; door.material = trim; door.isPickable = false;
  const entrance = MeshBuilder.CreateBox("building-entrance", { width: 2.1, height: .18, depth: 1.05 }, ctx.scene);
  entrance.position.set(doorX, .09, -options.depth / 2 - .55); entrance.parent = root; entrance.material = trim; entrance.checkCollisions = true;
  const awning = MeshBuilder.CreateBox("building-awning", { width: 2.2, height: .16, depth: .9 }, ctx.scene);
  awning.position.set(doorX, 2.45, -options.depth / 2 - .42); awning.parent = root; awning.material = trim;
}

function createExteriorShell(ctx: ObjectContext, root: Mesh, width: number, depth: number, height: number, material: StandardMaterial): void {
  const thickness = .24;
  const doorway = 1.6;
  const doorwayHeight = 3.05;
  const frontPart = (width - doorway) / 2;
  const parts = [
    { name: "exterior-back", w: width, h: height, d: thickness, x: 0, y: height / 2, z: depth / 2 },
    { name: "exterior-left", w: thickness, h: height, d: depth, x: -width / 2, y: height / 2, z: 0 },
    { name: "exterior-right", w: thickness, h: height, d: depth, x: width / 2, y: height / 2, z: 0 },
    { name: "exterior-front-left", w: frontPart, h: height, d: thickness, x: -(doorway / 2 + frontPart / 2), y: height / 2, z: -depth / 2 },
    { name: "exterior-front-right", w: frontPart, h: height, d: thickness, x: doorway / 2 + frontPart / 2, y: height / 2, z: -depth / 2 },
    { name: "exterior-door-header", w: doorway, h: Math.max(.2, height - doorwayHeight), d: thickness, x: 0, y: doorwayHeight + Math.max(.2, height - doorwayHeight) / 2, z: -depth / 2 },
  ];
  parts.forEach((part) => {
    const wall = MeshBuilder.CreateBox(part.name, { width: part.w, height: part.h, depth: part.d }, ctx.scene);
    wall.position.set(part.x, part.y, part.z); wall.parent = root; wall.material = material; wall.checkCollisions = true; wall.receiveShadows = true; ctx.shadows.addShadowCaster(wall);
  });
}

function createRoof(ctx: ObjectContext, root: Mesh, width: number, depth: number, height: number, shape: RoofShape, material: StandardMaterial): void {
  if (shape === "gable") {
    const roof = MeshBuilder.CreateCylinder("building-gable-roof", { height: depth + .5, diameter: width * .74, tessellation: 3 }, ctx.scene);
    roof.rotation.x = Math.PI / 2; roof.rotation.y = Math.PI / 2; roof.position.y = height + width * .21; roof.parent = root; roof.material = material;
    ctx.shadows.addShadowCaster(roof);
    return;
  }
  const roof = MeshBuilder.CreateBox("building-roof", { width: width + .45, height: shape === "stepped" ? .8 : .28, depth: depth + .45 }, ctx.scene);
  roof.position.y = height + (shape === "stepped" ? .4 : .14); roof.parent = root; roof.material = material; ctx.shadows.addShadowCaster(roof);
  if (shape === "stepped") {
    const cap = MeshBuilder.CreateBox("building-roof-cap", { width: width * .58, height: .6, depth: depth * .58 }, ctx.scene);
    cap.position.y = height + 1.1; cap.parent = root; cap.material = material;
  }
}
