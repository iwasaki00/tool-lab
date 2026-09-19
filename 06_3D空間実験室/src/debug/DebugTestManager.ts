import type { Camera } from "@babylonjs/core/Cameras/camera";
import { PointerEventTypes, type PointerInfo } from "@babylonjs/core/Events/pointerEvents";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import type { InventoryEntry, InventoryManager } from "../gameplay/InventoryManager";
import type { MissionPlan, MissionRuntimeSnapshot, MissionStep } from "../gameplay/MissionTypes";
import type { MissionRuntime } from "../gameplay/MissionRuntime";
import type { NavigationManager } from "../navigation/NavigationManager";
import type { DoorController } from "../objects/interactiveDoor";
import type { SwitchController } from "../objects/interactiveSwitch";
import type { WorldRegistry } from "../world/WorldRegistry";

export type DebugCommand =
  | "complete-current" | "give-key" | "give-card" | "give-battery" | "give-all" | "clear-inventory"
  | "teleport-start" | "teleport-current" | "teleport-goal" | "teleport-floor" | "teleport-room"
  | "unlock-all" | "open-all" | "close-all" | "lock-all" | "reset-doors"
  | "door-unlock" | "door-open" | "door-close" | "door-lock"
  | "switches-on" | "switches-off" | "reset-switches" | "switch-on" | "switch-off" | "switch-toggle"
  | "show-navmesh" | "hide-navmesh" | "show-current-route" | "show-full-route" | "rebuild-navigation" | "clear-paths";

export interface SelectedDebugObject { id: string; type: string; interaction: string; state: string; x: number; y: number; z: number; area: string; distance: number }

export interface DebugTestSnapshot {
  mission: MissionRuntimeSnapshot;
  inventory: InventoryEntry[];
  doors: Array<{ id: string; state: string }>;
  switches: Array<{ id: string; state: string }>;
  rooms: Array<{ id: string; floor?: number; type: string }>;
  objects: Array<{ id: string; type: string }>;
  player: { x: number; y: number; z: number; area: string; floor: string; room: string; tags: string; building: string };
  selected?: SelectedDebugObject;
  logs: string[];
}

export class DebugTestManager {
  private readonly logs: string[] = [];
  private readonly pointerObserver: Observer<PointerInfo>;
  private selectMode = false;
  private selectedMesh?: AbstractMesh;
  constructor(
    private readonly scene: Scene,
    private readonly camera: Camera,
    private readonly registry: WorldRegistry,
    private readonly plan: MissionPlan,
    private readonly runtime: MissionRuntime,
    private readonly inventory: InventoryManager,
    private readonly navigation?: NavigationManager,
  ) {
    this.pointerObserver = scene.onPointerObservable.add((info) => {
      if (!this.selectMode || info.type !== PointerEventTypes.POINTERPICK || !info.pickInfo?.pickedMesh) return;
      const mesh = info.pickInfo.pickedMesh; const metadata = debugMetadata(mesh);
      if (!metadata.gameplayId && !metadata.characterId) return;
      this.selectedMesh = mesh; this.log(`Selected ${String(metadata.gameplayId ?? metadata.characterId)}`);
    })!;
  }

