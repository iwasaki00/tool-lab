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
  const metal = ctx.materials?.getMetalMaterial() ?? createMaterial(ctx.scene, "street-light-metal", new Color3(.08, .1, .12));
  const lamp = ctx.materials?.getLampMaterial() ?? createMaterial(ctx.scene, "street-light-lamp", new Color3(.85, .76, .42), .5);
  lamp.emissiveColor = Color3.Black();
  lamp.metadata = { nightColor: [1, .72, .22] };
  lampMaterials.push(lamp);
  const pole = MeshBuilder.CreateCylinder("street-light-pole", { height: 4.2, diameter: .14, tessellation: 8 }, ctx.scene);
  pole.position.y = 2.1; pole.parent = root; pole.material = metal; pole.checkCollisions = true;
  const arm = MeshBuilder.CreateBox("street-light-arm", { width: .9, height: .12, depth: .12 }, ctx.scene);
  arm.position.set(.38, 4.1, 0); arm.material = metal;
  pole.parent = null;
  const frame = Mesh.MergeMeshes([pole, arm], true, true, undefined, false, false);
  if (frame) { frame.name = "street-light-frame"; frame.parent = root; frame.material = metal; frame.checkCollisions = true; frame.metadata = { visualLod: 1 }; }
  const head = MeshBuilder.CreateBox("street-light-glow", { width: .48, height: .2, depth: .42 }, ctx.scene);
  head.position.set(.78, 3.98, 0); head.parent = root; head.material = lamp; head.metadata = { visualLod: 0 };
  if (frame) ctx.shadows.addShadowCaster(frame);
  ctx.registerDynamic?.(root);
  return root;
}

export function setStreetLightsEnabled(materials: StandardMaterial[], enabled: boolean): void {
  materials.forEach((material) => {
    const color = material.metadata?.nightColor as number[] | undefined;
    material.emissiveColor = enabled ? new Color3(color?.[0] ?? 1, color?.[1] ?? .72, color?.[2] ?? .22) : Color3.Black();
  });
}
