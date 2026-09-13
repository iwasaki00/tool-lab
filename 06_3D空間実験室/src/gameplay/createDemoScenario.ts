import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { InteractionFocus } from "../interaction/Interactable";
import { InteractionManager } from "../interaction/InteractionManager";
import { createGoalZone } from "../objects/goalZone";
import { createDoor } from "../objects/interactiveDoor";
import { createItem } from "../objects/interactiveItem";
import { createSwitch } from "../objects/interactiveSwitch";
import type { ObjectContext } from "../objects/primitives";
import { createMaterial } from "../utils/materials";
import { EventManager } from "./EventManager";
import { InventoryManager, type InventoryEntry } from "./InventoryManager";
import { ObjectiveManager } from "./ObjectiveManager";

export interface GameplayCallbacks {
  onFocus: (focus?: InteractionFocus) => void;
  onMessage: (message: string) => void;
  onObjective: (objective: string) => void;
  onInventory: (items: InventoryEntry[]) => void;
  onMissionComplete: () => void;
}

export interface DemoScenario {
  interact: () => void;
  focus: () => InteractionFocus | undefined;
  inventory: () => InventoryEntry[];
  objective: () => string;
  dispose: () => void;
}

export function createDemoScenario(ctx: ObjectContext, camera: Camera, spawn: Vector3, callbacks: GameplayCallbacks): DemoScenario {
  const interactions = new InteractionManager(ctx.scene, camera, callbacks.onFocus, 3);
  const inventory = new InventoryManager(callbacks.onInventory);
  const objectives = new ObjectiveManager(callbacks.onObjective, callbacks.onMissionComplete);
  const events = new EventManager();
  const z = spawn.z;
  let gateActivated = false;
  let disposeGoal: () => void = () => undefined;

  createMissionFrame(ctx, z + 10, new Color3(.32, .24, .18));
  let lockedDoor = createDoor(ctx, interactions, inventory, {
    id: "door_locked_001", displayName: "ロックされたドア", position: new Vector3(-1.4, .12, z + 10), locked: true, keyId: "key", onMessage: callbacks.onMessage,
    onOpened: () => { if (lockedDoor.isOpen()) objectives.set("内部のスイッチを押す"); },
  });

  createItem(ctx, interactions, inventory, {
    id: "item_key_001", itemId: "key", displayName: "鍵", position: new Vector3(1.4, .48, z + 5.4), color: new Color3(.95, .68, .12), onMessage: callbacks.onMessage,
    onPickup: () => objectives.set("ロックされたドアを開ける"),
  });

  createMissionRoom(ctx, z + 10, z + 21);
  createMissionFrame(ctx, z + 21, new Color3(.18, .28, .33));
  const gate = createDoor(ctx, interactions, inventory, { id: "door_gate_001", displayName: "遠隔ゲート", position: new Vector3(-1.4, .12, z + 21), width: 2.8, color: new Color3(.16, .34, .42), interactable: false, onMessage: callbacks.onMessage });
  events.on("OPEN_GATE_A", () => { gateActivated = true; gate.open(); });
  createSwitch(ctx, interactions, events, { id: "switch_001", position: new Vector3(2.7, .12, z + 15), eventId: "OPEN_GATE_A", onMessage: callbacks.onMessage, onActivate: () => objectives.set("開いたゲートの先へ進む") });

  createInspectables(ctx, interactions, z, callbacks.onMessage);
  disposeGoal = createGoalZone(ctx, camera, { id: "goal_001", position: new Vector3(0, .12, z + 26), onEnter: () => { if (!gateActivated) return false; objectives.complete(); return true; } });
  objectives.set("鍵を探す");

  return {
    interact: () => interactions.interact(),
    focus: () => interactions.getDebugInfo(),
    inventory: () => inventory.entries(),
    objective: () => objectives.get(),
    dispose: () => { disposeGoal(); interactions.dispose(); inventory.clear(); events.clear(); },
  };
}

function createMissionFrame(ctx: ObjectContext, z: number, color: Color3): void {
  const material = createMaterial(ctx.scene, `mission-frame-${z}`, color);
  for (const x of [-2.45, 2.45]) {
    const pillar = MeshBuilder.CreateBox("mission-frame-pillar", { width: 2.1, height: 3.8, depth: .5 }, ctx.scene);
    pillar.position.set(x, 2.02, z); pillar.material = material; pillar.checkCollisions = true; ctx.shadows.addShadowCaster(pillar);
  }
  const header = MeshBuilder.CreateBox("mission-frame-header", { width: 7, height: .55, depth: .5 }, ctx.scene);
  header.position.set(0, 3.65, z); header.material = material; header.checkCollisions = true;
}

function createMissionRoom(ctx: ObjectContext, startZ: number, endZ: number): void {
  const material = createMaterial(ctx.scene, "mission-room-wall-material", new Color3(.23, .27, .28));
  for (const x of [-3.65, 3.65]) {
    const wall = MeshBuilder.CreateBox("mission-room-wall", { width: .35, height: 3.2, depth: endZ - startZ }, ctx.scene);
    wall.position.set(x, 1.72, (startZ + endZ) / 2); wall.material = material; wall.checkCollisions = true; wall.receiveShadows = true;
  }
}

function createInspectables(ctx: ObjectContext, interactions: InteractionManager, z: number, onMessage: (message: string) => void): void {
  const sign = MeshBuilder.CreateBox("sign_001", { width: 1.8, height: 1, depth: .12 }, ctx.scene);
  sign.position.set(-3.2, 1.65, z + 4); sign.material = createMaterial(ctx.scene, "sign-material", new Color3(.2, .35, .39));
  interactions.register({ id: "sign_001", displayName: "案内板", type: "inspect", mesh: sign, getActionLabel: () => "調べる", interact: () => onMessage("鍵はゲートの手前にあるようだ") });

  const crate = MeshBuilder.CreateBox("push_crate_001", { size: 1.15 }, ctx.scene);
  crate.position.set(-3.1, .7, z + 15); crate.material = createMaterial(ctx.scene, "push-crate-material", new Color3(.38, .23, .12)); crate.checkCollisions = true;
  interactions.register({ id: "push_crate_001", displayName: "古びた木箱", type: "push", mesh: crate, getActionLabel: () => "押す", interact: () => { crate.position.z += .65; onMessage("古びた木箱を押した"); } });
}
