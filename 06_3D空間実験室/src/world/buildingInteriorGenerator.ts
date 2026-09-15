import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { EventManager } from "../gameplay/EventManager";
import type { InventoryManager } from "../gameplay/InventoryManager";
import type { ObjectiveManager } from "../gameplay/ObjectiveManager";
import { createRoomFurniture } from "../furniture/createFurniture";
import type { InteractionManager } from "../interaction/InteractionManager";
import { createDoor } from "../objects/interactiveDoor";
import { createItem } from "../objects/interactiveItem";
import { createSwitch } from "../objects/interactiveSwitch";
import type { ObjectContext } from "../objects/primitives";
import { SeededRandom } from "../random/seededRandom";
import { createMaterial } from "../utils/materials";
import type { FloorData, InteriorBuildingSite, LocalBounds, RoomData, RoomType } from "../interior/Room";
import type { GamePlacementManager } from "../gameplay/GamePlacementManager";
import type { WorldRegistry } from "./WorldRegistry";
import { createBounds, type AreaTag, type AreaType, type WorldBounds } from "./SemanticTypes";
import type { MissionPlan } from "../gameplay/MissionTypes";
import type { MissionRuntime } from "../gameplay/MissionRuntime";

export interface InteriorGenerationDeps {
  interactions: InteractionManager;
  inventory: InventoryManager;
  events: EventManager;
  objectives: ObjectiveManager;
  onMessage: (message: string) => void;
  gateEventId: string;
  registry: WorldRegistry;
  placement: GamePlacementManager;
  missionPlan: MissionPlan;
  missionRuntime: MissionRuntime;
}

export interface GeneratedInteriorResources {
  floorData: FloorData[];
  lights: PointLight[];
  lightMaterials: StandardMaterial[];
}

