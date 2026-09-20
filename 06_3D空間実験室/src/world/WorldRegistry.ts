import { SeededRandom } from "../random/seededRandom";
import type { AreaTag, AreaType, MapArea2D, SemanticLocation, WorldArea, WorldPosition, WorldStatistics } from "./SemanticTypes";

const CELL_SIZE = 12;

export class WorldRegistry {
  private readonly areas = new Map<string, WorldArea>();
  private readonly byType = new Map<AreaType, Set<string>>();
  private readonly byTag = new Map<AreaTag, Set<string>>();
  private readonly spatial = new Map<string, Set<string>>();

  register(area: WorldArea): WorldArea {
    this.remove(area.id);
    area.connections = [...new Set(area.connections)];
    area.tags = [...new Set(area.tags)];
    this.areas.set(area.id, area);
    addIndex(this.byType, area.type, area.id);
    area.tags.forEach((tag) => addIndex(this.byTag, tag, area.id));
    forEachCell(area, (key) => addIndex(this.spatial, key, area.id));
    return area;
  }

  remove(id: string): void {
    const area = this.areas.get(id);
    if (!area) return;
    area.connections.forEach((connectedId) => {
      const connected = this.areas.get(connectedId);
      if (connected) connected.connections = connected.connections.filter((candidate) => candidate !== id);
    });
    this.areas.delete(id);
    this.byType.get(area.type)?.delete(id);
    area.tags.forEach((tag) => this.byTag.get(tag)?.delete(id));
    forEachCell(area, (key) => this.spatial.get(key)?.delete(id));
  }

  get(id: string): WorldArea | undefined { return this.areas.get(id); }
  getAll(): WorldArea[] { return [...this.areas.values()]; }
  getAreasByType(type: AreaType): WorldArea[] { return this.resolve(this.byType.get(type)); }
  getAreasByTag(tag: AreaTag): WorldArea[] { return this.resolve(this.byTag.get(tag)); }
  getRandomAreaByType(type: AreaType, seed: number): WorldArea | undefined { return seededPick(this.getAreasByType(type), seed); }
  getRandomAreaByTag(tag: AreaTag, seed: number): WorldArea | undefined { return seededPick(this.getAreasByTag(tag), seed); }
  getAreasInBuilding(buildingId: string): WorldArea[] { return this.getAll().filter((area) => area.buildingId === buildingId); }
  getAreasOnFloor(floor: number, buildingId?: string): WorldArea[] {
    return this.getAll().filter((area) => area.floor === floor && (!buildingId || area.buildingId === buildingId));
  }

  connect(aId: string, bId: string): void {
    const a = this.areas.get(aId); const b = this.areas.get(bId);
    if (!a || !b) return;
    if (!a.connections.includes(bId)) a.connections.push(bId);
    if (!b.connections.includes(aId)) b.connections.push(aId);
  }

  getNearestArea(position: WorldPosition, types?: AreaType[]): WorldArea | undefined {
    const candidates = types?.length ? types.flatMap((type) => this.getAreasByType(type)) : this.getAll();
    return candidates.reduce<WorldArea | undefined>((nearest, area) => !nearest || distanceSquared(area.position, position) < distanceSquared(nearest.position, position) ? area : nearest, undefined);
  }

  getLocationAt(position: WorldPosition): SemanticLocation {
    const ids = this.spatial.get(cellKey(position.x, position.z));
    const matches = this.resolve(ids).filter((area) => contains(area, position));
    matches.sort((a, b) => locationPriority(b) - locationPriority(a) || volume(a) - volume(b));
    const area = matches[0] ?? this.getNearestArea(position, ["ROAD", "SIDEWALK", "ALLEY", "PLAZA", "PARK"]);
    return { area, building: area?.buildingId, floor: area?.floor, room: area?.roomId };
  }

  getStatistics(): WorldStatistics {
    const rooms = ["ROOM", "CONTROL_ROOM", "STORAGE", "OFFICE", "LIVING_ROOM"] as AreaType[];
    return {
      roads: this.getAreasByType("ROAD").length + this.getAreasByType("ALLEY").length,
      buildings: this.getAreasByType("BUILDING").length,
      rooms: rooms.reduce((sum, type) => sum + this.getAreasByType(type).length, 0),
      deadEnds: this.getAreasByTag("dead_end").length,
      safeAreas: this.getAreasByTag("safe").length,
      dangerAreas: this.getAreasByTag("danger").length,
      enemySpawns: this.getAreasByType("ENEMY_SPAWN").length,
      npcSpawns: this.getAreasByType("NPC_SPAWN").length,
    };
  }

  toMap2D(floor?: number): MapArea2D[] {
    return this.getAll().filter((area) => floor === undefined || area.floor === floor).map((area) => ({
      id: area.id, type: area.type, x: area.position.x, z: area.position.z,
      width: area.bounds.maxX - area.bounds.minX, depth: area.bounds.maxZ - area.bounds.minZ,
      floor: area.floor, tags: [...area.tags],
    }));
  }

  private resolve(ids?: Set<string>): WorldArea[] { return ids ? [...ids].map((id) => this.areas.get(id)).filter((area): area is WorldArea => Boolean(area)) : []; }
}

function seededPick<T>(values: T[], seed: number): T | undefined { return values.length ? new SeededRandom(seed).pick(values) : undefined; }
function addIndex<K>(map: Map<K, Set<string>>, key: K, id: string): void { const set = map.get(key) ?? new Set<string>(); set.add(id); map.set(key, set); }
function cellKey(x: number, z: number): string { return `${Math.floor(x / CELL_SIZE)}:${Math.floor(z / CELL_SIZE)}`; }
function forEachCell(area: WorldArea, callback: (key: string) => void): void {
  for (let x = Math.floor(area.bounds.minX / CELL_SIZE); x <= Math.floor(area.bounds.maxX / CELL_SIZE); x += 1)
    for (let z = Math.floor(area.bounds.minZ / CELL_SIZE); z <= Math.floor(area.bounds.maxZ / CELL_SIZE); z += 1) callback(`${x}:${z}`);
}
function contains(area: WorldArea, p: WorldPosition): boolean { const b = area.bounds; return p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY && p.z >= b.minZ && p.z <= b.maxZ; }
function distanceSquared(a: WorldPosition, b: WorldPosition): number { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2; }
function volume(area: WorldArea): number { const b = area.bounds; return (b.maxX - b.minX) * Math.max(.1, b.maxY - b.minY) * (b.maxZ - b.minZ); }
function locationPriority(area: WorldArea): number { return area.tags.includes("indoor") ? 30 : area.type === "BUILDING_ENTRANCE" ? 25 : area.type === "STAIR" ? 20 : area.importance ?? 0; }
