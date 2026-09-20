import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { createBoundaryWall, createBuilding, createStairs } from "../objects/building";
import { createGround, createLamp, createRoad, createSky } from "../objects/environment";
import { createBox, createCylinder, createPillar, createPlatform, createSphere, type ObjectContext } from "../objects/primitives";
import { createPlayer, type PlayerController } from "../player/createPlayer";
import { createMaterial } from "../utils/materials";
import { createRandomScene, randomOpenPosition } from "./generators";
import { setStreetLightsEnabled } from "../objects/streetLight";
import { createCity } from "../world/cityGenerator";
import { DEFAULT_CITY_SETTINGS, type CitySettings, type CityStats, type WorldMode } from "../world/types";
import { createDemoScenario, type DemoScenario, type GameplayCallbacks } from "../gameplay/createDemoScenario";
import type { InteractionFocus } from "../interaction/Interactable";
import type { InventoryEntry } from "../gameplay/InventoryManager";
import type { InteriorNavigation } from "../interior/Room";
import { WorldRegistry } from "../world/WorldRegistry";
import { createBounds, type MapArea2D, type SemanticLocation, type WorldStatistics } from "../world/SemanticTypes";
import type { MissionPlan } from "../gameplay/MissionGenerator";
import type { MissionRuntimeSnapshot } from "../gameplay/MissionTypes";
import type { MissionValidation } from "../gameplay/MissionValidator";
import type { MissionGuideDebugInfo, MissionGuideMode } from "../gameplay/MissionGuideManager";
import type { CharacterManagerDebug } from "../characters/CharacterManager";
import { NavigationManager, type NavigationStats } from "../navigation/NavigationManager";
import type { DiscoverySnapshot, GameMode } from "../game/GameTypes";
import type { DebugCommand, DebugTestSnapshot } from "../debug/DebugTestManager";
import { WorldMapManager } from "../map/WorldMapManager";
import type { MapStateSnapshot, WorldMapData } from "../map/WorldMapData";

export interface LaboratoryApi {
  scene: Scene;
  player: PlayerController;
  setDayMode: (isDay: boolean) => void;
  addBox: () => void;
  addSphere: () => void;
  addBuilding: () => void;
  randomize: () => void;
  setDebugMode: (enabled: boolean) => void;
  objectCount: () => number;
  telemetry: () => { x: number; y: number; z: number; mode: "day" | "night"; worldMode: WorldMode; seed?: number; style?: string };
  cityStats: () => CityStats | undefined;
  disposeWorld: () => void;
  interact: () => void;
  interactionDebug: () => InteractionFocus | undefined;
  inventory: () => InventoryEntry[];
  objective: () => string;
  interiorDebug: () => InteriorNavigation | undefined;
  semanticDebug: () => SemanticLocation;
  worldStatistics: () => WorldStatistics;
  missionDebug: () => { plan: MissionPlan; validation: MissionValidation; state: MissionRuntimeSnapshot };
  semanticMap: (floor?: number) => MapArea2D[];
  setMissionGuideMode: (mode: MissionGuideMode) => void;
  missionGuideDebug: () => MissionGuideDebugInfo;
  restartMission: (settings: CitySettings) => void;
  setEnemyAI: (enabled: boolean) => void;
  characterDebug: () => CharacterManagerDebug;
  navigationDebug: () => NavigationStats;
  useNavigationFallback: (reason: string) => void;
  retryNavigation: () => void;
  debugTest: () => DebugTestSnapshot;
  debugCommand: (command: DebugCommand, value?: string | number) => void;
  debugJumpTo: (stepId: string) => void;
  setDebugSelectMode: (enabled: boolean) => void;
  setNoClip: (enabled: boolean) => void;
  debugEnemy: (command: Parameters<DemoScenario["debugEnemy"]>[0]) => void;
  debugDiscovery: (command: Parameters<DemoScenario["debugDiscovery"]>[0]) => void;
  setSimulationPaused: (paused: boolean) => void;
  setSimulationSpeed: (scale: number) => void;
  setNavigationTest: (enabled: boolean) => void;
  setPaused: (paused: boolean) => void;
  discovery: () => DiscoverySnapshot;
  mapState: () => MapStateSnapshot;
  saveMap: () => WorldMapData;
  createProceduralMap: (seed?: number, style?: string) => WorldMapData;
  loadMap: (data: unknown) => Promise<WorldMapData>;
  saveMapToBrowser: (name?: string) => WorldMapData;
  listBrowserMaps: () => ReturnType<WorldMapManager["listBrowserMaps"]>;
  loadMapFromBrowser: (id: string) => WorldMapData;
  deleteMapFromBrowser: (id: string) => void;
  setAutoExpansion: (enabled: boolean) => void;
  setChunkUnload: (enabled: boolean) => void;
  teleportNearChunkEdge: (direction: "north" | "south" | "east" | "west", cross?: boolean) => void;
}

