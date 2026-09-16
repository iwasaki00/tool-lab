import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { WorldGraph } from "../navigation/WorldGraph";
import { SeededRandom } from "../random/seededRandom";
import type { AreaTag, AreaType, WorldArea } from "../world/SemanticTypes";
import type { WorldRegistry } from "../world/WorldRegistry";

const OUTDOOR_TYPES: AreaType[] = ["ROAD", "SIDEWALK", "ALLEY", "INTERSECTION", "PLAZA", "PARK", "DEAD_END", "BUILDING_ENTRANCE"];

export class CharacterNavigation {
  private readonly graph: WorldGraph;
  private readonly random: SeededRandom;
  private route: string[] = [];
  private index = 0;

  constructor(private readonly registry: WorldRegistry, seed: number, private readonly type: "NPC" | "ENEMY") {
    this.graph = new WorldGraph(registry); this.random = new SeededRandom(seed);
  }

  chooseDestination(currentAreaId: string): WorldArea | undefined {
    const preferredTags: AreaTag[] = this.type === "NPC" ? ["safe", "public", "bright"] : ["danger", "dark", "narrow", "dead_end"];
    const candidates = OUTDOOR_TYPES.flatMap((type) => this.registry.getAreasByType(type))
      .filter((area) => area.id !== currentAreaId && this.allowed(area));
    const scored = candidates.map((area) => ({ area, score: preferredTags.reduce((sum, tag) => sum + (area.tags.includes(tag) ? 5 : 0), 0) + this.random.next() * 3 }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, Math.min(6, scored.length)).length ? this.random.pick(scored.slice(0, Math.min(6, scored.length))).area : undefined;
  }

  plan(currentAreaId: string, targetAreaId: string): boolean {
    const path = this.graph.findPath(currentAreaId, targetAreaId, (area) => this.allowed(area));
    if (!path?.length) return false;
    this.route = path; this.index = Math.min(1, path.length - 1); return true;
  }

  currentWaypoint(y: number): Vector3 | undefined {
    const area = this.registry.get(this.route[this.index]);
    return area ? new Vector3(area.position.x, y, area.position.z) : undefined;
  }

  advance(): boolean {
    if (this.index >= this.route.length - 1) return true;
    this.index += 1; return false;
  }

  destinationId(): string | undefined { return this.route.at(-1); }
  clear(): void { this.route = []; this.index = 0; }

  private allowed(area: WorldArea): boolean {
    // Ver.8初期実装は安定性を優先して同一階・屋外経路に限定する。
    // TODO: ドア状態と階段接続を経路コストへ組み込み、複数階Navigationへ拡張する。
    if (!OUTDOOR_TYPES.includes(area.type)) return false;
    if (area.tags.includes("indoor") || (area.floor ?? 1) > 1) return false;
    return this.type === "ENEMY" || !area.tags.includes("danger");
  }
}