export function createBuildingInterior(ctx: ObjectContext, site: InteriorBuildingSite, deps: InteriorGenerationDeps): GeneratedInteriorResources {
  site.root.computeWorldMatrix(true);
  const random = new SeededRandom(site.seed);
  const floors = Math.max(1, Math.min(site.floors, 3));
  const corridorWidth = 2.2;
  const wallMaterial = createMaterial(ctx.scene, `${site.id}-interior-wall`, new Color3(.58, .57, .53));
  const floorMaterial = createMaterial(ctx.scene, `${site.id}-interior-floor`, new Color3(.32, .31, .29));
  const ceilingMaterial = createMaterial(ctx.scene, `${site.id}-interior-ceiling`, new Color3(.72, .72, .68));
  const floorData: FloorData[] = [];
  const lights: PointLight[] = [];
  const lightMaterials: StandardMaterial[] = [];
  const windowMaterial = createMaterial(ctx.scene, `${site.id}-interior-window`, new Color3(.38, .62, .72), .55);
  windowMaterial.emissiveColor = new Color3(.12, .18, .2); lightMaterials.push(windowMaterial);
  const rowCount = site.depth >= 13 ? 2 : 1;
  const usableDepth = site.depth - .6;
  const rowDepth = usableDepth / rowCount;

  for (let floor = 0; floor < floors; floor += 1) {
    const floorY = floor * site.floorHeight;
    createFloor(ctx, site, floor, floorY, floorMaterial, corridorWidth);
    if (floor === floors - 1) createSlab(ctx, site.root, "interior-ceiling", site.width - .35, site.depth - .35, .14, 0, floorY + site.floorHeight - .08, 0, ceilingMaterial, true);

    const rooms: RoomData[] = [];
    const doorCenters: number[] = [];
    for (let row = 0; row < rowCount; row += 1) {
      const minZ = -site.depth / 2 + .3 + row * rowDepth;
      const maxZ = minZ + rowDepth;
      const doorZ = (minZ + maxZ) / 2;
      doorCenters.push(doorZ);
      for (const side of [-1, 1]) {
        const roomIndex = rooms.length + 1;
        const isStairRoom = floors > 1 && row === rowCount - 1 && side < 0;
        const type = isStairRoom ? "EMPTY" : chooseRoomType(random, site.mission, floor, row, side, floors, rowCount);
        const room: RoomData = {
          id: `${site.id}_room_${String(floor + 1).padStart(2, "0")}_${String(roomIndex).padStart(2, "0")}`,
          type,
          floor: floor + 1,
          bounds: side < 0
            ? { minX: -site.width / 2 + .3, maxX: -corridorWidth / 2, minZ, maxZ }
            : { minX: corridorWidth / 2, maxX: site.width / 2 - .3, minZ, maxZ },
          doors: [], connections: [`${site.id}_corridor_${floor + 1}`],
        };
        const doorId = `${site.id}_door_${floor + 1}_${roomIndex}`;
        room.doors.push(doorId);
        const lockedControlDoor = site.mission && type === "CONTROL_ROOM" && Boolean(deps.missionPlan.interior.controlDoorCredential);
        const hingeX = side * corridorWidth / 2;
        createDoor(ctx, deps.interactions, deps.inventory, {
          id: doorId, displayName: `${type} ドア`, parent: site.root,
          position: new Vector3(hingeX, floorY, doorZ - .65), width: 1.3, height: 2.8,
          rotation: Math.PI / 2, locked: lockedControlDoor, keyId: lockedControlDoor ? deps.missionPlan.interior.controlDoorCredential : undefined,
          color: new Color3(.36, .29, .21), onMessage: deps.onMessage,
          onOpened: site.mission && type === "CONTROL_ROOM" ? () => deps.missionRuntime.completeByTarget(doorId, "Control Room reached") : undefined,
        });
        const doorWorld = Vector3.TransformCoordinates(new Vector3(hingeX, floorY + 1.4, doorZ), site.root.getWorldMatrix());
        deps.registry.register({ id: doorId, type: "DOOR", position: doorWorld, bounds: createBounds(doorWorld, 1.8, 1.2, floorY, floorY + 3), floor: floor + 1, buildingId: site.id, roomId: room.id, connections: [room.id, `${site.id}_corridor_${floor + 1}`], tags: ["indoor", "private", ...(lockedControlDoor ? ["mission" as const] : [])], importance: lockedControlDoor ? 9 : 3, metadata: { locked: Boolean(lockedControlDoor) } });
        rooms.push(room);
        if (!isStairRoom) createRoomFurniture(ctx, site.root, room.id, type, room.bounds, floorY, random);
        const innerWindow = MeshBuilder.CreateBox("interior-window", { width: .07, height: 1, depth: Math.min(1.35, rowDepth * .42) }, ctx.scene);
        innerWindow.position.set(side * (site.width / 2 - .16), floorY + 1.45, doorZ); innerWindow.parent = site.root; innerWindow.material = windowMaterial; innerWindow.isPickable = false;
      }
    }
    createCorridorWalls(ctx, site, floorY, corridorWidth, doorCenters, wallMaterial);
    if (floor < floors - 1) createStaircase(ctx, site, floorY, floorMaterial, corridorWidth);
    const corridor: LocalBounds = { minX: -corridorWidth / 2, maxX: corridorWidth / 2, minZ: -site.depth / 2 + .3, maxZ: site.depth / 2 - .3 };
    const stairLayout = getStairLayout(site, corridorWidth);
    floorData.push({ floor: floor + 1, corridor, rooms, staircase: floor < floors - 1 ? { minX: stairLayout.openingMinX, maxX: stairLayout.openingMaxX, minZ: stairLayout.startZ, maxZ: stairLayout.endZ } : undefined });
    const lampMaterial = createMaterial(ctx.scene, `${site.id}-ceiling-light-${floor + 1}`, new Color3(.82, .78, .58), .6);
    lampMaterial.emissiveColor = new Color3(.25, .22, .12); lightMaterials.push(lampMaterial);
    const panel = MeshBuilder.CreateBox("interior-light-panel", { width: 1.5, height: .06, depth: .55 }, ctx.scene);
    panel.position.set(0, floorY + site.floorHeight - .16, 0); panel.parent = site.root; panel.material = lampMaterial;
    const light = new PointLight(`${site.id}-light-${floor + 1}`, new Vector3(0, floorY + 2.25, 0), ctx.scene);
    light.parent = site.root; light.diffuse = new Color3(1, .86, .62); light.intensity = .34; light.range = Math.max(site.width, site.depth) * .7; lights.push(light);
  }

  registerInteriorSemantics(site, floorData, deps.registry);
  if (site.mission) createMissionContents(ctx, site, deps);
  site.floorData = floorData;
  site.state = "GENERATED";
  return { floorData, lights, lightMaterials };
}