export interface SceneOptions {
  worldMode?: WorldMode;
  citySettings?: CitySettings;
  gameplayCallbacks?: GameplayCallbacks;
  gameMode?: GameMode;
}

export function createLaboratoryScene(engine: Engine, canvas: HTMLCanvasElement, mobile: boolean, options: SceneOptions = {}): LaboratoryApi {
  const worldMode = options.worldMode ?? "field";
  const citySettings = options.citySettings ?? DEFAULT_CITY_SETTINGS;
  const scene = new Scene(engine);
  scene.clearColor = new Color4(.38, .65, .82, 1);
  scene.gravity = new Vector3(0, -.22, 0);
  scene.collisionsEnabled = true;
  const player = createPlayer(scene, canvas, mobile);
  const camera = player.camera;

  const ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
  ambient.intensity = .68;
  ambient.groundColor = new Color3(.17, .2, .22);
  const sun = new DirectionalLight("sun", new Vector3(-.55, -1, .35), scene);
  sun.position = new Vector3(25, 38, -25);
  sun.intensity = 1.15;
  const shadows = new ShadowGenerator(mobile ? 1024 : 2048, sun);
  shadows.useBlurExponentialShadowMap = true;
  shadows.blurKernel = 24;
  const skyMaterial = createSky(scene);
  let currentMode: "day" | "night" = "day";

  const dynamicRoots: Mesh[] = [];
  const registerDynamic = (mesh: Mesh) => dynamicRoots.push(mesh);
  const ctx: ObjectContext = { scene, shadows, registerDynamic };
  const registry = new WorldRegistry();

  const ground = createGround(scene);
  let generatedCity: ReturnType<typeof createCity> | undefined;
  if (worldMode === "city") {
    // 街本体はSceneの寿命で管理し、追加オブジェクト用のdynamicRootsとは分離する。
    // これにより既存の「ランダム配置」を使っても街全体が消えない。
    generatedCity = createCity({ scene, shadows }, citySettings, mobile, registry);
    camera.position.set(generatedCity.spawn.x, generatedCity.spawn.y, generatedCity.spawn.z);
    camera.rotation.set(0, 0, 0);
  } else {
    createRoad(scene, new Vector3(0, .035, 1), 7, 76);
    createRoad(scene, new Vector3(0, .04, 8), 5, 52, Math.PI / 2);
    registry.register({ id: "field_road_main", type: "ROAD", position: { x: 0, y: 0, z: 1 }, bounds: createBounds({ x: 0, y: 0, z: 1 }, 7, 76, 0, 3), connections: ["field_intersection"], tags: ["outdoor", "public", "wide"] });
    registry.register({ id: "field_road_cross", type: "ROAD", position: { x: 0, y: 0, z: 8 }, bounds: createBounds({ x: 0, y: 0, z: 8 }, 52, 5, 0, 3), connections: ["field_intersection"], tags: ["outdoor", "public", "wide"] });
    registry.register({ id: "field_intersection", type: "INTERSECTION", position: { x: 0, y: 0, z: 8 }, bounds: createBounds({ x: 0, y: 0, z: 8 }, 8, 8, 0, 3), connections: ["field_road_main", "field_road_cross"], tags: ["outdoor", "public", "safe", "wide"] });
    registry.register({ id: "start_area", type: "START", position: camera.position, bounds: createBounds(camera.position, 3, 3, 0, 4), connections: ["field_road_main"], tags: ["outdoor", "public", "safe", "spawn"], importance: 10 });
    createInitialField(ctx);
  }

  const debugBox = MeshBuilder.CreateBox("debug-red-box", { size: 3 }, scene);
  debugBox.position = new Vector3(0, 1.5, -4);
  debugBox.material = createMaterial(scene, "debug-red-material", new Color3(1, 0, 0));
  debugBox.isVisible = false;
  debugBox.isPickable = false;
  const groundMaterial = ground.material as StandardMaterial;
  const callbacks = options.gameplayCallbacks ?? {
    onFocus: () => undefined, onMessage: () => undefined, onObjective: () => undefined,
    onInventory: () => undefined, onMissionState: () => undefined, onMissionComplete: () => undefined,
  };
  const missionSpawn = camera.position.clone();
  let currentGuideMode: MissionGuideMode = "DEBUG";
  let currentEnemyAI = true;
  const navigation = new NavigationManager(scene, registry);
  const createMission = (settings: CitySettings) => createDemoScenario(ctx, camera, missionSpawn.clone(), callbacks, registry, generatedCity?.interiorSites, settings.seed, settings.missionSeed, settings.missionType, settings.missionDifficulty, mobile, (enabled) => player.setInputEnabled(enabled), navigation, options.gameMode ?? "ESCAPE");
  let demoScenario = createMission(citySettings);
  const worldMap = new WorldMapManager(ctx, registry, camera, citySettings.seed, citySettings.style, () => navigation.requestRebuild());

  const spawnAhead = (height: number): Vector3 => {
    const direction = camera.getForwardRay().direction.clone();
    direction.y = 0;
    direction.normalize();
    return camera.position.add(direction.scale(5)).set(camera.position.x + direction.x * 5, height, camera.position.z + direction.z * 5);
  };

  const setDayMode = (isDay: boolean) => {
    currentMode = isDay ? "day" : "night";
    if (generatedCity) setStreetLightsEnabled(generatedCity.lampMaterials, !isDay);
    demoScenario.setDayMode(isDay);
    if (isDay) {
      scene.clearColor = new Color4(.38, .65, .82, 1);
      skyMaterial.diffuseColor = new Color3(.34, .62, .82);
      skyMaterial.emissiveColor = new Color3(.34, .62, .82);
      ambient.intensity = .68;
      sun.intensity = 1.15;
    } else {
      scene.clearColor = new Color4(.025, .055, .11, 1);
      skyMaterial.diffuseColor = new Color3(.025, .055, .11);
      skyMaterial.emissiveColor = new Color3(.025, .055, .11);
      ambient.intensity = .27;
      sun.intensity = .18;
    }
  };

  return {
    scene,
    player,
    setDayMode,
    addBox: () => createBox(ctx, spawnAhead(.85), 1.7, true),
    addSphere: () => createSphere(ctx, spawnAhead(.85), 1.7, true),
    addBuilding: () => createBuilding(ctx, { position: randomOpenPosition(15, 27), width: 6.5, depth: 5.5, color: new Color3(.28, .58, .66), rotation: Math.random() * Math.PI * 2, dynamic: true }),
    randomize: () => createRandomScene(ctx, dynamicRoots),
    setDebugMode: (enabled) => {
      debugBox.isVisible = enabled;
      demoScenario.setDebugMode(enabled);
      navigation.setDebugVisible(enabled);
      worldMap.setDebugVisible(enabled);
      groundMaterial.diffuseColor = enabled ? new Color3(.12, .72, .22) : new Color3(.25, .34, .28);
      if (enabled) {
        skyMaterial.diffuseColor = new Color3(.12, .55, .95);
        skyMaterial.emissiveColor = new Color3(.12, .55, .95);
      } else {
        setDayMode(currentMode === "day");
      }
    },
    objectCount: () => scene.meshes.filter((mesh) => mesh.name !== "sky").length,
    telemetry: () => ({ x: camera.position.x, y: camera.position.y, z: camera.position.z, mode: currentMode, worldMode, seed: generatedCity?.stats.seed, style: generatedCity?.stats.styleLabel }),
    cityStats: () => generatedCity?.stats,
    disposeWorld: () => { demoScenario.dispose(); worldMap.dispose(); navigation.dispose(); generatedCity?.dispose(); },
    interact: () => demoScenario.interact(),
    interactionDebug: () => demoScenario.focus(),
    inventory: () => demoScenario.inventory(),
    objective: () => demoScenario.objective(),
    interiorDebug: () => demoScenario.navigation(),
    semanticDebug: () => demoScenario.semanticLocation(),
    worldStatistics: () => demoScenario.worldStatistics(),
    missionDebug: () => demoScenario.mission(),
    semanticMap: (floor) => registry.toMap2D(floor),
    setMissionGuideMode: (mode) => { currentGuideMode = mode; demoScenario.setGuideMode(mode); },
    missionGuideDebug: () => demoScenario.guideDebug(),
    setEnemyAI: (enabled) => { currentEnemyAI = enabled; demoScenario.setEnemyAI(enabled); },
    characterDebug: () => demoScenario.characterDebug(),
    navigationDebug: () => navigation.stats(),
    useNavigationFallback: (reason) => navigation.activateFallback(reason),
    retryNavigation: () => navigation.retry(),
    debugTest: () => demoScenario.debugTest(),
    debugCommand: (command, value) => demoScenario.debugCommand(command, value),
    debugJumpTo: (stepId) => demoScenario.debugJumpTo(stepId),
    setDebugSelectMode: (enabled) => demoScenario.setDebugSelectMode(enabled),
    setNoClip: (enabled) => player.setNoClip(enabled),
    debugEnemy: (command) => demoScenario.debugEnemy(command),
    debugDiscovery: (command) => demoScenario.debugDiscovery(command),
    setSimulationPaused: (paused) => demoScenario.setPaused(paused),
    setSimulationSpeed: (scale) => { scene.animationTimeScale = scale; demoScenario.setSimulationSpeed(scale); },
    setNavigationTest: (enabled) => demoScenario.setNavigationTest(enabled),
    setPaused: (paused) => { player.setInputEnabled(!paused); demoScenario.setPaused(paused); },
    discovery: () => demoScenario.discovery(),
    mapState: () => worldMap.snapshot(),
    saveMap: () => worldMap.saveMap(),
    createProceduralMap: (seed, style) => worldMap.createProceduralMap(seed, style),
    loadMap: (data) => worldMap.loadMap(data),
    saveMapToBrowser: (name) => worldMap.saveToBrowser(name),
    listBrowserMaps: () => worldMap.listBrowserMaps(),
    loadMapFromBrowser: (id) => worldMap.loadFromBrowser(id),
    deleteMapFromBrowser: (id) => worldMap.deleteFromBrowser(id),
    setAutoExpansion: (enabled) => worldMap.setAutoExpansion(enabled),
    setChunkUnload: (enabled) => worldMap.setChunkUnload(enabled),
    teleportNearChunkEdge: (direction, cross) => worldMap.teleportNearChunkEdge(direction, cross),
    restartMission: (settings) => {
      demoScenario.dispose();
      camera.position.copyFrom(missionSpawn); camera.cameraDirection.setAll(0); camera.cameraRotation.setAll(0);
      demoScenario = createMission(settings); demoScenario.setGuideMode(currentGuideMode); demoScenario.setDayMode(currentMode === "day"); demoScenario.setEnemyAI(currentEnemyAI);
    },
  };
}

