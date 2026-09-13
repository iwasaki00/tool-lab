import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { createMaterial } from "../utils/materials";
import type { ObjectContext } from "../objects/primitives";

export interface RoadOptions {
  position: Vector3;
  width: number;
  length: number;
  rotation?: number;
  markings?: boolean;
  sidewalkWidth?: number;
  roadColor?: Color3;
  sidewalkColor?: Color3;
}

export function createRoad(ctx: ObjectContext, options: RoadOptions): Mesh {
  const { position, width, length, rotation = 0, markings = true, sidewalkWidth = 1.8 } = options;
  const root = new Mesh("city-road", ctx.scene);
  root.position.copyFrom(position); root.rotation.y = rotation;
  const asphalt = createMaterial(ctx.scene, "city-asphalt", options.roadColor ?? new Color3(.075, .09, .105), .04);
  const concrete = createMaterial(ctx.scene, "city-sidewalk", options.sidewalkColor ?? new Color3(.45, .47, .46), .08);
  const paint = createMaterial(ctx.scene, "road-paint", new Color3(.91, .89, .72), .05);
  const road = MeshBuilder.CreateBox("road-carriageway", { width, depth: length, height: .08 }, ctx.scene);
  road.position.y = .04; road.parent = root; road.material = asphalt; road.checkCollisions = true; road.receiveShadows = true;
  if (sidewalkWidth > 0) {
    [-1, 1].forEach((side) => {
      const sidewalk = createSidewalk(ctx, width, length, side, sidewalkWidth);
      sidewalk.parent = root; sidewalk.material = concrete;
    });
  }
  if (markings) {
    const dashCount = Math.max(2, Math.floor(length / 5));
    for (let i = 0; i < dashCount; i += 1) {
      const dash = MeshBuilder.CreateBox("road-center-line", { width: .12, depth: 2.2, height: .025 }, ctx.scene);
      dash.position.set(0, .095, -length / 2 + 2.5 + i * 5); dash.parent = root; dash.material = paint;
    }
  }
  ctx.registerDynamic?.(root);
  return root;
}

export function createSidewalk(ctx: ObjectContext, roadWidth: number, length: number, side: number, sidewalkWidth = 1.8): Mesh {
  const sidewalk = MeshBuilder.CreateBox("city-sidewalk", { width: sidewalkWidth, depth: length, height: .22 }, ctx.scene);
  sidewalk.position.set(side * (roadWidth / 2 + sidewalkWidth / 2), .11, 0);
  sidewalk.checkCollisions = true; sidewalk.receiveShadows = true;
  return sidewalk;
}

export function createIntersection(ctx: ObjectContext, position: Vector3, roadWidth: number): Mesh {
  const root = new Mesh("city-intersection", ctx.scene);
  root.position.copyFrom(position);
  const paint = createMaterial(ctx.scene, "crosswalk-paint", new Color3(.92, .92, .88), .08);
  for (let direction = 0; direction < 2; direction += 1) {
    for (let i = -3; i <= 3; i += 1) {
      const stripe = MeshBuilder.CreateBox("crosswalk", { width: .55, depth: 2.6, height: .03 }, ctx.scene);
      stripe.position.set(i * .85, .105, direction === 0 ? -roadWidth / 2 - 1.5 : roadWidth / 2 + 1.5);
      if (direction === 1) stripe.rotation.y = Math.PI / 2;
      stripe.parent = root; stripe.material = paint;
    }
  }
  ctx.registerDynamic?.(root);
  return root;
}
