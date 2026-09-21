import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { createBuilding } from "../objects/building";
import { createBox, createSphere } from "../objects/primitives";
import { createRandomScene, randomOpenPosition } from "./generators";
import { DEFAULT_CITY_SETTINGS, type CitySettings, type WorldMode } from "../world/types";
import type { GameplayCallbacks, LaboratoryScenario, ScenarioFactory, ScenarioPolicy } from "../contracts/ScenarioContracts";
import type { MissionGuideMode } from "../gameplay/MissionGuideManager";
import type { MapStatusEvent, NavigationStatusEvent } from "../contracts/FrameworkEvents";
import { createFrameworkScene } from "./FrameworkSceneBootstrap";
import { laboratoryFeatureInitializer } from "../features/LaboratoryFeatureInitializer";
import { createEmbeddedFrameworkApi } from "../framework/internal/createEmbeddedFrameworkApi";
import type { LaboratoryApi } from "../compatibility/LaboratoryApi";

export type { LaboratoryApi } from "../compatibility/LaboratoryApi";

export interface SceneOptions {
  worldMode?: WorldMode;
  citySettings?: CitySettings;
  gameplayCallbacks?: GameplayCallbacks;
  scenarioPolicy?: ScenarioPolicy;
  scenarioFactory?: ScenarioFactory;
  onMapStatus?: (event: MapStatusEvent) => void;
  onNavigationStatus?: (event: NavigationStatusEvent) => void;
}

export function createLaboratoryScene(engine: Engine, canvas: HTMLCanvasElement, mobile: boolean, options: SceneOptions = {}): LaboratoryApi {
  const worldMode = options.worldMode ?? "field";
  const citySettings = options.citySettings ?? DEFAULT_CITY_SETTINGS;
  if (!options.scenarioFactory) throw new Error("SCENARIO FACTORY REQUIRED: compose a game/sample scenario outside the framework scene.");
  const base = createFrameworkScene({ engine, canvas, mobile, worldMode, citySettings, onMapStatus: options.onMapStatus, onNavigationStatus: options.onNavigationStatus });
  const { scene, player, visuals, objectContext: ctx, registry, dynamicRoots, groundMaterial, debugBox, generatedCity } = base;
  const camera = player.camera;
  let currentMode: "day" | "night" = "day";
  const callbacks = options.gameplayCallbacks ?? {
    onFocus: () => undefined, onMessage: () => undefined, onObjective: () => undefined,
    onInventory: () => undefined, onMissionState: () => undefined, onMissionComplete: () => undefined,
  };
  let currentGuideMode: MissionGuideMode = "DEBUG";
  let currentEnemyAI = true;
  const features = laboratoryFeatureInitializer.initialize({ base, mobile, citySettings, callbacks, scenarioFactory: options.scenarioFactory, scenarioPolicy: options.scenarioPolicy });
  const { navigation, worldMap, framework } = features;
  let demoScenario: LaboratoryScenario = features.scenario;
  const publicApi = createEmbeddedFrameworkApi({
    context: framework,
    restart: (restartOptions) => {
      const settings = { ...citySettings, ...restartOptions?.city };
      demoScenario = features.restartScenario(settings);
      demoScenario.setGuideMode(currentGuideMode);
      demoScenario.setEnemyAI(currentEnemyAI);
    },
    dispose: () => { features.dispose(); base.dispose(); },
  });

  const spawnAhead = (height: number): Vector3 => {
    const direction = camera.getForwardRay().direction.clone();
    direction.y = 0;
    direction.normalize();
    return camera.position.add(direction.scale(5)).set(camera.position.x + direction.x * 5, height, camera.position.z + direction.z * 5);
  };

  const setDayMode = (isDay: boolean) => {
    currentMode = isDay ? "day" : "night";
    demoScenario.setDayMode(isDay);
    visuals.setEnvironmentPreset(isDay ? "CLEAR_DAY" : "NIGHT");
  };

  return {
    api: publicApi,
    framework,
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
      if (!enabled) setDayMode(currentMode === "day");
    },
    objectCount: () => scene.meshes.filter((mesh) => mesh.name !== "sky").length,
    telemetry: () => ({ x: camera.position.x, y: camera.position.y, z: camera.position.z, mode: currentMode, worldMode, seed: generatedCity?.stats.seed, style: generatedCity?.stats.styleLabel }),
    cityStats: () => generatedCity?.stats,
    disposeWorld: () => publicApi.dispose(),
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
    visualState: () => visuals.state(),
    setEnvironmentPreset: (preset) => { currentMode = preset === "NIGHT" ? "night" : "day"; visuals.setEnvironmentPreset(preset); demoScenario.setDayMode(preset !== "NIGHT"); },
    setVisualQuality: (quality) => visuals.setQuality(quality),
    setVisualDebug: (kind, enabled) => visuals.setDebugView(kind, enabled),
    restartMission: (settings) => {
      demoScenario = features.restartScenario(settings); demoScenario.setGuideMode(currentGuideMode); demoScenario.setDayMode(currentMode === "day"); demoScenario.setEnemyAI(currentEnemyAI);
    },
  };
}