function createInitialField(ctx: ObjectContext): void {
  const buildingData = [
    { position: new Vector3(-13, 0, 2), color: new Color3(.78, .42, .24), rotation: Math.PI / 2 },
    { position: new Vector3(13, 0, 4), color: new Color3(.24, .53, .62), rotation: -Math.PI / 2 },
    { position: new Vector3(-11, 0, 22), color: new Color3(.62, .55, .28), rotation: Math.PI / 2 },
  ];
  buildingData.forEach((data) => createBuilding(ctx, data));
  createStairs(ctx, new Vector3(9, 0, 20), 7);
  createPlatform(ctx, new Vector3(9, .32, 25), 7, 6);
  [[6.2, 2.7, 22], [11.8, 2.7, 22], [6.2, 2.7, 27.5], [11.8, 2.7, 27.5]].forEach(([x,y,z]) => createPillar(ctx, new Vector3(x,y,z), 5.4));
  createBox(ctx, new Vector3(3, .8, 9), 1.6);
  createSphere(ctx, new Vector3(-3, .9, 10), 1.8);
  createCylinder(ctx, new Vector3(4, 1.25, 16), 2.5, 1.35);
  [-31, 31].forEach((x) => createBoundaryWall(ctx.scene, ctx.shadows, new Vector3(x, 1.4, 0), { width: .7, height: 2.8, depth: 63 }));
  [-31, 31].forEach((z) => createBoundaryWall(ctx.scene, ctx.shadows, new Vector3(0, 1.4, z), { width: 63, height: 2.8, depth: .7 }));
  for (let z = -22; z <= 26; z += 12) {
    createLamp(ctx.scene, ctx.shadows, new Vector3(-4.5, 0, z));
    createLamp(ctx.scene, ctx.shadows, new Vector3(4.5, 0, z));
  }
}
