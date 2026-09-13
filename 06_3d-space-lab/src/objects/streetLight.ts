import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { createMaterial } from "../utils/materials";
import type { ObjectContext } from "./primitives";

export function createStreetLight(ctx: ObjectContext, position: Vector3, lampMaterials: StandardMaterial[]): Mesh {
  const root = new Mesh("city-street-light", ctx.scene);
  root.position.copyFrom(position);
  const metal = createMaterial(ctx.scene, "street-light-metal", new Color3(.08, .1, .12));
  const lamp = createMaterial(ctx.scene, "street-light-lamp", new Color3(.85, .76, .42), .5);
  lamp.emissiveColor = Color3.Black();
  lampMaterials.push(lamp);
  const pole = MeshBuilder.CreateCylinder("street-light-pole", { height: 4.2, diameter: .14, tessellation: 8 }, ctx.scene);
  pole.position.y = 2.1; pole.parent = root; pole.material = metal; pole.checkCollisions = true;
  const arm = MeshBuilder.CreateBox("street-light-arm", { width: .9, height: .12, depth: .12 }, ctx.scene);
  arm.position.set(.38, 4.1, 0); arm.parent = root; arm.material = metal;
  const head = MeshBuilder.CreateBox("street-light-glow", { width: .48, height: .2, depth: .42 }, ctx.scene);
  head.position.set(.78, 3.98, 0); head.parent = root; head.material = lamp;
  ctx.shadows.addShadowCaster(pole);
  ctx.registerDynamic?.(root);
  return root;
}

export function setStreetLightsEnabled(materials: StandardMaterial[], enabled: boolean): void {
  materials.forEach((material) => {
    material.emissiveColor = enabled ? new Color3(1, .72, .22) : Color3.Black();
  });
}
