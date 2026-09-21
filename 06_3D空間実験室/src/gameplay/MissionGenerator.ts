import { SeededRandom } from "../random/seededRandom";
import type { WorldArea, WorldPosition } from "../world/SemanticTypes";
import type { WorldRegistry } from "../world/WorldRegistry";
import type { GamePlacement, GamePlacementManager, PlacementKind } from "./GamePlacementManager";
import type { MissionDifficulty, MissionItemSpec, MissionPlan, MissionStep, MissionType } from "./MissionTypes";

export type { MissionPlan } from "./MissionTypes";

export interface MissionTemplateDefinition {
  id: string;
  requiredSwitches: readonly string[];
}

export interface MissionTemplateSource {
  get(type: MissionType): MissionTemplateDefinition;
  instantiate(type: MissionType, difficulty: MissionDifficulty, targets: Record<string, string[]>): MissionStep[];
}

export class MissionGenerator {
  private readonly random: SeededRandom;
  constructor(private readonly registry: WorldRegistry, private readonly placement: GamePlacementManager, private readonly citySeed: number, private readonly seed: number, private readonly templates: MissionTemplateSource) {
    this.random = new SeededRandom(seed);
  }

  generate(startPosition: WorldPosition, missionBuildingId: string, type: MissionType, difficulty: MissionDifficulty, retryCount = 0): MissionPlan {
    // 先にTemplateでMission構造を決め、その要求をSemantic Areaへ割り当てる。
    const template = this.templates.get(type);
    const startArea = this.registry.getNearestArea(startPosition, ["PLAZA", "PARK", "ROAD", "BUILDING_ENTRANCE"]);
    if (!startArea) throw new Error("MISSION GENERATION FAILED: START area could not be resolved.");
    const entranceId = `${missionBuildingId}_entrance_001`;
    const controlDoorId = `${missionBuildingId}_door_2_4`;
    const switchA = `${missionBuildingId}_switch_001`;
    const switchB = `${missionBuildingId}_switch_002`;
    const upperFloor = `${missionBuildingId}_corridor_2`;
    const outdoor = this.pickOutdoorAreas(startPosition);
    if (outdoor.length < 2) throw new Error("MISSION GENERATION FAILED: item placement areas are insufficient.");
    const goalArea = this.placement.chooseArea(["PLAZA", "ROAD", "PARK", "BUILDING_ENTRANCE"], ["landmark", "wide"], startPosition, 14) ?? outdoor[outdoor.length - 1];
    const start = this.placement.place("start_001", "START", startArea, .12); start.position = { ...startPosition };
    const goal = this.placement.place("goal_001", "GOAL", goalArea, .12);
    const items: MissionItemSpec[] = [];
    const addItem = (id: string, itemId: string, displayName: string, kind: MissionItemSpec["kind"], area: WorldArea): GamePlacement => {
      const placed = this.placement.place(id, kind as PlacementKind, area, .48); items.push({ id, itemId, displayName, kind, placement: placed }); return placed;
    };
    const key = addItem("item_key_001", "key", "鍵", "KEY", outdoor[0]);
    const cardA = addItem("item_card_a_001", "card_key", "カードキー A", "CARD_KEY", outdoor[Math.min(1, outdoor.length - 1)]);
    const cardB = addItem("item_card_b_001", "card_key", "カードキー B", "CARD_KEY", outdoor[Math.min(2, outdoor.length - 1)]);
    const battery = addItem("item_battery_001", "battery", "Battery", "ITEM", outdoor[Math.min(3, outdoor.length - 1)]);
    const optional = addItem("item_optional_coin_001", "coin", "補給コイン", "ITEM", outdoor[Math.min(4, outdoor.length - 1)]);
    const entrances = this.registry.getAreasByType("BUILDING_ENTRANCE").filter((area) => area.id !== entranceId);
    const firstBuildingIndex = entrances.length ? this.random.integer(0, entrances.length - 1) : -1;
    const buildingA = entrances[firstBuildingIndex]?.id ?? outdoor[0].id;
    const buildingB = entrances.find((area, index) => index !== firstBuildingIndex && area.id !== buildingA)?.id ?? outdoor[1].id;
    const targets: Record<string, string[]> = {
      $KEY: [key.id], $CARD_BRANCH: difficulty === "EASY" ? [cardA.id] : [cardA.id, cardB.id], $BATTERY: [battery.id], $OPTIONAL: [optional.id],
      $ENTRANCE: [entranceId], $CONTROL_DOOR: [controlDoorId], $UPPER_FLOOR: [upperFloor], $INTERIOR_CARD: [`${missionBuildingId}_item_card_001`],
      $SWITCH_A: [switchA], $SWITCH_B: [switchB], $GOAL: [goal.id], $BUILDING_A: [buildingA], $BUILDING_B: [buildingB],
    };
    const steps = this.templates.instantiate(type, difficulty, targets);
    const usedTargets = new Set(steps.flatMap((step) => step.targetIds));
    const usedItems = items.filter((item) => usedTargets.has(item.id) || item.id === optional.id && difficulty !== "EASY");
    const entranceCredential = type === "ACCESS_CONTROL" || type === "MULTI_BUILDING" && difficulty !== "EASY" ? "card_key" : type === "POWER_RESTORE" ? "battery" : "key";
    const interiorItemIds = usedTargets.has(`${missionBuildingId}_item_card_001`) ? [`${missionBuildingId}_item_card_001`] : [];
    const switchIds = [switchA, switchB].filter((id) => usedTargets.has(id));
    [start, goal, ...usedItems.map((item) => item.placement)].forEach((placed) => this.placement.registerSpawn(placed));
    return {
      seed: this.seed, citySeed: this.citySeed, type, difficulty, templateId: template.id, start, goal, missionBuildingId,
      entranceId, entranceCredential, steps, items: usedItems, interior: { itemIds: interiorItemIds, switchIds, controlDoorCredential: interiorItemIds.length ? "card_key" : undefined },
      reward: { score: difficulty === "HARD" ? 2000 : difficulty === "NORMAL" ? 1200 : 700, timeBonus: true }, retryCount,
    };
  }

  private pickOutdoorAreas(start: WorldPosition): WorldArea[] {
    const types = ["DEAD_END", "ALLEY", "ROAD", "PLAZA", "PARK"] as const;
    const result: WorldArea[] = [];
    for (let index = 0; index < 6; index += 1) {
      const area = this.placement.chooseArea([...types], index % 2 ? ["public"] : ["dead_end", "dark"], result.at(-1)?.position ?? start, index < 2 ? 6 : 3);
      if (area && !result.some((entry) => entry.id === area.id)) result.push(area);
    }
    const fallback = types.flatMap((kind) => this.registry.getAreasByType(kind)).filter((area) => !result.some((entry) => entry.id === area.id));
    while (result.length < 5 && fallback.length) result.push(fallback.splice(this.random.integer(0, fallback.length - 1), 1)[0]);
    return result;
  }
}