interface StairLayout {
  centerX: number;
  openingMinX: number;
  openingMaxX: number;
  startZ: number;
  endZ: number;
  run: number;
}

function getStairLayout(site: InteriorBuildingSite, corridorWidth: number): StairLayout {
  const stairWidth = 1.8;
  const openingWidth = 2.2;
  const rowCount = site.depth >= 13 ? 2 : 1;
  const rearDoorZ = rowCount === 2 ? site.depth / 4 - .15 : 0;
  const floorMaxZ = site.depth / 2 - .3;
  const landingDepth = site.depth >= 13 ? 1.15 : .95;
  const startZ = rearDoorZ + .12;
  const run = Math.max(2.55, Math.min(3.8, floorMaxZ - startZ - landingDepth));
  const centerX = -corridorWidth / 2 - stairWidth / 2 - .22;
  return {
    centerX,
    openingMinX: centerX - openingWidth / 2,
    openingMaxX: centerX + openingWidth / 2,
    startZ: startZ - .2,
    endZ: startZ + run + .08,
    run,
  };
}

function createFloor(ctx: ObjectContext, site: InteriorBuildingSite, floor: number, y: number, material: StandardMaterial, corridorWidth: number): void {
  if (floor === 0) { createSlab(ctx, site.root, "interior-floor", site.width - .35, site.depth - .35, .16, 0, y + .08, 0, material, true); return; }
  const layout = getStairLayout(site, corridorWidth);
  const minX = -site.width / 2 + .175;
  const maxX = site.width / 2 - .175;
  const minZ = -site.depth / 2 + .175;
  const maxZ = site.depth / 2 - .175;
  createFloorRect(ctx, site, "upper-floor-left", minX, layout.openingMinX, minZ, maxZ, y, material);
  createFloorRect(ctx, site, "upper-floor-right", layout.openingMaxX, maxX, minZ, maxZ, y, material);
  createFloorRect(ctx, site, "upper-floor-front", layout.openingMinX, layout.openingMaxX, minZ, layout.startZ, y, material);
  createFloorRect(ctx, site, "upper-floor-landing", layout.openingMinX, layout.openingMaxX, layout.endZ, maxZ, y, material);
}

function createFloorRect(ctx: ObjectContext, site: InteriorBuildingSite, name: string, minX: number, maxX: number, minZ: number, maxZ: number, y: number, material: StandardMaterial): void {
  const width = maxX - minX;
  const depth = maxZ - minZ;
  if (width <= .05 || depth <= .05) return;
  createSlab(ctx, site.root, name, width, depth, .16, (minX + maxX) / 2, y, (minZ + maxZ) / 2, material, true);
}

function createCorridorWalls(ctx: ObjectContext, site: InteriorBuildingSite, floorY: number, corridorWidth: number, doorCenters: number[], material: StandardMaterial): void {
  const doorHalf = .72;
  const wallHeight = site.floorHeight - .18;
  for (const side of [-1, 1]) {
    const boundaries = [-site.depth / 2 + .3, ...doorCenters.flatMap((center) => [center - doorHalf, center + doorHalf]), site.depth / 2 - .3];
    for (let i = 0; i < boundaries.length - 1; i += 2) {
      const start = boundaries[i]; const end = boundaries[i + 1];
      if (end - start <= .05) continue;
      createSlab(ctx, site.root, "interior-wall", .16, end - start, wallHeight, side * corridorWidth / 2, floorY + wallHeight / 2, (start + end) / 2, material, true);
    }
  }
}

export function createStaircase(ctx: ObjectContext, site: InteriorBuildingSite, floorY: number, material: StandardMaterial, corridorWidth = 2.2): void {
  const layout = getStairLayout(site, corridorWidth);
  const run = layout.run;
  const rise = site.floorHeight;
  const stairStartZ = layout.startZ + .2;
  const stepCount = 10;
  const steps: Mesh[] = [];
  for (let i = 0; i < stepCount; i += 1) {
    const step = MeshBuilder.CreateBox("stair-step-part", { width: 1.8, height: .16, depth: run / stepCount + .03 }, ctx.scene);
    step.position.set(layout.centerX, floorY + (i + 1) * rise / stepCount, stairStartZ + (i + .5) * run / stepCount); step.material = material; steps.push(step);
  }
  const merged = Mesh.MergeMeshes(steps, true, true, undefined, false, true);
  if (merged) { merged.name = `${site.id}-stairs`; merged.parent = site.root; merged.checkCollisions = false; }
  const slope = MeshBuilder.CreateBox(`${site.id}-stair-collider`, { width: 1.75, height: .12, depth: Math.hypot(run, rise) }, ctx.scene);
  slope.position.set(layout.centerX, floorY + rise / 2, stairStartZ + run / 2); slope.rotation.x = -Math.atan2(rise, run); slope.parent = site.root; slope.checkCollisions = true;
  const invisible = createMaterial(ctx.scene, `${site.id}-stair-collider-material`, Color3.Black()); invisible.alpha = 0; slope.material = invisible; slope.visibility = .01;
}

