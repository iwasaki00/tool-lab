import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { ObjectContext } from "../objects/primitives";
import { SeededRandom } from "../random/seededRandom";
import { createMaterial } from "../utils/materials";
import type { InteriorBuildingSite } from "../interior/Room";
import type { AreaTag, AreaType, WorldArea, WorldPosition } from "../world/SemanticTypes";
import { createBounds } from "../world/SemanticTypes";
import type { WorldRegistry } from "../world/WorldRegistry";

export type PlacementKind = "START" | "KEY" | "CARD_KEY" | "ITEM" | "ENEMY" | "NPC" | "GOAL";
export interface GamePlacement { id: string; kind: PlacementKind; areaId: string; position: WorldPosition }

export class GamePlacementManager {
  private readonly random: SeededRandom;
  private readonly placements: GamePlacement[] = [];
  private readonly debugMeshes: AbstractMesh[] = [];
  private readonly debugCreated = new Set<string>();
  private debugVisible = false;

  constructor(private readonly registry: WorldRegistry, seed: number) { this.random = new SeededRandom(seed); }

  chooseArea(types: AreaType[], preferredTags: AreaTag[] = [], farFrom?: WorldPosition, minimumDistance = 0, buildingId?: string): WorldArea | undefined {
    let candidates = types.flatMap((type) => this.registry.getAreasByType(type));
    candidates = [...new Map(candidates.map((area) => [area.id, area])).values()]
      .filter((area) => !farFrom || distance(area.position, farFrom) >= minimumDistance)
      .filter((area) => !buildingId || area.buildingId === buildingId)
      .filter((area) => this.hasAccessiblePoint(area))
      .filter((area) => !area.tags.includes("safe") || types.some((type) => type === "PARK" || type === "PLAZA"));
    if (!candidates.length) return undefined;
    const scored = candidates.map((area) => ({ area, score: preferredTags.reduce((sum, tag) => sum + (area.tags.includes(tag) ? 4 : 0), 0) + (area.importance ?? 0) + this.random.next() }));
    scored.sort((a, b) => b.score - a.score || a.area.id.localeCompare(b.area.id));
    return scored[0].area;
  }

  chooseMissionBuilding(sites: InteriorBuildingSite[], start: WorldPosition): InteriorBuildingSite | undefined {
    const ranked = sites.map((site) => ({ site, distance: distance(site.root.getAbsolutePosition(), start), jitter: this.random.next() }));
    ranked.sort((a, b) => b.distance - a.distance || b.jitter - a.jitter);
    return ranked[0]?.site;
  }

