import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import type { Scene } from "@babylonjs/core/scene";
import { createMaterial } from "../utils/materials";
import type { ObjectContext } from "./primitives";

export interface BuildingOptions {
  position: Vector3;
  width?: number;
  depth?: number;
  height?: number;
  color?: Color3;
  rotation?: number;
  dynamic?: boolean;
}

function part(ctx: ObjectContext, name: string, dimensions: { width: number; height: number; depth: number }, position: Vector3, material: StandardMaterial, parent: Mesh): Mesh {
  const mesh = MeshBuilder.CreateBox(name, dimensions, ctx.scene);
  mesh.position.copyFrom(position);
  mesh.parent = parent;
  mesh.material = material;
  mesh.checkCollisions = true;
  mesh.receiveShadows = true;
  ctx.shadows.addShadowCaster(mesh);
  return mesh;
}

export function createBuilding(ctx: ObjectContext, options: BuildingOptions): Mesh {
  const { position, width = 7, depth = 6, height = 4.2, color = new Color3(0.72, 0.45, 0.25), rotation = 0, dynamic = false } = options;
  const root = new Mesh(`building-${Date.now()}`, ctx.scene);
  root.position.copyFrom(position);
  root.rotation.y = rotation;
  const wall = createMaterial(ctx.scene, `${root.name}-wall`, color);
  const trim = createMaterial(ctx.scene, `${root.name}-trim`, color.scale(0.55));
  const glass = createMaterial(ctx.scene, `${root.name}-glass`, new Color3(0.17, 0.64, 0.82), 0.55);
  glass.emissiveColor = new Color3(0.03, 0.18, 0.24);

  const t = 0.28;
  const doorWidth = 1.45;
  const frontPiece = (width - doorWidth) / 2;
  part(ctx, "left-front-wall", { width: frontPiece, height, depth: t }, new Vector3(-(doorWidth + frontPiece) / 2, height / 2, -depth / 2), wall, root);
  part(ctx, "right-front-wall", { width: frontPiece, height, depth: t }, new Vector3((doorWidth + frontPiece) / 2, height / 2, -depth / 2), wall, root);
  part(ctx, "door-header", { width: doorWidth, height: 1.35, depth: t }, new Vector3(0, height - 0.675, -depth / 2), wall, root);
  part(ctx, "rear-wall", { width, height, depth: t }, new Vector3(0, height / 2, depth / 2), wall, root);
  part(ctx, "left-wall", { width: t, height, depth }, new Vector3(-width / 2, height / 2, 0), wall, root);
  part(ctx, "right-wall", { width: t, height, depth }, new Vector3(width / 2, height / 2, 0), wall, root);
  part(ctx, "roof", { width: width + .55, height: .38, depth: depth + .55 }, new Vector3(0, height + .2, 0), trim, root);
  part(ctx, "door", { width: 1.18, height: 2.45, depth: .12 }, new Vector3(0, 1.22, -depth / 2 - .18), trim, root).checkCollisions = false;

  [-1, 1].forEach((side) => {
    const window = part(ctx, "window", { width: 1.45, height: 1.15, depth: .1 }, new Vector3(side * width * .27, height * .58, -depth / 2 - .18), glass, root);
    window.checkCollisions = false;
    part(ctx, "window-sill", { width: 1.72, height: .12, depth: .24 }, new Vector3(side * width * .27, height * .58 - .65, -depth / 2 - .23), trim, root);
  });
  part(ctx, "foundation", { width: width + .25, height: .3, depth: depth + .25 }, new Vector3(0, .15, 0), trim, root);
  if (dynamic) ctx.registerDynamic?.(root);
  return root;
}

export function createStairs(ctx: ObjectContext, position: Vector3, steps = 6): Mesh {
  const root = new Mesh("stairs", ctx.scene);
  root.position.copyFrom(position);
  const material = createMaterial(ctx.scene, "stairs-mat", new Color3(0.52, 0.57, 0.59));
  for (let i = 0; i < steps; i += 1) {
    const height = (i + 1) * .32;
    part(ctx, `step-${i}`, { width: 3.2, height, depth: .62 }, new Vector3(0, height / 2, i * .62), material, root);
  }
  return root;
}

export function createBoundaryWall(scene: Scene, shadows: ShadowGenerator, position: Vector3, dimensions: { width: number; height: number; depth: number }): Mesh {
  const mesh = MeshBuilder.CreateBox("boundary-wall", dimensions, scene);
  mesh.position.copyFrom(position);
  mesh.material = createMaterial(scene, "boundary-wall-mat", new Color3(0.22, 0.27, 0.27));
  mesh.checkCollisions = true;
  mesh.receiveShadows = true;
  shadows.addShadowCaster(mesh);
  return mesh;
}
