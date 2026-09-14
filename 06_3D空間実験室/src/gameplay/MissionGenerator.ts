import type { GamePlacement, GamePlacementManager } from "./GamePlacementManager";
import type { WorldPosition } from "../world/SemanticTypes";
import type { WorldRegistry } from "../world/WorldRegistry";

export interface MissionDependency { id: string; requires: string[] }
export interface MissionPlan {
  seed: number;
  start: GamePlacement;
  key: GamePlacement;
  lockedEntranceId: string;
  missionBuildingId: string;
  goal: GamePlacement;
  dependencies: MissionDependency[];
}

export class MissionGenerator {
  constructor(private readonly registry: WorldRegistry, private readonly placement: GamePlacementManager, private readonly seed: number) {}

  generate(startPosition: WorldPosition, missionBuildingId: string): MissionPlan {
    const startArea = this.registry.getNearestArea(startPosition, ["PLAZA", "PARK", "ROAD", "BUILDING_ENTRANCE"]);
    if (!startArea) throw new Error("Mission START area could not be resolved.");
    const keyArea = this.placement.chooseArea(["DEAD_END", "ALLEY", "STORAGE", "ROOM"], ["dead_end", "dark"], startPosition, 5) ?? startArea;
    const goalArea = this.placement.chooseArea(["PLAZA", "ROAD", "PARK", "BUILDING_ENTRANCE"], ["landmark"], startPosition, 16) ?? startArea;
    const start = this.placement.place("start_001", "START", startArea, .12);
    start.position = { ...startPosition };
    const key = this.placement.place("item_key_001", "KEY", keyArea, .48);
    const goal = this.placement.place("goal_001", "GOAL", goalArea, .12);
    [start, key, goal].forEach((item) => this.placement.registerSpawn(item));
    return {
      seed: this.seed, start, key, goal, missionBuildingId, lockedEntranceId: `${missionBuildingId}_entrance_001`,
      dependencies: [
        { id: `${missionBuildingId}_entrance_001`, requires: ["key"] },
        { id: `${missionBuildingId}_switch_001`, requires: ["card_key", `${missionBuildingId}_entrance_001`] },
        { id: "goal_001", requires: [`${missionBuildingId}_switch_001`] },
      ],
    };
  }
}
