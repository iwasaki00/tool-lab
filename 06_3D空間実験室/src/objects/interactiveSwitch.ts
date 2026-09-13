import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { EventManager } from "../gameplay/EventManager";
import type { InteractionManager } from "../interaction/InteractionManager";
import { createMaterial } from "../utils/materials";
import type { ObjectContext } from "./primitives";

export function createSwitch(ctx: ObjectContext, interactions: InteractionManager, events: EventManager, options: { id: string; position: Vector3; eventId: string; onMessage: (message: string) => void; onActivate?: () => void }): void {
  const base = MeshBuilder.CreateBox(`${options.id}-base`, { width: 1, height: 2.2, depth: .35 }, ctx.scene);
  base.position.copyFrom(options.position).addInPlaceFromFloats(0, 1.1, 0);
  base.material = createMaterial(ctx.scene, `${options.id}-base-material`, new Color3(.17, .2, .22)); base.checkCollisions = true;
  const button = MeshBuilder.CreateBox(`${options.id}-button`, { width: .48, height: .34, depth: .16 }, ctx.scene);
  button.position.copyFrom(options.position).addInPlaceFromFloats(0, 1.65, -.25);
  const material = createMaterial(ctx.scene, `${options.id}-button-material`, new Color3(.78, .18, .08), .4); button.material = material;
  let active = false;
  interactions.register({ id: options.id, displayName: "ゲートスイッチ", type: "activate", mesh: button, getActionLabel: () => active ? "起動済み" : "起動する", enabled: () => !active, interact: () => {
    if (active) return; active = true; material.diffuseColor = new Color3(.15, .8, .42); material.emissiveColor = new Color3(.03, .3, .12);
    events.emit(options.eventId); options.onMessage("遠くでゲートが開く音がした"); options.onActivate?.();
  } });
}
