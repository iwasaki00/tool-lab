import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { createMaterial } from "../utils/materials";
import type { ObjectContext } from "./primitives";

export function createBench(ctx: ObjectContext, position: Vector3, rotation = 0): Mesh {
  const root = new Mesh("city-bench", ctx.scene);
  root.position.copyFrom(position); root.rotation.y = rotation;
  const wood = ctx.materials?.getWoodMaterial() ?? createMaterial(ctx.scene, "bench-wood", new Color3(.48, .25, .1));
  const metal = ctx.materials?.getMetalMaterial() ?? createMaterial(ctx.scene, "bench-metal", new Color3(.12, .14, .15));
  const add = (name: string, width: number, height: number, depth: number, x: number, y: number, z: number, material = wood) => {
    const mesh = MeshBuilder.CreateBox(name, { width, height, depth }, ctx.scene);
    mesh.position.set(x, y, z); mesh.parent = root; mesh.material = material; mesh.checkCollisions = true; mesh.metadata = { visualLod: 0 };
    return mesh;
  };
  add("bench-seat", 2.2, .16, .62, 0, .72, 0);
  add("bench-back", 2.2, .7, .14, 0, 1.12, .27);
  [-.82, .82].forEach((x) => add("bench-leg", .14, .7, .14, x, .35, 0, metal));
  ctx.registerDynamic?.(root);
  return root;
}
