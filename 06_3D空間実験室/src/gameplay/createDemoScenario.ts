import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { InteractionFocus } from "../interaction/Interactable";
import { InteractionManager } from "../interaction/InteractionManager";
import { createGoalZone } from "../objects/goalZone";
import { createDoor } from "../objects/interactiveDoor";
import { createItem } from "../objects/interactiveItem";
import type { ObjectContext } from "../objects/primitives";
import { createMaterial } from "../utils/materials";
import { createBuilding, INTERIOR_FLOOR_HEIGHT } from "../world/buildingGenerator";
import { InteriorManager } from "../interior/InteriorManager";
import type { InteriorBuildingSite, InteriorNavigation } from "../interior/Room";
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
  navigation: () => InteriorNavigation | undefined;
  setDayMode: (isDay: boolean) => void;
  dispose: () => void;
}

export function createDemoScenario(ctx: ObjectContext, camera: Camera, spawn: Vector3, callbacks: GameplayCallbacks, cityInteriorSites: InteriorBuildingSite[] = [], seed = 1): DemoScenario {
  const interactions = new InteractionManager(ctx.scene, camera, callbacks.onFocus, 3);
  const inventory = new InventoryManager(callbacks.onInventory);
  const objectives = new ObjectiveManager(callbacks.onObjective, callbacks.onMissionComplete);
  const events = new EventManager();
  const z = spawn.z;
  const extent = Math.round(7 - spawn.z);
  const missionZ = extent === 24 ? -12 : extent === 32 ? 0 : extent === 40 ? -11 : z;
  const gateZ = missionZ + 12;
  let gateActivated = false;
  let disposeGoal: () => void = () => undefined;

  const missionRoot = createBuilding(ctx, {
    buildingId: "building_mission_001", position: new Vector3(-15, .12, missionZ), width: 12, depth: 20, floors: 2, rotation: -Math.PI / 2,
    color: new Color3(.28, .43, .48), windowColumns: 4, doorPosition: "center", roofShape: "flat", type: "office", hasInterior: true, interiorMode: "interior-ready",
  });
  missionRoot.metadata = { ...missionRoot.metadata, landmark: true };
  const missionSite: InteriorBuildingSite = { id: "building_mission_001", root: missionRoot, width: 12, depth: 20, floors: 2, floorHeight: INTERIOR_FLOOR_HEIGHT, seed: seed + 104729, state: "NOT_GENERATED", mission: true };

  createItem(ctx, interactions, inventory, {
    id: "item_key_001", itemId: "key", displayName: "鍵", position: new Vector3(-2.2, .48, missionZ), color: new Color3(.95, .68, .12), onMessage: callbacks.onMessage,
    onPickup: () => objectives.set("INTERIOR LABの入口を開ける"),
  });

  createMissionFrame(ctx, gateZ, new Color3(.18, .28, .33));
  const gate = createDoor(ctx, interactions, inventory, { id: "door_gate_001", displayName: "屋外ゲート", position: new Vector3(-1.4, .12, gateZ), width: 2.8, color: new Color3(.16, .34, .42), interactable: false, onMessage: callbacks.onMessage });
  events.on("OPEN_GATE_A", () => { gateActivated = true; gate.open(); });
  const interiorManager = new InteriorManager(ctx, camera, [missionSite, ...cityInteriorSites], { interactions, inventory, events, objectives, onMessage: callbacks.onMessage, gateEventId: "OPEN_GATE_A" });

  createInspectables(ctx, interactions, missionZ, callbacks.onMessage);
  disposeGoal = createGoalZone(ctx, camera, { id: "goal_001", position: new Vector3(0, .12, gateZ + 5), onEnter: () => { if (!gateActivated) return false; objectives.complete(); return true; } });
  objectives.set("鍵を探す");

  return {
    interact: () => interactions.interact(),
    focus: () => interactions.getDebugInfo(),
    inventory: () => inventory.entries(),
    objective: () => objectives.get(),
    navigation: () => interiorManager.navigation(),
    setDayMode: (isDay) => interiorManager.setDayMode(isDay),
    dispose: () => { disposeGoal(); interiorManager.dispose(); interactions.dispose(); inventory.clear(); events.clear(); },
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

function createInspectables(ctx: ObjectContext, interactions: InteractionManager, missionZ: number, onMessage: (message: string) => void): void {
  const sign = MeshBuilder.CreateBox("sign_001", { width: 1.8, height: 1, depth: .12 }, ctx.scene);
  sign.position.set(-3.8, 1.65, missionZ - 2.5); sign.material = createMaterial(ctx.scene, "sign-material", new Color3(.2, .35, .39));
  interactions.register({ id: "sign_001", displayName: "案内板", type: "inspect", mesh: sign, getActionLabel: () => "調べる", interact: () => onMessage("鍵を見つけてINTERIOR LABを探索しよう") });

  const crate = MeshBuilder.CreateBox("push_crate_001", { size: 1.15 }, ctx.scene);
  crate.position.set(-4, .7, missionZ + 3); crate.material = createMaterial(ctx.scene, "push-crate-material", new Color3(.38, .23, .12)); crate.checkCollisions = true;
  interactions.register({ id: "push_crate_001", displayName: "古びた木箱", type: "push", mesh: crate, getActionLabel: () => "押す", interact: () => { crate.position.z += .65; onMessage("古びた木箱を押した"); } });
}
