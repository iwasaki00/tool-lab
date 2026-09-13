import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { createMaterial } from "../utils/materials";
import type { ObjectContext } from "./primitives";

export function createTree(ctx: ObjectContext, position: Vector3, scale = 1): Mesh {
  const root = new Mesh("city-tree", ctx.scene);
  root.position.copyFrom(position);
  const trunkMat = createMaterial(ctx.scene, "tree-trunk", new Color3(.34, .2, .08));
  const leafMat = createMaterial(ctx.scene, "tree-leaves", new Color3(.14, .47, .22));
  const trunk = MeshBuilder.CreateCylinder("tree-trunk", { height: 2.2 * scale, diameter: .42 * scale, tessellation: 8 }, ctx.scene);
  trunk.position.y = 1.1 * scale; trunk.parent = root; trunk.material = trunkMat; trunk.checkCollisions = true;
  const crown = MeshBuilder.CreateSphere("tree-crown", { diameter: 2.2 * scale, segments: 8 }, ctx.scene);
  crown.position.y = 2.65 * scale; crown.parent = root; crown.material = leafMat;
  ctx.shadows.addShadowCaster(trunk); ctx.shadows.addShadowCaster(crown);
  ctx.registerDynamic?.(root);
  return root;
}
