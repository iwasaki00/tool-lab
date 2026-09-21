import type { Engine } from "@babylonjs/core/Engines/engine";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { EventManager } from "../gameplay/EventManager";
import { FRAMEWORK_EVENT, type FrameworkEventMap, type MapStatusEvent, type NavigationStatusEvent } from "../contracts/FrameworkEvents";
import { createBoundaryWall, createBuilding, createStairs } from "../objects/building";
import { createGround, createLamp, createRoad } from "../objects/environment";
import { createBox, createCylinder, createPillar, createPlatform, createSphere, type ObjectContext } from "../objects/primitives";
import { createPlayer, type PlayerController } from "../player/createPlayer";
import { createMaterial } from "../utils/materials";
import { createCity } from "../world/cityGenerator";
import { WorldRegistry } from "../world/WorldRegistry";
import { createBounds } from "../world/SemanticTypes";
import type { CitySettings, WorldMode } from "../world/types";
import { VisualManager } from "../visual/VisualManager";

export interface FrameworkSceneBootstrapOptions {
  engine: Engine;
  canvas: HTMLCanvasElement;
  mobile: boolean;
  worldMode: WorldMode;
  citySettings: CitySettings;
  onMapStatus?: (event: MapStatusEvent) => void;
  onNavigationStatus?: (event: NavigationStatusEvent) => void;
}

export interface FrameworkSceneRuntime {
  scene: Scene;
  player: PlayerController;
  visuals: VisualManager;
  objectContext: ObjectContext;
  registry: WorldRegistry;
  events: EventManager<FrameworkEventMap>;
  dynamicRoots: Mesh[];
  groundMaterial: StandardMaterial;
  debugBox: Mesh;
  generatedCity?: ReturnType<typeof createCity>;
  missionSpawn: Vector3;
  dispose(): void;
}

export function createFrameworkScene(options: FrameworkSceneBootstrapOptions): FrameworkSceneRuntime {
  const { engine, canvas, mobile, worldMode, citySettings } = options;
  const scene = new Scene(engine);
  scene.clearColor = new Color4(.38, .65, .82, 1);
  scene.gravity = new Vector3(0, -.22, 0);
  scene.collisionsEnabled = true;
  const player = createPlayer(scene, canvas, mobile);
  const camera = player.camera;
  const visuals = new VisualManager(scene, camera, mobile, { environmentPreset: "CLEAR_DAY", quality: "AUTO" });
  const dynamicRoots: Mesh[] = [];
  const objectContext: ObjectContext = { scene, shadows: visuals.shadows, registerDynamic: (mesh) => dynamicRoots.push(mesh), materials: visuals.materials };
  const registry = new WorldRegistry();
  const events = new EventManager<FrameworkEventMap>();
  if (options.onMapStatus) events.on(FRAMEWORK_EVENT.MAP_STATUS_CHANGED, options.onMapStatus);
  if (options.onNavigationStatus) events.on(FRAMEWORK_EVENT.NAVIGATION_STATUS_CHANGED, options.onNavigationStatus);

  const ground = createGround(scene);
  ground.material = visuals.materials.getGroundMaterial();
  let generatedCity: ReturnType<typeof createCity> | undefined;
  if (worldMode === "city") {
    generatedCity = createCity({ scene, shadows: visuals.shadows, materials: visuals.materials }, citySettings, mobile, registry);
    visuals.setStreetLightMaterials(generatedCity.lampMaterials);
    camera.position.set(generatedCity.spawn.x, generatedCity.spawn.y, generatedCity.spawn.z);
    camera.rotation.set(0, 0, 0);
  } else {
    createFieldWorld(objectContext, registry, camera.position);
  }

  const debugBox = MeshBuilder.CreateBox("debug-red-box", { size: 3 }, scene);
  debugBox.position.set(0, 1.5, -4);
  debugBox.material = createMaterial(scene, "debug-red-material", new Color3(1, 0, 0));
  debugBox.isVisible = false;
  debugBox.isPickable = false;
  const groundMaterial = ground.material as StandardMaterial;
  const missionSpawn = camera.position.clone();

  return {
    scene, player, visuals, objectContext, registry, events, dynamicRoots, groundMaterial, debugBox, generatedCity, missionSpawn,
    dispose: () => { generatedCity?.dispose(); visuals.dispose(); events.clear(); },
  };
}

function createFieldWorld(ctx: ObjectContext, registry: WorldRegistry, spawn: Vector3): void {
  createRoad(ctx.scene, new Vector3(0, .035, 1), 7, 76);
  createRoad(ctx.scene, new Vector3(0, .04, 8), 5, 52, Math.PI / 2);
  registry.register({ id: "field_road_main", type: "ROAD", position: { x: 0, y: 0, z: 1 }, bounds: createBounds({ x: 0, y: 0, z: 1 }, 7, 76, 0, 3), connections: ["field_intersection"], tags: ["outdoor", "public", "wide"] });
  registry.register({ id: "field_road_cross", type: "ROAD", position: { x: 0, y: 0, z: 8 }, bounds: createBounds({ x: 0, y: 0, z: 8 }, 52, 5, 0, 3), connections: ["field_intersection"], tags: ["outdoor", "public", "wide"] });
  registry.register({ id: "field_intersection", type: "INTERSECTION", position: { x: 0, y: 0, z: 8 }, bounds: createBounds({ x: 0, y: 0, z: 8 }, 8, 8, 0, 3), connections: ["field_road_main", "field_road_cross"], tags: ["outdoor", "public", "safe", "wide"] });
  registry.register({ id: "start_area", type: "START", position: spawn, bounds: createBounds(spawn, 3, 3, 0, 4), connections: ["field_road_main"], tags: ["outdoor", "public", "safe", "spawn"], importance: 10 });
  [
    { position: new Vector3(-13, 0, 2), color: new Color3(.78, .42, .24), rotation: Math.PI / 2 },
    { position: new Vector3(13, 0, 4), color: new Color3(.24, .53, .62), rotation: -Math.PI / 2 },
    { position: new Vector3(-11, 0, 22), color: new Color3(.62, .55, .28), rotation: Math.PI / 2 },
  ].forEach((data) => createBuilding(ctx, data));
  createStairs(ctx, new Vector3(9, 0, 20), 7);
  createPlatform(ctx, new Vector3(9, .32, 25), 7, 6);
  [[6.2, 2.7, 22], [11.8, 2.7, 22], [6.2, 2.7, 27.5], [11.8, 2.7, 27.5]].forEach(([x, y, z]) => createPillar(ctx, new Vector3(x, y, z), 5.4));
  createBox(ctx, new Vector3(3, .8, 9), 1.6);
  createSphere(ctx, new Vector3(-3, .9, 10), 1.8);
  createCylinder(ctx, new Vector3(4, 1.25, 16), 2.5, 1.35);
  [-31, 31].forEach((x) => createBoundaryWall(ctx.scene, ctx.shadows, new Vector3(x, 1.4, 0), { width: .7, height: 2.8, depth: 63 }));
  [-31, 31].forEach((z) => createBoundaryWall(ctx.scene, ctx.shadows, new Vector3(0, 1.4, z), { width: 63, height: 2.8, depth: .7 }));
  for (let z = -22; z <= 26; z += 12) { createLamp(ctx.scene, ctx.shadows, new Vector3(-4.5, 0, z)); createLamp(ctx.scene, ctx.shadows, new Vector3(4.5, 0, z)); }
}