  snapshot(): DebugTestSnapshot {
    const location = this.registry.getLocationAt(this.camera.position);
    return {
      mission: this.runtime.snapshot(), inventory: this.inventory.entries(),
      doors: this.doors().map((door) => ({ id: door.id, state: door.isLocked() ? "LOCKED" : door.isOpen() ? "OPEN" : "CLOSED" })),
      switches: this.switches().map((item) => ({ id: item.id, state: item.isActive() ? "ON" : "OFF" })),
      rooms: this.registry.getAll().filter((area) => ["ROOM", "OFFICE", "STORAGE", "CONTROL_ROOM", "ROOFTOP"].includes(area.type)).map((area) => ({ id: area.id, floor: area.floor, type: area.type })),
      objects: this.registry.getAll().filter((area) => area.tags.includes("mission") || ["NPC_SPAWN", "ENEMY_SPAWN"].includes(area.type)).map((area) => ({ id: area.id, type: String(area.metadata?.kind ?? area.type) })),
      player: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z, area: location.area?.id ?? "—", floor: String(location.floor ?? "—"), room: location.room ?? "—", tags: location.area?.tags.join(", ") ?? "—", building: location.building ?? "—" },
      selected: this.selected(),
      logs: [...this.logs],
    };
  }

  setSelectMode(enabled: boolean): void { this.selectMode = enabled; if (!enabled) this.selectedMesh = undefined; this.log(`Select mode ${enabled ? "ON" : "OFF"}`); }
  record(message: string): void { this.log(message); }
  dispose(): void { this.scene.onPointerObservable.remove(this.pointerObserver); }

  command(command: DebugCommand, value?: string | number): void {
    switch (command) {
      case "complete-current": this.completeStep(this.runtime.current()); break;
      case "give-key": this.give("KEY"); break;
      case "give-card": this.give("CARD_KEY"); break;
      case "give-battery": this.give("ITEM", "battery"); break;
      case "give-all": this.plan.items.forEach((item) => this.inventory.add(item.itemId, item.displayName)); this.log("All mission items granted"); break;
      case "clear-inventory": this.inventory.clear(); this.log("Inventory cleared"); break;
      case "teleport-start": this.teleportTo(this.plan.start.id); break;
      case "teleport-current": this.teleportTo(this.runtime.current()?.targetIds[0]); break;
      case "teleport-goal": this.teleportTo(this.plan.goal.id); break;
      case "teleport-floor": this.teleportFloor(Number(value)); break;
      case "teleport-room": this.teleportTo(String(value)); break;
      case "unlock-all": this.doors().forEach((door) => door.unlock()); this.log("All doors unlocked"); break;
      case "open-all": this.doors().forEach((door) => { door.unlock(); door.open(); }); this.log("All doors opened"); break;
      case "close-all": this.doors().forEach((door) => door.close()); this.log("All doors closed"); break;
      case "lock-all": this.doors().forEach((door) => door.lock()); this.log("All doors locked"); break;
      case "reset-doors": this.doors().forEach((door) => door.reset()); this.log("Door states reset"); break;
      case "door-unlock": this.doors().find((door) => door.id === value)?.unlock(); this.log(`${value} unlocked`); break;
      case "door-open": this.doors().find((door) => door.id === value)?.open(); this.log(`${value} opened`); break;
      case "door-close": this.doors().find((door) => door.id === value)?.close(); this.log(`${value} closed`); break;
      case "door-lock": this.doors().find((door) => door.id === value)?.lock(); this.log(`${value} locked`); break;
      case "switches-on": this.switches().forEach((item) => item.on()); this.log("All switches activated"); break;
      case "switches-off": this.switches().forEach((item) => item.off()); this.log("All switches deactivated"); break;
      case "reset-switches": this.switches().forEach((item) => item.reset()); this.log("Switch states reset"); break;
      case "switch-on": this.switches().find((item) => item.id === value)?.on(); this.log(`${value} ON`); break;
      case "switch-off": this.switches().find((item) => item.id === value)?.off(); this.log(`${value} OFF`); break;
      case "switch-toggle": this.switches().find((item) => item.id === value)?.toggle(); this.log(`${value} toggled`); break;
      case "rebuild-navigation": this.navigation?.retry(); this.log("Navigation rebuild requested"); break;
      case "show-navmesh": this.navigation?.setDebugVisible(true); this.log("NavMesh debug shown"); break;
      case "hide-navmesh": this.navigation?.setDebugVisible(false); this.log("NavMesh debug hidden"); break;
      case "show-current-route": this.showCurrentRoute(); break;
      case "show-full-route": this.showFullRoute(); break;
      case "clear-paths": this.navigation?.clearAllPaths(); this.log("Path debug cleared"); break;
    }
  }

  jumpTo(stepId: string): void {
    const index = this.plan.steps.findIndex((step) => step.id === stepId); if (index < 0) return;
    this.plan.steps.slice(0, index).forEach((step) => this.satisfyStep(step, false)); this.runtime.debugJumpTo(stepId); this.log(`Jumped to objective ${stepId}`);
  }

  private completeStep(step?: MissionStep): void { if (!step) return; this.satisfyStep(step, true); this.log(`Completed ${step.id}`); }
  private satisfyStep(step: MissionStep, complete: boolean): void {
    if (step.type === "FIND_ITEM") step.targetIds.forEach((id) => { const item = this.plan.items.find((candidate) => candidate.id === id); if (item && !this.inventory.has(item.itemId)) this.inventory.add(item.itemId, item.displayName); });
    if (step.type === "OPEN_DOOR") step.targetIds.forEach((id) => { const door = this.doors().find((candidate) => candidate.id === id); door?.unlock(); door?.open(); });
    if (step.type === "ACTIVATE_SWITCH") step.targetIds.forEach((id) => this.switches().find((candidate) => candidate.id === id)?.on());
    if (complete) this.runtime.complete(step.id, `[DEBUG] ${step.description}`);
  }
  private give(kind: "KEY" | "CARD_KEY" | "ITEM", itemId?: string): void { const item = this.plan.items.find((candidate) => candidate.kind === kind && (!itemId || candidate.itemId === itemId)); if (!item) { this.log(`${kind} is not used by this mission`); return; } this.inventory.add(item.itemId, item.displayName); this.log(`${item.displayName} granted`); }
  private teleportTo(id?: string): void { const area = id ? this.registry.get(id) : undefined; if (!area) { this.log(`Teleport target not found: ${id ?? "—"}`); return; } const target = new Vector3(area.position.x, Math.max(area.bounds.minY + 2.05, area.position.y + 1.7), area.position.z); const safe = this.navigation?.isReady() ? this.navigation.closestPoint(target) : target; safe.y = target.y; this.camera.position.copyFrom(safe); this.camera.position.z -= 1.8; this.log(`Teleported near ${area.id}`); }
  private teleportFloor(floor: number): void { const current = this.registry.getLocationAt(this.camera.position); const building = current.building ?? this.plan.missionBuildingId; const area = this.registry.getAreasOnFloor(floor, building).find((item) => ["CORRIDOR", "ROOM", "OFFICE", "CONTROL_ROOM"].includes(item.type)); if (area) this.teleportTo(area.id); else this.log(`Floor ${floor} is not available`); }
  private showCurrentRoute(): void { const id = this.runtime.current()?.targetIds[0]; const target = id ? this.registry.get(id) : undefined; if (!target || !this.navigation) { this.log("Current route target not found"); return; } const to = new Vector3(target.position.x, target.position.y, target.position.z); const path = this.navigation.findPath(this.camera.position, to); this.navigation.setDebugVisible(true); this.navigation.showPath("debug-current-route", path.length > 1 ? path : [this.camera.position.clone(), to]); this.log("Current mission route shown"); }
  private showFullRoute(): void { if (!this.navigation) return; const points = [this.camera.position.clone(), ...this.plan.steps.flatMap((step) => step.targetIds.slice(0, 1)).map((id) => this.registry.get(id)).filter((area): area is NonNullable<typeof area> => Boolean(area)).map((area) => new Vector3(area.position.x, area.position.y, area.position.z))]; const route: Vector3[] = []; for (let index = 1; index < points.length; index += 1) { const segment = this.navigation.findPath(points[index - 1], points[index]); route.push(...(segment.length > 1 ? segment : [points[index - 1], points[index]]).slice(route.length ? 1 : 0)); } this.navigation.setDebugVisible(true); this.navigation.showPath("debug-full-route", route); this.log("Full mission route shown"); }
  private doors(): DoorController[] { return this.scene.meshes.map((mesh) => mesh.metadata?.debugDoorController as DoorController | undefined).filter((item): item is DoorController => Boolean(item)); }
  private switches(): SwitchController[] { return this.scene.meshes.map((mesh) => mesh.metadata?.debugSwitchController as SwitchController | undefined).filter((item): item is SwitchController => Boolean(item)); }
  private selected(): SelectedDebugObject | undefined {
    const mesh = this.selectedMesh; if (!mesh || mesh.isDisposed()) return undefined;
    const metadata = debugMetadata(mesh); const id = String(metadata.gameplayId ?? metadata.characterId ?? mesh.name); const type = String(metadata.gameplayType ?? (metadata.characterId ? "character" : "mesh")).toUpperCase();
    const position = mesh.getAbsolutePosition(); const area = this.registry.getLocationAt(position).area?.id ?? "—";
    const door = metadata.debugDoorController as DoorController | undefined; const toggle = metadata.debugSwitchController as SwitchController | undefined;
    const state = door ? (door.isLocked() ? "LOCKED" : door.isOpen() ? "OPEN" : "CLOSED") : toggle ? (toggle.isActive() ? "ON" : "OFF") : "ACTIVE";
    return { id, type, interaction: String(metadata.interactionType ?? "inspect"), state, x: position.x, y: position.y, z: position.z, area, distance: Vector3.Distance(position, this.camera.position) };
  }
  private log(message: string): void { this.logs.push(`[DEBUG] ${message}`); if (this.logs.length > 80) this.logs.splice(0, this.logs.length - 80); console.info(`[DEBUG] ${message}`); }
}

function debugMetadata(mesh: AbstractMesh): Record<string, unknown> { return { ...(mesh.parent?.metadata ?? {}), ...(mesh.metadata ?? {}) }; }
