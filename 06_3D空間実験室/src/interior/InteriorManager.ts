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

export class InteriorManager {
  private readonly observer: Observer<Scene>;
  private readonly lights: Array<{ intensity: number; light: { intensity: number } }> = [];
  private readonly lightMaterials: StandardMaterial[] = [];
  private lastCheck = 0;

  constructor(
    private readonly ctx: ObjectContext,
    private readonly camera: Camera,
    private readonly sites: InteriorBuildingSite[],
    private readonly deps: { interactions: InteractionManager; inventory: InventoryManager; events: EventManager; objectives: ObjectiveManager; onMessage: (message: string) => void; gateEventId: string },
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
      if (site.state !== "GENERATED" || !site.floorData) continue;
      const inverse = Matrix.Invert(site.root.getWorldMatrix());
      const local = Vector3.TransformCoordinates(this.camera.position, inverse);
      if (Math.abs(local.x) > site.width / 2 || Math.abs(local.z) > site.depth / 2 || local.y < 0 || local.y > site.floors * site.floorHeight) continue;
      const floorIndex = Math.min(site.floorData.length - 1, Math.max(0, Math.floor(local.y / site.floorHeight)));
      const floor = site.floorData[floorIndex];
      const room = floor.rooms.find((candidate) => inside(candidate.bounds, local.x, local.z));
      return { building: site.id, floor: floor.floor, room: room?.id ?? `${site.id}_corridor_${floor.floor}` };
    }
    return undefined;
  }

  dispose(): void { this.ctx.scene.onBeforeRenderObservable.remove(this.observer); }

  private createEntrance(site: InteriorBuildingSite): void {
    let entrance = createDoor(this.ctx, this.deps.interactions, this.deps.inventory, {
      id: `${site.id}_entrance_001`, displayName: site.mission ? "INTERIOR LAB 入口" : `${site.id} 入口`, parent: site.root,
      position: new Vector3(-.8, 0, -site.depth / 2 - .13), width: 1.6, height: 2.4,
      locked: site.mission, keyId: site.mission ? "key" : undefined, color: site.mission ? new Color3(.2, .42, .5) : new Color3(.34, .24, .16), onMessage: this.deps.onMessage,
      onOpened: site.mission ? () => { if (entrance.isOpen()) this.deps.objectives.set("1Fを探索しカードキーを探す"); } : undefined,
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
    }
  }
}

function inside(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, x: number, z: number): boolean {
  return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
}
