import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { InventoryManager } from "../gameplay/InventoryManager";
import type { InteractionManager } from "../interaction/InteractionManager";
import { createMaterial } from "../utils/materials";
import type { ObjectContext } from "./primitives";

export interface ItemOptions {
  id: string;
  itemId: string;
  displayName: string;
  position: Vector3;
  shape?: "box" | "sphere" | "cylinder";
  color?: Color3;
  onMessage: (message: string) => void;
  onPickup?: () => void;
}

export function createItem(ctx: ObjectContext, interactions: InteractionManager, inventory: InventoryManager, options: ItemOptions): void {
  const mesh = options.shape === "sphere"
    ? MeshBuilder.CreateSphere(options.id, { diameter: .55, segments: 12 }, ctx.scene)
    : options.shape === "cylinder"
      ? MeshBuilder.CreateCylinder(options.id, { height: .18, diameter: .7, tessellation: 16 }, ctx.scene)
      : MeshBuilder.CreateBox(options.id, { width: .65, height: .22, depth: .28 }, ctx.scene);
  mesh.position.copyFrom(options.position);
  mesh.metadata = { ...mesh.metadata, gameplayId: options.id, gameplayType: "item", interactionType: "pickup" };
  const material = createMaterial(ctx.scene, `${options.id}-material`, options.color ?? new Color3(.9, .68, .12), .5);
  material.emissiveColor = (options.color ?? new Color3(.9, .68, .12)).scale(.22);
  mesh.material = material;
  let pickedUp = false;
  const unregister = interactions.register({
    id: options.id,
    displayName: options.displayName,
    type: "pickup",
    mesh,
    getActionLabel: () => "拾う",
    enabled: () => !pickedUp,
    interact: () => {
      if (pickedUp) return;
      pickedUp = true; unregister(); inventory.add(options.itemId, options.displayName);
      options.onMessage(`${options.displayName}を手に入れた`); options.onPickup?.(); mesh.dispose(false, true);
    },
  });
}