function createMissionContents(ctx: ObjectContext, site: InteriorBuildingSite, deps: InteriorGenerationDeps): void {
  const controlArea = deps.placement.chooseArea(["CONTROL_ROOM"], ["high_floor", "private"], undefined, 0, site.id);
  const controlDoorId = controlArea?.metadata?.doorId;
  if (!controlArea) return;
  if (deps.missionPlan.interior.itemIds.includes(`${site.id}_item_card_001`)) {
    const upperRooms = deps.registry.getAreasOnFloor(2, site.id).filter((area) => ["STORAGE", "OFFICE", "ROOM"].includes(area.type));
    const cardArea = upperRooms[0] ?? deps.placement.chooseArea(["STORAGE", "OFFICE", "ROOM"], ["high_floor", "private"], undefined, 0, site.id);
    if (cardArea) {
      const card = deps.placement.place(`${site.id}_item_card_001`, "CARD_KEY", cardArea, .48); deps.placement.registerSpawn(card);
      createItem(ctx, deps.interactions, deps.inventory, { id: card.id, itemId: "card_key", displayName: "カードキー", position: new Vector3(card.position.x, card.position.y, card.position.z), color: new Color3(.2, .72, .9), onMessage: deps.onMessage, onPickup: () => deps.missionRuntime.completeByTarget(card.id, "Card key acquired") });
    }
  }
  deps.missionPlan.interior.switchIds.forEach((id, index) => {
    const switchPosition = new Vector3(controlArea.position.x + (index === 0 ? -1 : 1), controlArea.bounds.minY + .9, controlArea.position.z);
    deps.registry.register({ id, type: "SWITCH", position: switchPosition, bounds: createBounds(switchPosition, 1.2, 1.2, switchPosition.y - .5, switchPosition.y + 1.5), floor: controlArea.floor, buildingId: site.id, roomId: controlArea.roomId, connections: [controlArea.id], tags: ["indoor", "private", "mission"], importance: 10 });
    createSwitch(ctx, deps.interactions, deps.events, { id, position: switchPosition, eventId: deps.gateEventId, emitEvent: false, onMessage: deps.onMessage, onActivate: () => {
      deps.missionRuntime.completeByTarget(id, `Switch ${index + 1} activated`);
      if (deps.missionPlan.interior.switchIds.every((switchId) => !deps.missionRuntime.isTargetActive(switchId))) deps.events.emit(deps.gateEventId);
    } });
  });
  if (typeof controlDoorId === "string") deps.registry.get(controlDoorId)!.metadata = { ...deps.registry.get(controlDoorId)!.metadata, credential: deps.missionPlan.interior.controlDoorCredential ?? "none" };
  deps.placement.createDebugMarkers(ctx);
}

function chooseRoomType(random: SeededRandom, mission: boolean | undefined, floor: number, row: number, side: number, floors: number, rowCount: number): RoomType {
  if (mission && floor === 0 && row === 0 && side < 0) return "STORAGE";
  if (mission && floor === floors - 1 && row === rowCount - 1 && side > 0) return "CONTROL_ROOM";
  return random.pick(["EMPTY", "OFFICE", "STORAGE", "LIVING_ROOM"] as const);
}

function centerOf(bounds: LocalBounds, y: number): Vector3 { return new Vector3((bounds.minX + bounds.maxX) / 2, y, (bounds.minZ + bounds.maxZ) / 2); }

