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

export interface InteriorGenerationDeps {
  interactions: InteractionManager;
  inventory: InventoryManager;
  events: EventManager;
  objectives: ObjectiveManager;
  onMessage: (message: string) => void;
  gateEventId: string;
}

export interface GeneratedInteriorResources {
  floorData: FloorData[];
  lights: PointLight[];
  lightMaterials: StandardMaterial[];
}

export function createBuildingInterior(ctx: ObjectContext, site: InteriorBuildingSite, deps: InteriorGenerationDeps): GeneratedInteriorResources {
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
    createFloor(ctx, site, floor, floorY, floorMaterial);
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
        const type = chooseRoomType(random, site.mission, floor, row, side, floors);
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
        const lockedControlDoor = site.mission && type === "CONTROL_ROOM";
        const hingeX = side * corridorWidth / 2;
        createDoor(ctx, deps.interactions, deps.inventory, {
          id: doorId, displayName: `${type} ドア`, parent: site.root,
          position: new Vector3(hingeX, floorY, doorZ - .65), width: 1.3, height: 2.25,
          rotation: Math.PI / 2, locked: lockedControlDoor, keyId: lockedControlDoor ? "card_key" : undefined,
          color: new Color3(.36, .29, .21), onMessage: deps.onMessage,
          onOpened: lockedControlDoor ? () => deps.objectives.set("CONTROL ROOMのスイッチを起動する") : undefined,
        });
        rooms.push(room);
        createRoomFurniture(ctx, site.root, room.id, type, room.bounds, floorY, random);
        const innerWindow = MeshBuilder.CreateBox("interior-window", { width: .07, height: 1, depth: Math.min(1.35, rowDepth * .42) }, ctx.scene);
        innerWindow.position.set(side * (site.width / 2 - .16), floorY + 1.45, doorZ); innerWindow.parent = site.root; innerWindow.material = windowMaterial; innerWindow.isPickable = false;
      }
    }
    createCorridorWalls(ctx, site, floorY, corridorWidth, doorCenters, wallMaterial);
    if (floor < floors - 1) createStaircase(ctx, site, floorY, floorMaterial);
    const corridor: LocalBounds = { minX: -corridorWidth / 2, maxX: corridorWidth / 2, minZ: -site.depth / 2 + .3, maxZ: site.depth / 2 - .3 };
    floorData.push({ floor: floor + 1, corridor, rooms, staircase: floor < floors - 1 ? { minX: -.95, maxX: .95, minZ: site.depth / 2 - 5.2, maxZ: site.depth / 2 - .4 } : undefined });
    const lampMaterial = createMaterial(ctx.scene, `${site.id}-ceiling-light-${floor + 1}`, new Color3(.82, .78, .58), .6);
    lampMaterial.emissiveColor = new Color3(.25, .22, .12); lightMaterials.push(lampMaterial);
    const panel = MeshBuilder.CreateBox("interior-light-panel", { width: 1.5, height: .06, depth: .55 }, ctx.scene);
    panel.position.set(0, floorY + site.floorHeight - .16, 0); panel.parent = site.root; panel.material = lampMaterial;
    const light = new PointLight(`${site.id}-light-${floor + 1}`, new Vector3(0, floorY + 2.25, 0), ctx.scene);
    light.parent = site.root; light.diffuse = new Color3(1, .86, .62); light.intensity = .34; light.range = Math.max(site.width, site.depth) * .7; lights.push(light);
  }

  if (site.mission) createMissionContents(ctx, site, floorData, deps);
  site.floorData = floorData;
  site.state = "GENERATED";
  return { floorData, lights, lightMaterials };
}

function createFloor(ctx: ObjectContext, site: InteriorBuildingSite, floor: number, y: number, material: StandardMaterial): void {
  if (floor === 0) { createSlab(ctx, site.root, "interior-floor", site.width - .35, site.depth - .35, .16, 0, y + .08, 0, material, true); return; }
  const openingWidth = 2.2;
  const sideWidth = (site.width - openingWidth) / 2;
  createSlab(ctx, site.root, "upper-floor-left", sideWidth, site.depth - .35, .16, -(openingWidth / 2 + sideWidth / 2), y, 0, material, true);
  createSlab(ctx, site.root, "upper-floor-right", sideWidth, site.depth - .35, .16, openingWidth / 2 + sideWidth / 2, y, 0, material, true);
  const frontDepth = Math.max(1, site.depth - 5.2);
  createSlab(ctx, site.root, "upper-floor-corridor", openingWidth, frontDepth, .16, 0, y, -site.depth / 2 + frontDepth / 2 + .2, material, true);
}

