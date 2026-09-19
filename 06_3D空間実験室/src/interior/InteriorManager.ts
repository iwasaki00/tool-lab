import type { Camera } from "@babylonjs/core/Cameras/camera";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { EventManager } from "../gameplay/EventManager";
import type { InventoryManager } from "../gameplay/InventoryManager";
import type { ObjectiveManager } from "../gameplay/ObjectiveManager";
import type { InteractionManager } from "../interaction/InteractionManager";
import { createDoor } from "../objects/interactiveDoor";
import type { ObjectContext } from "../objects/primitives";
import { createBuildingInterior } from "../world/buildingInteriorGenerator";
import type { InteriorBuildingSite, InteriorNavigation } from "./Room";
import type { GamePlacementManager } from "../gameplay/GamePlacementManager";
import { createBounds } from "../world/SemanticTypes";
import type { WorldRegistry } from "../world/WorldRegistry";
import type { MissionPlan } from "../gameplay/MissionTypes";
import type { MissionRuntime } from "../gameplay/MissionRuntime";

export class InteriorManager {
  private readonly observer: Observer<Scene>;
  private readonly lights: Array<{ intensity: number; light: { intensity: number } }> = [];
  private readonly lightMaterials: StandardMaterial[] = [];
  private lastCheck = 0;

  constructor(
    private readonly ctx: ObjectContext,
    private readonly camera: Camera,
    private readonly sites: InteriorBuildingSite[],
    private readonly deps: { interactions: InteractionManager; inventory: InventoryManager; events: EventManager; objectives: ObjectiveManager; onMessage: (message: string) => void; gateEventId: string; registry: WorldRegistry; placement: GamePlacementManager; missionPlan: MissionPlan; missionRuntime: MissionRuntime; onNavigationChanged?: () => void },
  ) {
    sites.forEach((site) => this.createEntrance(site));
    this.observer = ctx.scene.onBeforeRenderObservable.add(() => this.update())!;
    this.update(true);
  }

  setDayMode(isDay: boolean): void {
    this.lights.forEach((entry) => { entry.light.intensity = isDay ? entry.intensity * .55 : entry.intensity; });
    this.lightMaterials.forEach((material) => { material.emissiveColor = isDay ? new Color3(.1, .13, .14) : new Color3(.34, .29, .16); });
  }

  navigation(): InteriorNavigation | undefined {
    for (const site of this.sites) {
      if (site.state !== "GENERATED" || !site.floorData?.length) continue;
      const inverse = Matrix.Invert(site.root.getWorldMatrix());
      const local = Vector3.TransformCoordinates(this.camera.position, inverse);
      if (Math.abs(local.x) > site.width / 2 || Math.abs(local.z) > site.depth / 2 || local.y < 0 || local.y > site.floors * site.floorHeight) continue;
      const floorIndex = Math.min(site.floorData.length - 1, Math.max(0, Math.floor(local.y / site.floorHeight)));
      const floor = site.floorData[floorIndex];
      if (!floor) continue;
      const room = floor.rooms.find((candidate) => inside(candidate.bounds, local.x, local.z));
      return { building: site.id, floor: floor.floor, room: room?.id ?? `${site.id}_corridor_${floor.floor}` };
    }
    return undefined;
  }

  dispose(): void { this.ctx.scene.onBeforeRenderObservable.remove(this.observer); }

  private createEntrance(site: InteriorBuildingSite): void {
    site.root.computeWorldMatrix(true);
    const entrancePosition = Vector3.TransformCoordinates(new Vector3(0, .12, -site.depth / 2 - .5), site.root.getWorldMatrix());
    this.deps.registry.register({ id: `${site.id}_entrance_001`, type: "BUILDING_ENTRANCE", position: entrancePosition, bounds: createBounds(entrancePosition, 2.2, 2.2, 0, 3.2), buildingId: site.id, connections: [site.id], tags: ["outdoor", "public", "ground_floor", ...(site.mission ? ["landmark" as const, "mission" as const] : [])], importance: site.mission ? 10 : 5 });
    const streetAccess = this.deps.registry.getNearestArea(entrancePosition, ["ROAD", "SIDEWALK", "ALLEY"]);
    if (streetAccess) this.deps.registry.connect(`${site.id}_entrance_001`, streetAccess.id);
    const entrance = createDoor(this.ctx, this.deps.interactions, this.deps.inventory, {
      id: `${site.id}_entrance_001`, displayName: site.mission ? "INTERIOR LAB 入口" : `${site.id} 入口`, parent: site.root,
      position: new Vector3(-.8, 0, -site.depth / 2 - .13), width: 1.6, height: 2.9,
      locked: site.mission, keyId: site.mission ? this.deps.missionPlan.entranceCredential : undefined, color: site.mission ? new Color3(.2, .42, .5) : new Color3(.34, .24, .16), onMessage: this.deps.onMessage,
      onOpened: site.mission ? () => { if (entrance.isOpen()) this.deps.missionRuntime.completeByTarget(`${site.id}_entrance_001`, "Mission entrance opened"); } : undefined,
    });
  }

  private update(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastCheck < 400) return;
    this.lastCheck = now;
    for (const site of this.sites) {
      if (site.state === "GENERATED") continue;
      const center = site.root.getAbsolutePosition();
      const dx = center.x - this.camera.position.x; const dz = center.z - this.camera.position.z;
      if (dx * dx + dz * dz > 25 * 25) continue;
      const resources = createBuildingInterior(this.ctx, site, this.deps);
      resources.lights.forEach((light) => this.lights.push({ light, intensity: light.intensity }));
      this.lightMaterials.push(...resources.lightMaterials);
      this.deps.onNavigationChanged?.();
    }
  }
}

function inside(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, x: number, z: number): boolean {
  return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
}
