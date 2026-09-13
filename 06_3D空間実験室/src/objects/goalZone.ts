import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { ObjectContext } from "./primitives";
import { createMaterial } from "../utils/materials";

export function createGoalZone(ctx: ObjectContext, camera: Camera, options: { id: string; position: Vector3; onEnter: () => boolean }): () => void {
  const marker = MeshBuilder.CreateCylinder(options.id, { height: .08, diameter: 3.2, tessellation: 24 }, ctx.scene);
  marker.position.copyFrom(options.position).addInPlaceFromFloats(0, .08, 0);
  marker.metadata = { gameplayId: options.id, gameplayType: "goal" };
  const material = createMaterial(ctx.scene, `${options.id}-material`, new Color3(.14, .75, .56), .5);
  material.emissiveColor = new Color3(.04, .32, .18); material.alpha = .72; marker.material = material;
  const beam = MeshBuilder.CreateCylinder(`${options.id}-beam`, { height: 6, diameter: 1.2, tessellation: 16 }, ctx.scene);
  beam.position.copyFrom(options.position).addInPlaceFromFloats(0, 3, 0); beam.material = material; beam.isPickable = false;
  let entered = false;
  const observer = ctx.scene.onBeforeRenderObservable.add(() => {
    const dx = camera.position.x - options.position.x;
    const dz = camera.position.z - options.position.z;
    if (!entered && dx * dx + dz * dz < 2.4 * 2.4) entered = options.onEnter();
  });
  return () => { if (observer) ctx.scene.onBeforeRenderObservable.remove(observer); };
}