  place(id: string, kind: PlacementKind, area: WorldArea, y = .48): GamePlacement {
    const margin = .65;
    const minX = Math.min(area.bounds.maxX, area.bounds.minX + margin); const maxX = Math.max(minX, area.bounds.maxX - margin);
    const minZ = Math.min(area.bounds.maxZ, area.bounds.minZ + margin); const maxZ = Math.max(minZ, area.bounds.maxZ - margin);
    const center = { x: area.position.x, y: Math.max(y, area.bounds.minY + y), z: area.position.z };
    let candidate: WorldPosition | undefined;
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const next = { x: this.random.range(minX, maxX), y: Math.max(y, area.bounds.minY + y), z: this.random.range(minZ, maxZ) };
      if (this.isPointAccessible(next, area) && this.placements.every((placed) => distance(placed.position, next) > 1.4)) { candidate = next; break; }
    }
    const position = candidate ?? this.accessibleSamples(area, center.y).find((point) => this.isPointAccessible(point, area)) ?? center;
    if (!this.isPointAccessible(position, area)) console.warn(`No accessible placement point found in area: ${area.id}`);
    const placement = { id, kind, areaId: area.id, position };
    this.placements.push(placement);
    return placement;
  }

  registerSpawn(placement: GamePlacement): void {
    const type = placement.kind === "ENEMY" ? "ENEMY_SPAWN" : placement.kind === "NPC" ? "NPC_SPAWN" : placement.kind === "GOAL" ? "GOAL_AREA" : placement.kind === "START" ? "START" : "ITEM";
    this.registry.register({ id: placement.id, type, position: placement.position, bounds: createBounds(placement.position, 1, 1, placement.position.y - .5, placement.position.y + 1.5), connections: [placement.areaId], tags: ["spawn", "mission"], importance: placement.kind === "GOAL" ? 10 : 4, metadata: { kind: placement.kind } });
  }

  createDebugMarkers(ctx: ObjectContext): void {
    const colors: Record<PlacementKind, Color3> = { START: new Color3(.15, .8, 1), KEY: new Color3(1, .7, .1), CARD_KEY: new Color3(.2, .8, 1), ITEM: new Color3(.8, .8, .3), ENEMY: new Color3(1, .16, .12), NPC: new Color3(.3, 1, .45), GOAL: new Color3(.75, .2, 1) };
    this.placements.filter((placement) => !this.debugCreated.has(placement.id)).forEach((placement) => {
      const marker = MeshBuilder.CreateSphere(`debug-placement-${placement.kind.toLowerCase()}`, { diameter: .42, segments: 8 }, ctx.scene);
      marker.position.set(placement.position.x, placement.position.y + .55, placement.position.z);
      const material = createMaterial(ctx.scene, `debug-placement-${placement.id}`, colors[placement.kind], .8);
      material.emissiveColor = colors[placement.kind].scale(.75); marker.material = material; marker.isPickable = false; marker.isVisible = false;
      marker.isVisible = this.debugVisible;
      this.debugMeshes.push(marker); this.debugCreated.add(placement.id);
    });
  }

  setDebugVisible(visible: boolean): void { this.debugVisible = visible; this.debugMeshes.forEach((mesh) => { mesh.isVisible = visible; }); }
  getPlacements(): readonly GamePlacement[] { return this.placements; }

  private hasAccessiblePoint(area: WorldArea): boolean {
    return this.accessibleSamples(area, Math.max(.48, area.bounds.minY + .48)).some((point) => this.isPointAccessible(point, area));
  }

  private accessibleSamples(area: WorldArea, y: number): WorldPosition[] {
    const insetX = Math.max(0, (area.bounds.maxX - area.bounds.minX) / 2 - .7);
    const insetZ = Math.max(0, (area.bounds.maxZ - area.bounds.minZ) / 2 - .7);
    return [
      { x: area.position.x, y, z: area.position.z },
      { x: area.position.x - insetX, y, z: area.position.z - insetZ },
      { x: area.position.x + insetX, y, z: area.position.z - insetZ },
      { x: area.position.x - insetX, y, z: area.position.z + insetZ },
      { x: area.position.x + insetX, y, z: area.position.z + insetZ },
      { x: area.position.x - insetX, y, z: area.position.z },
      { x: area.position.x + insetX, y, z: area.position.z },
      { x: area.position.x, y, z: area.position.z - insetZ },
      { x: area.position.x, y, z: area.position.z + insetZ },
    ];
  }

  private isPointAccessible(point: WorldPosition, area: WorldArea): boolean {
    const forbidden = ["STAIR", "BUILDING_ENTRANCE"] as AreaType[];
    if (forbidden.flatMap((type) => this.registry.getAreasByType(type)).some((candidate) => candidate.id !== area.id && inside(candidate, point, .3))) return false;
    // 屋内ミッション配置は許可しつつ、屋外の鍵などが建物や壁の中へ入るのを防ぐ。
    if (area.tags.includes("outdoor") && this.registry.getAreasByType("BUILDING").some((building) => building.id !== area.id && inside(building, point, .7))) return false;
    return true;
  }
}

function distance(a: WorldPosition, b: WorldPosition): number { return Math.hypot(a.x - b.x, a.z - b.z); }
function inside(area: WorldArea, point: WorldPosition, padding = 0): boolean { const b = area.bounds; return point.x >= b.minX - padding && point.x <= b.maxX + padding && point.z >= b.minZ - padding && point.z <= b.maxZ + padding; }
