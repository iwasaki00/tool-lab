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
import { MissionGuideManager, type MissionGuideDebugInfo, type MissionGuideMode } from "./MissionGuideManager";
import { ObjectiveManager } from "./ObjectiveManager";
import { MissionRuntime } from "./MissionRuntime";
import type { MissionResult, MissionRuntimeSnapshot } from "./MissionTypes";
import type { MissionDifficulty, MissionType } from "./MissionTypes";
import { CharacterManager, type CharacterManagerDebug } from "../characters/CharacterManager";
import type { NavigationManager } from "../navigation/NavigationManager";
import type { DiscoverySnapshot, GameMode } from "../game/GameTypes";
import { DiscoveryManager } from "../game/DiscoveryManager";

export interface GameplayCallbacks {
  onFocus: (focus?: InteractionFocus) => void;
  onMessage: (message: string) => void;
  onObjective: (objective: string) => void;
  onInventory: (items: InventoryEntry[]) => void;
  onMissionState: (state: MissionRuntimeSnapshot) => void;
  onMissionComplete: (result: MissionResult) => void;
  onPlayerCaught?: (id: string) => void;
  onDiscovery?: (snapshot: DiscoverySnapshot) => void;
}

export interface DemoScenario {
  interact: () => void;
  focus: () => InteractionFocus | undefined;
  inventory: () => InventoryEntry[];
  objective: () => string;
  navigation: () => InteriorNavigation | undefined;
  semanticLocation: () => SemanticLocation;
  worldStatistics: () => WorldStatistics;
  mission: () => { plan: MissionPlan; validation: MissionValidation; state: MissionRuntimeSnapshot };
  guideDebug: () => MissionGuideDebugInfo;
  setGuideMode: (mode: MissionGuideMode) => void;
  setDayMode: (isDay: boolean) => void;
  setDebugMode: (visible: boolean) => void;
  setEnemyAI: (enabled: boolean) => void;
  characterDebug: () => CharacterManagerDebug;
  setNavigationTest: (enabled: boolean) => void;
  setPaused: (paused: boolean) => void;
  discovery: () => DiscoverySnapshot;
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
  missionType: MissionType = "ACCESS_CONTROL",
  missionDifficulty: MissionDifficulty = "NORMAL",
  mobile = false,
  setPlayerInputEnabled: (enabled: boolean) => void = () => undefined,
  navigation?: NavigationManager,
  gameMode: GameMode = "ESCAPE",
): DemoScenario {
  const baseMeshes = new Set(ctx.scene.meshes);
  const baseMaterials = new Set(ctx.scene.materials);
  const baseLights = new Set(ctx.scene.lights);
  const baseAreaIds = new Set(registry.getAll().map((area) => area.id));
  const missionSitePlaceholder = registry.get("mission_site");
  const originalSiteStates = new Map(cityInteriorSites.map((site) => [site.id, { state: site.state, floorData: site.floorData }]));
  const interactions = new InteractionManager(ctx.scene, camera, callbacks.onFocus, 3);
  const inventory = new InventoryManager(callbacks.onInventory);
  const objectives = new ObjectiveManager(callbacks.onObjective, () => undefined);
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

  let plan!: MissionPlan; let validation!: MissionValidation;
  for (let retry = 0; retry < 10; retry += 1) {
    plan = new MissionGenerator(registry, placement, citySeed, missionSeed).generate(spawn, missionSite.id, missionType, missionDifficulty, retry);
    validation = validateMission(plan, registry);
    if (validation.valid) break;
    console.warn("MISSION VALIDATION RETRY", { retry: retry + 1, errors: validation.errors });
  }
  if (!validation.valid) throw new Error(`MISSION GENERATION FAILED: ${validation.errors.join(" / ")}`);
  let completionDelivered = false;
  const runtime = new MissionRuntime(plan, objectives, (state) => {
    callbacks.onMissionState(state);
    if (state.result && !completionDelivered) { completionDelivered = true; callbacks.onMissionComplete(state.result); }
  });
  const interiorManager = new InteriorManager(ctx, camera, [missionSite, ...cityInteriorSites], {
    interactions, inventory, events, objectives, onMessage: callbacks.onMessage, gateEventId: "OPEN_GATE_A", registry, placement, missionPlan: plan, missionRuntime: runtime, onNavigationChanged: () => navigation?.requestRebuild(),
  });

  const itemColors = { KEY: new Color3(.95, .68, .12), CARD_KEY: new Color3(.2, .72, .9), ITEM: new Color3(.72, .9, .3) };
  plan.items.forEach((item) => createItem(ctx, interactions, inventory, {
    id: item.id, itemId: item.itemId, displayName: item.displayName, position: toVector(item.placement.position), color: itemColors[item.kind], onMessage: callbacks.onMessage,
    onPickup: () => runtime.completeByTarget(item.id, `${item.displayName} acquired`),
  }));

  const goalPosition = toVector(plan.goal.position);
  const route = goalPosition.subtract(spawn); route.y = 0;
  if (route.lengthSquared() < 1) route.set(0, 0, 1); else route.normalize();
  const gatePosition = goalPosition.subtract(route.scale(4.5)); gatePosition.y = .12;
  const gateRotation = Math.atan2(route.x, route.z);
  let gateActivated = plan.interior.switchIds.length === 0;
  createMissionFrame(ctx, gatePosition, gateRotation, new Color3(.18, .28, .33));
  const perpendicular = new Vector3(route.z, 0, -route.x);
  const gateHinge = gatePosition.add(perpendicular.scale(1.4));
  const gate = createDoor(ctx, interactions, inventory, { id: "door_gate_001", displayName: "屋外ゲート", position: gateHinge, width: 2.8, rotation: gateRotation, color: new Color3(.16, .34, .42), interactable: false, onMessage: callbacks.onMessage });
  events.on("OPEN_GATE_A", () => { gateActivated = true; gate.open(); });
  if (gateActivated) gate.open();

  const characterCounts = createSemanticSpawnPoints(placement, registry, spawn, missionDifficulty, mobile, gameMode);
  placement.createDebugMarkers(ctx);
  const characters = new CharacterManager(ctx, camera, placement.getPlacements(), registry, interactions, objectives, callbacks.onMessage, setPlayerInputEnabled, navigation, (id) => callbacks.onPlayerCaught?.(id), characterCounts.enemyCount);
  const discovery = new DiscoveryManager(ctx.scene, camera, registry, gameMode === "EXPLORATION", (snapshot) => callbacks.onDiscovery?.(snapshot));
  createInspectables(ctx, interactions, missionPosition, callbacks.onMessage);
  const disposeGoal = createGoalZone(ctx, camera, { id: "goal_001", position: goalPosition, onEnter: () => gateActivated && runtime.completeByTarget("goal_001", "Goal reached") });
  const guide = new MissionGuideManager(ctx.scene, camera, registry, objectives, () => plan.steps, navigation);
  runtime.attachPositionTracking(ctx.scene, camera, registry);
  callbacks.onMissionState(runtime.snapshot());

  return {
    interact: () => interactions.interact(),
    focus: () => interactions.getDebugInfo(),
    inventory: () => inventory.entries(),
    objective: () => objectives.get(),
    navigation: () => interiorManager.navigation(),
    semanticLocation: () => registry.getLocationAt(camera.position),
    worldStatistics: () => registry.getStatistics(),
    mission: () => ({ plan, validation, state: runtime.snapshot() }),
    guideDebug: () => guide.getDebugInfo(),
    setGuideMode: (mode) => guide.setMode(mode),
    setDayMode: (isDay) => interiorManager.setDayMode(isDay),
    setDebugMode: (visible) => { placement.setDebugVisible(visible); characters.setDebugVisible(visible); },
    setEnemyAI: (enabled) => characters.setEnemyAI(enabled),
    characterDebug: () => characters.debugInfo(),
    setNavigationTest: (enabled) => characters.setNavigationTest(enabled),
    setPaused: (paused) => { characters.setPaused(paused); runtime.setPaused(paused); },
    discovery: () => discovery.snapshot(),
    dispose: () => {
      disposeGoal(); runtime.dispose(ctx.scene); discovery.dispose(ctx.scene); guide.dispose(); characters.dispose(); interiorManager.dispose(); interactions.dispose(); inventory.clear(); events.clear();
      ctx.scene.meshes.filter((mesh) => !baseMeshes.has(mesh)).forEach((mesh) => { if (!mesh.isDisposed()) mesh.dispose(false, false); });
      ctx.scene.materials.filter((material) => !baseMaterials.has(material)).forEach((material) => material.dispose());
      ctx.scene.lights.filter((light) => !baseLights.has(light)).forEach((light) => light.dispose());
      registry.getAll().filter((area) => !baseAreaIds.has(area.id)).forEach((area) => registry.remove(area.id));
      if (missionSitePlaceholder) registry.register(missionSitePlaceholder);
      cityInteriorSites.forEach((site) => { const original = originalSiteStates.get(site.id); if (original) { site.state = original.state; site.floorData = original.floorData; } });
    },
  };
}