function createCorridorWalls(ctx: ObjectContext, site: InteriorBuildingSite, floorY: number, corridorWidth: number, doorCenters: number[], material: StandardMaterial): void {
  const doorHalf = .72;
  for (const side of [-1, 1]) {
    const boundaries = [-site.depth / 2 + .3, ...doorCenters.flatMap((center) => [center - doorHalf, center + doorHalf]), site.depth / 2 - .3];
    for (let i = 0; i < boundaries.length - 1; i += 2) {
      const start = boundaries[i]; const end = boundaries[i + 1];
      if (end - start <= .05) continue;
      createSlab(ctx, site.root, "interior-wall", .16, end - start, 2.45, side * corridorWidth / 2, floorY + 1.225, (start + end) / 2, material, true);
    }
  }
}

export function createStaircase(ctx: ObjectContext, site: InteriorBuildingSite, floorY: number, material: StandardMaterial): void {
  const run = 4.8;
  const rise = site.floorHeight;
  const back = site.depth / 2 - .35;
  const steps: Mesh[] = [];
  for (let i = 0; i < 8; i += 1) {
    const step = MeshBuilder.CreateBox("stair-step-part", { width: 1.8, height: .16, depth: run / 8 + .03 }, ctx.scene);
    step.position.set(0, floorY + (i + 1) * rise / 8, back - run + (i + .5) * run / 8); step.material = material; steps.push(step);
  }
  const merged = Mesh.MergeMeshes(steps, true, true, undefined, false, true);
  if (merged) { merged.name = `${site.id}-stairs`; merged.parent = site.root; merged.checkCollisions = false; }
  const slope = MeshBuilder.CreateBox(`${site.id}-stair-collider`, { width: 1.75, height: .12, depth: Math.hypot(run, rise) }, ctx.scene);
  slope.position.set(0, floorY + rise / 2, back - run / 2); slope.rotation.x = -Math.atan2(rise, run); slope.parent = site.root; slope.checkCollisions = true;
  const invisible = createMaterial(ctx.scene, `${site.id}-stair-collider-material`, Color3.Black()); invisible.alpha = 0; slope.material = invisible; slope.visibility = .01;
}

function createMissionContents(ctx: ObjectContext, site: InteriorBuildingSite, floors: FloorData[], deps: InteriorGenerationDeps): void {
  const firstFloorStorage = floors[0].rooms.find((room) => room.type === "STORAGE") ?? floors[0].rooms[0];
  const cardLocal = centerOf(firstFloorStorage.bounds, .48);
  site.root.computeWorldMatrix(true);
  createItem(ctx, deps.interactions, deps.inventory, { id: `${site.id}_item_card_001`, itemId: "card_key", displayName: "カードキー", position: Vector3.TransformCoordinates(cardLocal, site.root.getWorldMatrix()), color: new Color3(.2, .72, .9), onMessage: deps.onMessage, onPickup: () => deps.objectives.set("階段で2FのCONTROL ROOMへ向かう") });
  const controlRoom = floors.flatMap((floor) => floor.rooms).find((room) => room.type === "CONTROL_ROOM");
  if (!controlRoom) return;
  const switchLocal = centerOf(controlRoom.bounds, (controlRoom.floor - 1) * site.floorHeight);
  createSwitch(ctx, deps.interactions, deps.events, { id: `${site.id}_switch_001`, position: Vector3.TransformCoordinates(switchLocal, site.root.getWorldMatrix()), eventId: deps.gateEventId, onMessage: deps.onMessage, onActivate: () => deps.objectives.set("屋外ゲートを抜けてGoalへ向かう") });
}

function chooseRoomType(random: SeededRandom, mission: boolean | undefined, floor: number, row: number, side: number, floors: number): RoomType {
  if (mission && floor === 0 && row === 0 && side < 0) return "STORAGE";
  if (mission && floor === floors - 1 && row === 1 && side > 0) return "CONTROL_ROOM";
  return random.pick(["EMPTY", "OFFICE", "STORAGE", "LIVING_ROOM"] as const);
}

function centerOf(bounds: LocalBounds, y: number): Vector3 { return new Vector3((bounds.minX + bounds.maxX) / 2, y, (bounds.minZ + bounds.maxZ) / 2); }

function createSlab(ctx: ObjectContext, root: Mesh, name: string, width: number, depth: number, height: number, x: number, y: number, z: number, material: StandardMaterial, collision: boolean): Mesh {
  const mesh = MeshBuilder.CreateBox(name, { width, depth, height }, ctx.scene);
  mesh.position.set(x, y, z); mesh.parent = root; mesh.material = material; mesh.checkCollisions = collision; mesh.receiveShadows = true;
  return mesh;
}