function registerInteriorSemantics(site: InteriorBuildingSite, floors: FloorData[], registry: WorldRegistry): void {
  site.root.computeWorldMatrix(true);
  floors.forEach((floorData, index) => {
    const floorY = index * site.floorHeight;
    const corridorId = `${site.id}_corridor_${floorData.floor}`;
    const highFloor = index === floors.length - 1;
    registry.register({ id: corridorId, type: "CORRIDOR", position: worldCenter(site, floorData.corridor, floorY), bounds: worldBounds(site, floorData.corridor, floorY, floorY + site.floorHeight), floor: floorData.floor, buildingId: site.id, connections: floorData.rooms.map((room) => room.id), tags: ["indoor", "public", "narrow", ...(index === 0 ? ["ground_floor" as const] : []), ...(highFloor ? ["high_floor" as const] : [])], importance: highFloor ? 5 : 2 });
    floorData.rooms.forEach((room) => {
      const tags: AreaTag[] = ["indoor", "private", "room", "dead_end", ...(index === 0 ? ["ground_floor" as const] : []), ...(highFloor ? ["high_floor" as const] : [])];
      if (room.type === "STORAGE") tags.push("dark", "danger"); else tags.push("bright");
      const type = room.type === "EMPTY" ? "ROOM" : room.type as AreaType;
      registry.register({ id: room.id, type, position: worldCenter(site, room.bounds, floorY), bounds: worldBounds(site, room.bounds, floorY, floorY + site.floorHeight), floor: room.floor, buildingId: site.id, roomId: room.id, connections: [corridorId], tags, importance: room.type === "CONTROL_ROOM" ? 9 : highFloor ? 5 : 3, metadata: { doorId: room.doors[0] ?? "" } });
      registry.connect(room.id, corridorId);
    });
    if (floorData.staircase) {
      const stairId = `${site.id}_stair_${floorData.floor}`;
      registry.register({ id: stairId, type: "STAIR", position: worldCenter(site, floorData.staircase, floorY), bounds: worldBounds(site, floorData.staircase, floorY, floorY + site.floorHeight), floor: floorData.floor, buildingId: site.id, connections: [corridorId, `${site.id}_corridor_${floorData.floor + 1}`], tags: ["indoor", "public"], importance: 5 });
      registry.connect(stairId, corridorId);
    }
  });
  floors.slice(0, -1).forEach((floor) => registry.connect(`${site.id}_stair_${floor.floor}`, `${site.id}_corridor_${floor.floor + 1}`));
  registry.connect(`${site.id}_entrance_001`, `${site.id}_corridor_1`);
  const roofY = floors.length * site.floorHeight;
  registry.register({ id: `${site.id}_rooftop`, type: "ROOFTOP", position: { x: site.root.position.x, y: roofY, z: site.root.position.z }, bounds: createBounds({ x: site.root.position.x, y: roofY, z: site.root.position.z }, site.width, site.depth, roofY - .2, roofY + 2), floor: floors.length + 1, buildingId: site.id, connections: [], tags: ["outdoor", "private", "high_floor"], importance: 7 });
}

function worldCenter(site: InteriorBuildingSite, bounds: LocalBounds, y: number): Vector3 { return Vector3.TransformCoordinates(centerOf(bounds, y + .2), site.root.getWorldMatrix()); }
function worldBounds(site: InteriorBuildingSite, bounds: LocalBounds, minY: number, maxY: number): WorldBounds {
  const corners = [[bounds.minX, bounds.minZ], [bounds.minX, bounds.maxZ], [bounds.maxX, bounds.minZ], [bounds.maxX, bounds.maxZ]].map(([x, z]) => Vector3.TransformCoordinates(new Vector3(x, 0, z), site.root.getWorldMatrix()));
  return { minX: Math.min(...corners.map((p) => p.x)), maxX: Math.max(...corners.map((p) => p.x)), minY: site.root.position.y + minY, maxY: site.root.position.y + maxY, minZ: Math.min(...corners.map((p) => p.z)), maxZ: Math.max(...corners.map((p) => p.z)) };
}

function createSlab(ctx: ObjectContext, root: Mesh, name: string, width: number, depth: number, height: number, x: number, y: number, z: number, material: StandardMaterial, collision: boolean): Mesh {
  const mesh = MeshBuilder.CreateBox(name, { width, depth, height }, ctx.scene);
  mesh.position.set(x, y, z); mesh.parent = root; mesh.material = material; mesh.checkCollisions = collision; mesh.receiveShadows = true;
  return mesh;
}
