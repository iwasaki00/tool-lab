import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import type { Scene } from "@babylonjs/core/scene";
import { createMaterial } from "../utils/materials";

export interface ObjectContext {
  scene: Scene;
  shadows: ShadowGenerator;
  registerDynamic?: (mesh: Mesh) => void;
}

const palette = [
  new Color3(0.12, 0.65, 0.79),
  new Color3(0.95, 0.39, 0.23),
  new Color3(0.94, 0.73, 0.2),
  new Color3(0.35, 0.75, 0.48),
  new Color3(0.48, 0.35, 0.83),
];

function finish(mesh: Mesh, material: StandardMaterial, ctx: ObjectContext, dynamic = false): Mesh {
  mesh.material = material;
  mesh.checkCollisions = true;
  mesh.receiveShadows = true;
  ctx.shadows.addShadowCaster(mesh);
  if (dynamic) ctx.registerDynamic?.(mesh);
  return mesh;
}

export function randomColor(): Color3 {
  return palette[Math.floor(Math.random() * palette.length)].clone();
}

export function createBox(ctx: ObjectContext, position: Vector3, size = 1.5, dynamic = false): Mesh {
  const mesh = MeshBuilder.CreateBox(`box-${Date.now()}`, { size }, ctx.scene);
  mesh.position.copyFrom(position);
  return finish(mesh, createMaterial(ctx.scene, `${mesh.name}-mat`, randomColor()), ctx, dynamic);
}

export function createSphere(ctx: ObjectContext, position: Vector3, diameter = 1.6, dynamic = false): Mesh {
  const mesh = MeshBuilder.CreateSphere(`sphere-${Date.now()}`, { diameter, segments: 20 }, ctx.scene);
  mesh.position.copyFrom(position);
  return finish(mesh, createMaterial(ctx.scene, `${mesh.name}-mat`, randomColor(), 0.38), ctx, dynamic);
}

export function createCylinder(ctx: ObjectContext, position: Vector3, height = 2.4, diameter = 1.2, dynamic = false): Mesh {
  const mesh = MeshBuilder.CreateCylinder(`cylinder-${Date.now()}`, { height, diameter, tessellation: 24 }, ctx.scene);
  mesh.position.copyFrom(position);
  return finish(mesh, createMaterial(ctx.scene, `${mesh.name}-mat`, randomColor(), 0.3), ctx, dynamic);
}

export function createPlatform(ctx: ObjectContext, position: Vector3, width = 5, depth = 4): Mesh {
  const mesh = MeshBuilder.CreateBox("platform", { width, depth, height: 0.65 }, ctx.scene);
  mesh.position.copyFrom(position);
  return finish(mesh, createMaterial(ctx.scene, "platform-mat", new Color3(0.22, 0.28, 0.32)), ctx);
}

export function createPillar(ctx: ObjectContext, position: Vector3, height = 4): Mesh {
  const mesh = MeshBuilder.CreateCylinder("pillar", { height, diameter: 0.85, tessellation: 12 }, ctx.scene);
  mesh.position.copyFrom(position);
  return finish(mesh, createMaterial(ctx.scene, "pillar-mat", new Color3(0.73, 0.72, 0.65)), ctx);
}
