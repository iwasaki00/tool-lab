import "@babylonjs/core/Animations/animatable";
import { Animation } from "@babylonjs/core/Animations/animation";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { InventoryManager } from "../gameplay/InventoryManager";
import type { InteractionManager } from "../interaction/InteractionManager";
import type { ObjectContext } from "./primitives";
import { createMaterial } from "../utils/materials";

export interface DoorController {
  id: string;
  open: () => void;
  close: () => void;
  toggle: () => void;
  unlock: () => void;
  lock: () => void;
  reset: () => void;
  isOpen: () => boolean;
  isLocked: () => boolean;
}

export interface DoorOptions {
  id: string;
  displayName: string;
  position: Vector3;
  width?: number;
  height?: number;
  rotation?: number;
  locked?: boolean;
  keyId?: string;
  interactable?: boolean;
  color?: Color3;
  parent?: TransformNode;
  onMessage: (message: string) => void;
  onOpened?: () => void;
}

export function createDoor(ctx: ObjectContext, interactions: InteractionManager, inventory: InventoryManager, options: DoorOptions): DoorController {
  const width = options.width ?? 2.8;
  const height = options.height ?? 3.2;
  const hinge = new Mesh(`${options.id}-hinge`, ctx.scene);
  hinge.position.copyFrom(options.position); hinge.rotation.y = options.rotation ?? 0; hinge.parent = options.parent ?? null;
  const panel = MeshBuilder.CreateBox(`${options.id}-panel`, { width, height, depth: .22 }, ctx.scene);
  panel.position.set(width / 2, height / 2, 0); panel.parent = hinge;
  panel.material = createMaterial(ctx.scene, `${options.id}-material`, options.color ?? new Color3(.35, .18, .08));
  panel.checkCollisions = true; panel.receiveShadows = true; ctx.shadows.addShadowCaster(panel);
  let open = false;
  let locked = options.locked ?? false;
  let animating = false;
  panel.metadata = { ...panel.metadata, navigationDoor: true, navigationDoorOpen: false, navigationDoorLocked: locked };
  const closedAngle = hinge.rotation.y;
  const openAngle = closedAngle + Math.PI / 2;

  const animateTo = (nextOpen: boolean): void => {
    if (animating || open === nextOpen) return;
    animating = true;
    Animation.CreateAndStartAnimation(`${options.id}-animation`, hinge, "rotation.y", 30, 21, hinge.rotation.y, nextOpen ? openAngle : closedAngle, Animation.ANIMATIONLOOPMODE_CONSTANT, undefined, () => {
      open = nextOpen; animating = false; panel.metadata = { ...panel.metadata, navigationDoorOpen: open, navigationDoorLocked: locked }; options.onOpened?.();
    }, ctx.scene);
  };

  const controller: DoorController = {
    id: options.id,
    open: () => animateTo(true),
    close: () => animateTo(false),
    toggle: () => animateTo(!open),
    unlock: () => { locked = false; panel.metadata = { ...panel.metadata, navigationDoorLocked: false }; },
    lock: () => { if (open) animateTo(false); locked = true; panel.metadata = { ...panel.metadata, navigationDoorLocked: true }; },
    reset: () => { if (open) animateTo(false); locked = options.locked ?? false; panel.metadata = { ...panel.metadata, navigationDoorOpen: false, navigationDoorLocked: locked }; },
    isOpen: () => open,
    isLocked: () => locked,
  };
  hinge.metadata = { ...hinge.metadata, gameplayId: options.id, gameplayType: "door", debugDoorController: controller };
  panel.metadata = { ...panel.metadata, gameplayId: options.id, gameplayType: "door", interactionType: "open", debugDoorController: controller };

  if (options.interactable !== false) interactions.register({
    id: options.id,
    displayName: options.displayName,
    type: "open",
    mesh: panel,
    getActionLabel: () => open ? "閉じる" : "開ける",
    interact: () => {
      if (animating) return;
      if (locked) {
        if (!options.keyId || !inventory.has(options.keyId)) { options.onMessage("鍵がかかっている"); return; }
        locked = false; panel.metadata = { ...panel.metadata, navigationDoorLocked: false }; options.onMessage("鍵を使ってロックを解除した");
      }
      animateTo(!open);
    },
  });
  return controller;
}