function createSemanticSpawnPoints(placement: GamePlacementManager, registry: WorldRegistry, start: Vector3, difficulty: MissionDifficulty, mobile: boolean, gameMode: GameMode): { enemyCount: number; npcCount: number } {
  const enemyCount = gameMode === "EXPLORATION" ? 0 : gameMode === "STEALTH" ? (difficulty === "EASY" ? 2 : difficulty === "HARD" ? (mobile ? 6 : 8) : 5) : difficulty === "EASY" ? 0 : difficulty === "HARD" ? 4 : 2;
  const npcCount = gameMode === "EXPLORATION" ? (mobile ? 4 : 6) : mobile ? 2 : 3;
  for (let index = 0; index < enemyCount; index += 1) {
    const enemyArea = placement.chooseArea(["ALLEY", "STORAGE", "CORRIDOR", "ROAD"], ["danger", "dark", "dead_end"], start, 12);
    if (enemyArea) { const enemy = placement.place(`enemy_${index + 1}`, "ENEMY", enemyArea, .12); placement.registerSpawn(enemy); registry.connect(enemy.id, enemy.areaId); }
  }
  for (let index = 0; index < npcCount; index += 1) {
    const npcArea = placement.chooseArea(["PLAZA", "PARK", "SIDEWALK", "BUILDING_ENTRANCE", "OFFICE"], ["safe", "public", "bright"], start, 5);
    if (npcArea) { const npc = placement.place(`npc_${index + 1}`, "NPC", npcArea, .12); placement.registerSpawn(npc); registry.connect(npc.id, npc.areaId); }
  }
  return { enemyCount, npcCount };
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
