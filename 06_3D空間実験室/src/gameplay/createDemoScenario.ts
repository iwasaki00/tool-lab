import type { Camera } from "@babylonjs/core/Cameras/camera";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { InteriorManager } from "../interior/InteriorManager";
import type { InteriorBuildingSite, InteriorNavigation } from "../interior/Room";
import type { InteractionFocus } from "../interaction/Interactable";
import { InteractionManager } from "../interaction/InteractionManager";
import { createDoor } from "../objects/interactiveDoor";
import { createItem } from "../objects/interactiveItem";
import { createGoalZone } from "../objects/goalZone";
import type { ObjectContext } from "../objects/primitives";
import { createMaterial } from "../utils/materials";
import { createBuilding, INTERIOR_FLOOR_HEIGHT } from "../world/buildingGenerator";
import { createBounds, type SemanticLocation, type WorldStatistics } from "../world/SemanticTypes";
import type { WorldRegistry } from "../world/WorldRegistry";
import { EventManager } from "./EventManager";
import { GamePlacementManager } from "./GamePlacementManager";
import { InventoryManager, type InventoryEntry } from "./InventoryManager";
import { MissionGenerator, type MissionPlan } from "./MissionGenerator";
import { validateMission, type MissionValidation } from "./MissionValidator";
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
  semanticLocation: () => SemanticLocation;
  worldStatistics: () => WorldStatistics;
  mission: () => { plan: MissionPlan; validation: MissionValidation };
  setDayMode: (isDay: boolean) => void;
  setDebugMode: (visible: boolean) => void;
  dispose: () => void;
}

export function createDemoScenario(
  ctx: ObjectContext,
  camera: Camera,
  spawn: Vector3,
  callbacks: GameplayCallbacks,
  registry: WorldRegistry,
  cityInteriorSites: InteriorBuildingSite[] = [],
  citySeed = 1,
  missionSeed = citySeed + 54321,
): DemoScenario {
  const interactions = new InteractionManager(ctx.scene, camera, callbacks.onFocus, 3);
  const inventory = new InventoryManager(callbacks.onInventory);
  const objectives = new ObjectiveManager(callbacks.onObjective, callbacks.onMissionComplete);
  const events = new EventManager();
  const placement = new GamePlacementManager(registry, missionSeed);
  const missionArea = registry.get("mission_site");
  const extent = Math.round(7 - spawn.z);
  const fallbackZ = extent === 24 ? -12 : extent === 32 ? 0 : extent === 40 ? -11 : spawn.z;
  const missionPosition = missionArea ? new Vector3(missionArea.position.x, .12, missionArea.position.z) : new Vector3(-15, .12, fallbackZ);

  const missionRoot = createBuilding(ctx, {
    buildingId: "building_mission_001", position: missionPosition, width: 12, depth: 20, floors: 2, rotation: -Math.PI / 2,
    color: new Color3(.28, .43, .48), windowColumns: 4, doorPosition: "center", roofShape: "flat", type: "office", hasInterior: true, interiorMode: "interior-ready",
  });
  missionRoot.metadata = { ...missionRoot.metadata, landmark: true };
  registry.remove("mission_site");
  registry.register({ id: "building_mission_001", type: "BUILDING", position: missionPosition, bounds: createBounds(missionPosition, 20, 12, 0, INTERIOR_FLOOR_HEIGHT * 2), connections: ["building_mission_001_entrance_001"], tags: ["private", "landmark", "mission"], importance: 10, metadata: { floors: 2, hasInterior: true } });
  const missionSite: InteriorBuildingSite = { id: "building_mission_001", root: missionRoot, width: 12, depth: 20, floors: 2, floorHeight: INTERIOR_FLOOR_HEIGHT, seed: citySeed + 104729, state: "NOT_GENERATED", mission: true };

  const interiorManager = new InteriorManager(ctx, camera, [missionSite, ...cityInteriorSites], {
    interactions, inventory, events, objectives, onMessage: callbacks.onMessage, gateEventId: "OPEN_GATE_A", registry, placement,
  });
  const plan = new MissionGenerator(registry, placement, missionSeed).generate(spawn, missionSite.id);
  const validation = validateMission(plan, registry);
  if (!validation.valid) console.warn("MISSION VALIDATION", validation.errors);

  createItem(ctx, interactions, inventory, {
    id: "item_key_001", itemId: "key", displayName: "鍵", position: toVector(plan.key.position), color: new Color3(.95, .68, .12), onMessage: callbacks.onMessage,
    onPickup: () => objectives.set("INTERIOR LABの入口を開ける"),
  });

  const goalPosition = toVector(plan.goal.position);
  const route = goalPosition.subtract(spawn); route.y = 0;
  if (route.lengthSquared() < 1) route.set(0, 0, 1); else route.normalize();
  const gatePosition = goalPosition.subtract(route.scale(4.5)); gatePosition.y = .12;
  const gateRotation = Math.atan2(route.x, route.z);
  let gateActivated = false;
  createMissionFrame(ctx, gatePosition, gateRotation, new Color3(.18, .28, .33));
  const perpendicular = new Vector3(route.z, 0, -route.x);
  const gateHinge = gatePosition.add(perpendicular.scale(1.4));
  const gate = createDoor(ctx, interactions, inventory, { id: "door_gate_001", displayName: "屋外ゲート", position: gateHinge, width: 2.8, rotation: gateRotation, color: new Color3(.16, .34, .42), interactable: false, onMessage: callbacks.onMessage });
  events.on("OPEN_GATE_A", () => { gateActivated = true; gate.open(); });

  createSemanticSpawnPoints(placement, registry, spawn);
  placement.createDebugMarkers(ctx);
  createInspectables(ctx, interactions, missionPosition, callbacks.onMessage);
  const disposeGoal = createGoalZone(ctx, camera, { id: "goal_001", position: goalPosition, onEnter: () => { if (!gateActivated) return false; objectives.complete(); return true; } });
  objectives.set("鍵を探す");

  return {
    interact: () => interactions.interact(),
    focus: () => interactions.getDebugInfo(),
    inventory: () => inventory.entries(),
    objective: () => objectives.get(),
    navigation: () => interiorManager.navigation(),
    semanticLocation: () => registry.getLocationAt(camera.position),
    worldStatistics: () => registry.getStatistics(),
    mission: () => ({ plan, validation }),
    setDayMode: (isDay) => interiorManager.setDayMode(isDay),
    setDebugMode: (visible) => placement.setDebugVisible(visible),
    dispose: () => { disposeGoal(); interiorManager.dispose(); interactions.dispose(); inventory.clear(); events.clear(); },
  };
}

