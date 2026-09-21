import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import type { WorldRegistry } from "../world/WorldRegistry";

export interface DiscoverySnapshot {
  discovered: number;
  target: number;
  buildingsVisited: number;
  buildingTarget: number;
  landmarkFound: boolean;
  lastLabel?: string;
}

const DISCOVERABLE = new Set(["PARK", "PLAZA", "BUILDING", "BUILDING_ENTRANCE", "CONTROL_ROOM", "OFFICE", "STORAGE", "ROOFTOP", "LANDMARK"]);

export class DiscoveryManager {
  private readonly visited = new Set<string>();
  private readonly buildings = new Set<string>();
  private readonly observer: Observer<Scene>;
  private lastCheck = 0;
  private snapshotValue: DiscoverySnapshot = { discovered: 0, target: 5, buildingsVisited: 0, buildingTarget: 3, landmarkFound: false };

  constructor(scene: Scene, private readonly camera: Camera, private readonly registry: WorldRegistry, private readonly enabled: boolean, private readonly onDiscovery: (snapshot: DiscoverySnapshot, areaId?: string) => void) {
    this.observer = scene.onBeforeRenderObservable.add(() => this.update())!;
  }
  snapshot(): DiscoverySnapshot { return { ...this.snapshotValue }; }
  debugDiscoverCurrent(): void { const area = this.registry.getLocationAt(this.camera.position).area; if (area) this.discover(area); }
  debugDiscoverAll(): void { this.registry.getAll().filter((area) => DISCOVERABLE.has(area.type)).forEach((area) => this.discover(area, false)); this.onDiscovery(this.snapshot()); }
  debugReset(): void { this.visited.clear(); this.buildings.clear(); this.snapshotValue = { discovered: 0, target: 5, buildingsVisited: 0, buildingTarget: 3, landmarkFound: false }; this.onDiscovery(this.snapshot()); }
  dispose(scene: Scene): void { scene.onBeforeRenderObservable.remove(this.observer); }
  private update(): void {
    if (!this.enabled || performance.now() - this.lastCheck < 250) return; this.lastCheck = performance.now();
    const location = this.registry.getLocationAt(this.camera.position); const area = location.area;
    if (!area || !DISCOVERABLE.has(area.type) || this.visited.has(area.id)) return;
    this.discover(area);
  }
  private discover(area: ReturnType<WorldRegistry["getAll"]>[number], notify = true): void {
    if (!DISCOVERABLE.has(area.type) || this.visited.has(area.id)) return;
    this.visited.add(area.id);
    if (["BUILDING", "BUILDING_ENTRANCE", "CONTROL_ROOM", "OFFICE", "STORAGE", "ROOFTOP"].includes(area.type)) this.buildings.add(String(area.buildingId ?? area.metadata?.buildingId ?? area.id.split("_").slice(0, 3).join("_")));
    const landmark = area.tags.includes("landmark") || (area.importance ?? 0) >= 9 || area.id.includes("landmark") || area.id.includes("mission");
    this.snapshotValue = { discovered: this.visited.size, target: 5, buildingsVisited: this.buildings.size, buildingTarget: 3, landmarkFound: this.snapshotValue.landmarkFound || landmark, lastLabel: label(area.type) };
    if (notify) this.onDiscovery(this.snapshot(), area.id);
  }
}

function label(type: string): string { return ({ PARK: "公園", PLAZA: "広場", BUILDING: "建物", BUILDING_ENTRANCE: "建物入口", CONTROL_ROOM: "制御室", OFFICE: "オフィス", STORAGE: "倉庫", ROOFTOP: "屋上", LANDMARK: "ランドマーク" } as Record<string, string>)[type] ?? type; }
