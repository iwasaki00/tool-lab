import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { EventManager } from "../gameplay/EventManager";
import type { InteractionManager } from "../interaction/InteractionManager";
import { createMaterial } from "../utils/materials";
import type { ObjectContext } from "./primitives";

export interface SwitchController { id: string; on: () => void; off: () => void; toggle: () => void; reset: () => void; isActive: () => boolean }

export function createSwitch(ctx: ObjectContext, interactions: InteractionManager, events: EventManager, options: { id: string; position: Vector3; eventId: string; emitEvent?: boolean; onMessage: (message: string) => void; onActivate?: () => void }): SwitchController {
  const base = MeshBuilder.CreateBox(`${options.id}-base`, { width: 1, height: 2.2, depth: .35 }, ctx.scene);
  base.position.copyFrom(options.position).addInPlaceFromFloats(0, 1.1, 0);
  base.material = createMaterial(ctx.scene, `${options.id}-base-material`, new Color3(.17, .2, .22)); base.checkCollisions = true;
  const button = MeshBuilder.CreateBox(`${options.id}-button`, { width: .48, height: .34, depth: .16 }, ctx.scene);
  button.position.copyFrom(options.position).addInPlaceFromFloats(0, 1.65, -.25);
  const material = createMaterial(ctx.scene, `${options.id}-button-material`, new Color3(.78, .18, .08), .4); button.material = material;
  let active = false;
  const apply = (next: boolean, emit = false) => {
    active = next; material.diffuseColor = active ? new Color3(.15, .8, .42) : new Color3(.78, .18, .08); material.emissiveColor = active ? new Color3(.03, .3, .12) : new Color3(.3, .04, .02);
    if (active && emit) { options.onActivate?.(); if (options.emitEvent !== false) events.emit(options.eventId); }
  };
  const controller: SwitchController = { id: options.id, on: () => apply(true, !active), off: () => apply(false), toggle: () => apply(!active, !active), reset: () => apply(false), isActive: () => active };
  base.metadata = { ...base.metadata, gameplayId: options.id, gameplayType: "switch", debugSwitchController: controller };
  button.metadata = { ...button.metadata, gameplayId: options.id, gameplayType: "switch", interactionType: "activate", debugSwitchController: controller };
  interactions.register({ id: options.id, displayName: "ゲートスイッチ", type: "activate", mesh: button, getActionLabel: () => active ? "起動済み" : "起動する", enabled: () => !active, interact: () => {
    if (active) return; active = true; material.diffuseColor = new Color3(.15, .8, .42); material.emissiveColor = new Color3(.03, .3, .12);
    options.onActivate?.();
    if (options.emitEvent !== false) { events.emit(options.eventId); options.onMessage("遠くでゲートが開く音がした"); }
    else options.onMessage("スイッチを起動した");
  } });
  return controller;
}
