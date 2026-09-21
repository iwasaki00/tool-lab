import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { WorldGraph } from "../navigation/WorldGraph";
import { SeededRandom } from "../random/seededRandom";
import type { AreaTag, AreaType, WorldArea } from "../world/SemanticTypes";
import type { WorldRegistry } from "../world/WorldRegistry";
import type { INavigationService } from "../contracts/ServiceContracts";

const OUTDOOR_TYPES: AreaType[] = ["ROAD", "SIDEWALK", "ALLEY", "INTERSECTION", "PLAZA", "PARK", "DEAD_END", "BUILDING_ENTRANCE"];
const ENEMY_TYPES: AreaType[] = [...OUTDOOR_TYPES, "CORRIDOR", "STORAGE", "OFFICE", "ROOM", "CONTROL_ROOM", "STAIR"];

export class CharacterNavigation {
  private readonly graph: WorldGraph;
  private readonly random: SeededRandom;
  private route: string[] = [];
  private waypoints: Vector3[] = [];
  private index = 0;
  private lastPathLength = 0;

  constructor(private readonly registry: WorldRegistry, seed: number, private readonly type: "NPC" | "ENEMY", private readonly navigation?: INavigationService) {
    this.graph = new WorldGraph(registry); this.random = new SeededRandom(seed);
  }

  chooseDestination(currentAreaId: string): WorldArea | undefined {
    const preferredTags: AreaTag[] = this.type === "NPC" ? ["safe", "public", "bright"] : ["danger", "dark", "narrow", "dead_end"];
    const navigationTypes = this.type === "ENEMY" ? ENEMY_TYPES : OUTDOOR_TYPES;
    const candidates = navigationTypes.flatMap((type) => this.registry.getAreasByType(type))
      .filter((area) => area.id !== currentAreaId && this.allowed(area));
    const scored = candidates.map((area) => ({ area, score: preferredTags.reduce((sum, tag) => sum + (area.tags.includes(tag) ? 5 : 0), 0) + this.random.next() * 3 }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, Math.min(6, scored.length)).length ? this.random.pick(scored.slice(0, Math.min(6, scored.length))).area : undefined;
  }

  plan(currentAreaId: string, targetAreaId: string, start?: Vector3): boolean {
    const path = this.graph.findPath(currentAreaId, targetAreaId, (area) => this.allowed(area));
    if (!path?.length) return false;
    this.route = path;
    const semantic = path.slice(1).map((id) => this.registry.get(id)).filter((area): area is WorldArea => Boolean(area)).map((area) => new Vector3(area.position.x, start?.y ?? area.position.y, area.position.z));
    const goal = semantic.at(-1);
    const navPath = start && goal ? this.navigation?.findPath(start, goal) ?? [] : [];
    if (start && goal && this.navigation?.isReady() && navPath.length < 2) return false;
    this.waypoints = navPath.length > 1 ? navPath.slice(1) : semantic;
    this.index = 0; this.lastPathLength = this.measure(this.waypoints, start); return this.waypoints.length > 0;
  }

  planPosition(start: Vector3, goal: Vector3): boolean {
    const navPath = this.navigation?.findPath(start, goal) ?? [];
    if (this.navigation?.isReady() && navPath.length < 2) { this.waypoints = []; this.index = 0; return false; }
    this.waypoints = navPath.length > 1 ? navPath.slice(1) : [goal.clone()]; this.index = 0; this.lastPathLength = this.measure(this.waypoints, start); return this.waypoints.length > 0;
  }

  currentWaypoint(y: number): Vector3 | undefined {
    const waypoint = this.waypoints[this.index]; return waypoint ? new Vector3(waypoint.x, waypoint.y || y, waypoint.z) : undefined;
  }

  advance(): boolean {
    if (this.index >= this.waypoints.length - 1) return true;
    this.index += 1; return false;
  }

  destinationId(): string | undefined { return this.route.at(-1); }
  pathInfo(): { length: number; waypointCount: number; currentWaypoint: number } { return { length: this.lastPathLength, waypointCount: this.waypoints.length, currentWaypoint: Math.min(this.index + 1, this.waypoints.length) }; }
  pathPoints(): Vector3[] { return this.waypoints.map((point) => point.clone()); }
  clear(): void { this.route = []; this.waypoints = []; this.index = 0; }

  private measure(points: Vector3[], start?: Vector3): number {
    let total = 0; let previous = start; points.forEach((point) => { if (previous) total += Vector3.Distance(previous, point); previous = point; }); return total;
  }

  private allowed(area: WorldArea): boolean {
    // Ver.8初期実装は安定性を優先して同一階・屋外経路に限定する。
    // TODO: ドア状態と階段接続を経路コストへ組み込み、複数階Navigationへ拡張する。
    const navigationTypes = this.type === "ENEMY" ? ENEMY_TYPES : OUTDOOR_TYPES;
    if (!navigationTypes.includes(area.type)) return false;
    return this.type === "ENEMY" || !area.tags.includes("danger");
  }
}