function createSemanticSpawnPoints(placement: GamePlacementManager, registry: WorldRegistry, start: Vector3): void {
  for (let index = 0; index < 2; index += 1) {
    const enemyArea = placement.chooseArea(["ALLEY", "STORAGE", "CORRIDOR", "ROAD"], ["danger", "dark", "dead_end"], start, 12);
    if (enemyArea) { const enemy = placement.place(`enemy_${index + 1}`, "ENEMY", enemyArea, .12); placement.registerSpawn(enemy); registry.connect(`placement_${enemy.id}`, enemy.areaId); }
    const npcArea = placement.chooseArea(["PLAZA", "PARK", "SIDEWALK", "BUILDING_ENTRANCE", "OFFICE"], ["safe", "public", "bright"], start, 5);
    if (npcArea) { const npc = placement.place(`npc_${index + 1}`, "NPC", npcArea, .12); placement.registerSpawn(npc); registry.connect(`placement_${npc.id}`, npc.areaId); }
  }
}

function createMissionFrame(ctx: ObjectContext, position: Vector3, rotation: number, color: Color3): void {
  const root = new Mesh("mission-frame", ctx.scene); root.position.copyFrom(position); root.rotation.y = rotation;
  const material = createMaterial(ctx.scene, `mission-frame-${position.x}-${position.z}`, color);
  for (const x of [-2.45, 2.45]) {
    const pillar = MeshBuilder.CreateBox("mission-frame-pillar", { width: 2.1, height: 3.8, depth: .5 }, ctx.scene);
    pillar.position.set(x, 1.9, 0); pillar.parent = root; pillar.material = material; pillar.checkCollisions = true; ctx.shadows.addShadowCaster(pillar);
  }
  const header = MeshBuilder.CreateBox("mission-frame-header", { width: 7, height: .55, depth: .5 }, ctx.scene);
  header.position.set(0, 3.65, 0); header.parent = root; header.material = material; header.checkCollisions = true;
}

function createInspectables(ctx: ObjectContext, interactions: InteractionManager, missionPosition: Vector3, onMessage: (message: string) => void): void {
  const sign = MeshBuilder.CreateBox("sign_001", { width: 1.8, height: 1, depth: .12 }, ctx.scene);
  sign.position.set(missionPosition.x + 3.8, 1.65, missionPosition.z - 2.5); sign.material = createMaterial(ctx.scene, "sign-material", new Color3(.2, .35, .39));
  interactions.register({ id: "sign_001", displayName: "案内板", type: "inspect", mesh: sign, getActionLabel: () => "調べる", interact: () => onMessage("鍵を見つけてINTERIOR LABを探索しよう") });

  const crate = MeshBuilder.CreateBox("push_crate_001", { size: 1.15 }, ctx.scene);
  crate.position.set(missionPosition.x + 4, .7, missionPosition.z + 3); crate.material = createMaterial(ctx.scene, "push-crate-material", new Color3(.38, .23, .12)); crate.checkCollisions = true;
  interactions.register({ id: "push_crate_001", displayName: "古びた木箱", type: "push", mesh: crate, getActionLabel: () => "押す", interact: () => { crate.position.z += .65; onMessage("古びた木箱を押した"); } });
}

function toVector(position: { x: number; y: number; z: number }): Vector3 { return new Vector3(position.x, position.y, position.z); }
