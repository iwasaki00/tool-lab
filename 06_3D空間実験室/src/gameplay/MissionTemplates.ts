import type { MissionDifficulty, MissionPrerequisites, MissionStep, MissionStepType, MissionType } from "./MissionTypes";
import type { GuideTargetType } from "./ObjectiveManager";

export interface MissionTemplateStep {
  id: string;
  type: MissionStepType;
  target: string;
  targetType: GuideTargetType;
  description: string;
  prerequisites?: MissionPrerequisites;
  optional?: boolean;
  minimumDifficulty?: MissionDifficulty;
}

export interface MissionTemplate {
  id: string;
  type: MissionType;
  label: string;
  requiredItems: string[];
  requiredDoors: string[];
  requiredSwitches: string[];
  goalCondition: string;
  steps: MissionTemplateStep[];
}

const linear = (previous: string): MissionPrerequisites => ({ mode: "AND", stepIds: [previous] });

export const MISSION_TEMPLATES: Record<MissionType, MissionTemplate> = {
  ESCAPE: {
    id: "mission_escape", type: "ESCAPE", label: "ESCAPE", requiredItems: ["key"], requiredDoors: ["$ENTRANCE"], requiredSwitches: [], goalCondition: "reach_goal",
    steps: [
      { id: "find_key", type: "FIND_ITEM", target: "$KEY", targetType: "KEY", description: "鍵を探す" },
      { id: "open_locked_door", type: "OPEN_DOOR", target: "$ENTRANCE", targetType: "LOCKED DOOR", description: "鍵でINTERIOR LABを開ける", prerequisites: linear("find_key") },
      { id: "reach_goal", type: "REACH_GOAL", target: "$GOAL", targetType: "GOAL", description: "Goalへ向かう", prerequisites: linear("open_locked_door") },
    ],
  },
  ACCESS_CONTROL: {
    id: "mission_access_control", type: "ACCESS_CONTROL", label: "ACCESS CONTROL", requiredItems: ["card_key"], requiredDoors: ["$ENTRANCE", "$CONTROL_DOOR"], requiredSwitches: ["$SWITCH_A"], goalCondition: "reach_goal",
    steps: [
      { id: "find_card_key", type: "FIND_ITEM", target: "$CARD_BRANCH", targetType: "CARD KEY", description: "カードキーを探す" },
      { id: "open_security_door", type: "OPEN_DOOR", target: "$ENTRANCE", targetType: "LOCKED DOOR", description: "Security Doorを開ける", prerequisites: linear("find_card_key") },
      { id: "reach_control_room", type: "VISIT", target: "$CONTROL_DOOR", targetType: "CONTROL ROOM", description: "Control Roomへ向かう", prerequisites: linear("open_security_door") },
      { id: "activate_switch_a", type: "ACTIVATE_SWITCH", target: "$SWITCH_A", targetType: "SWITCH", description: "制御スイッチを起動する", prerequisites: linear("reach_control_room") },
      { id: "reach_goal", type: "REACH_GOAL", target: "$GOAL", targetType: "GOAL", description: "解放されたGoalへ向かう", prerequisites: linear("activate_switch_a") },
    ],
  },
  POWER_RESTORE: {
    id: "mission_power_restore", type: "POWER_RESTORE", label: "POWER RESTORE", requiredItems: ["battery"], requiredDoors: ["$ENTRANCE"], requiredSwitches: ["$SWITCH_A"], goalCondition: "reach_goal",
    steps: [
      { id: "find_battery", type: "FIND_ITEM", target: "$BATTERY", targetType: "ITEM", description: "Batteryを探す" },
      { id: "enter_power_lab", type: "OPEN_DOOR", target: "$ENTRANCE", targetType: "LOCKED DOOR", description: "Batteryで電源棟へ入る", prerequisites: linear("find_battery") },
      { id: "reach_control_room", type: "VISIT", target: "$CONTROL_DOOR", targetType: "CONTROL ROOM", description: "Control Roomへ向かう", prerequisites: linear("enter_power_lab") },
      { id: "restore_power", type: "ACTIVATE_SWITCH", target: "$SWITCH_A", targetType: "SWITCH", description: "主電源を復旧する", prerequisites: linear("reach_control_room") },
      { id: "reach_goal", type: "REACH_GOAL", target: "$GOAL", targetType: "GOAL", description: "解放されたGoalへ向かう", prerequisites: linear("restore_power") },
    ],
  },
  MULTI_BUILDING: {
    id: "mission_multi_building", type: "MULTI_BUILDING", label: "MULTI BUILDING", requiredItems: ["key", "card_key"], requiredDoors: ["$ENTRANCE"], requiredSwitches: [], goalCondition: "reach_goal",
    steps: [
      { id: "visit_building_a", type: "VISIT", target: "$BUILDING_A", targetType: "CHECKPOINT", description: "Building Aへ向かう" },
      { id: "find_key", type: "FIND_ITEM", target: "$KEY", targetType: "KEY", description: "Building A付近で鍵を探す", prerequisites: linear("visit_building_a") },
      { id: "visit_building_b", type: "VISIT", target: "$BUILDING_B", targetType: "CHECKPOINT", description: "Building Bへ向かう", prerequisites: linear("find_key") },
      { id: "find_card_key", type: "FIND_ITEM", target: "$CARD_BRANCH", targetType: "CARD KEY", description: "カードキー候補のどちらかを取得する", prerequisites: linear("visit_building_b") },
      { id: "enter_landmark", type: "OPEN_DOOR", target: "$ENTRANCE", targetType: "LOCKED DOOR", description: "ランドマーク建物へ侵入する", prerequisites: { mode: "AND", stepIds: ["find_key", "find_card_key"] } },
      { id: "reach_goal", type: "REACH_GOAL", target: "$GOAL", targetType: "GOAL", description: "Goalへ向かう", prerequisites: linear("enter_landmark") },
    ],
  },
  TOWER: {
    id: "mission_tower", type: "TOWER", label: "TOWER", requiredItems: ["key", "card_key"], requiredDoors: ["$ENTRANCE", "$CONTROL_DOOR"], requiredSwitches: ["$SWITCH_A"], goalCondition: "reach_goal",
    steps: [
      { id: "reach_landmark", type: "VISIT", target: "$ENTRANCE", targetType: "CHECKPOINT", description: "ランドマーク建物へ向かう" },
      { id: "find_key", type: "FIND_ITEM", target: "$KEY", targetType: "KEY", description: "1Fアクセス用の鍵を探す", prerequisites: linear("reach_landmark") },
      { id: "unlock_first_floor", type: "OPEN_DOOR", target: "$ENTRANCE", targetType: "LOCKED DOOR", description: "1Fのアクセスを解除する", prerequisites: linear("find_key") },
      { id: "reach_upper_floor", type: "VISIT", target: "$UPPER_FLOOR", targetType: "CONTROL ROOM", description: "階段で上階へ移動する", prerequisites: linear("unlock_first_floor") },
      { id: "find_card_key", type: "FIND_ITEM", target: "$INTERIOR_CARD", targetType: "CARD KEY", description: "上階でカードキーを探す", prerequisites: linear("reach_upper_floor") },
      { id: "reach_control_room", type: "VISIT", target: "$CONTROL_DOOR", targetType: "CONTROL ROOM", description: "最上階Control Roomへ入る", prerequisites: linear("find_card_key") },
      { id: "activate_switch_a", type: "ACTIVATE_SWITCH", target: "$SWITCH_A", targetType: "SWITCH", description: "最上階制御スイッチを起動する", prerequisites: linear("reach_control_room") },
      { id: "reach_goal", type: "REACH_GOAL", target: "$GOAL", targetType: "GOAL", description: "Goalへ向かう", prerequisites: linear("activate_switch_a") },
    ],
  },
};

export function instantiateTemplate(template: MissionTemplate, difficulty: MissionDifficulty, targets: Record<string, string[]>): MissionStep[] {
  const rank: Record<MissionDifficulty, number> = { EASY: 0, NORMAL: 1, HARD: 2 };
  let steps: MissionStep[] = template.steps.filter((step) => !step.minimumDifficulty || rank[difficulty] >= rank[step.minimumDifficulty]).map((step) => ({
    id: step.id, type: step.type, targetIds: targets[step.target] ?? [step.target], targetType: step.targetType,
    description: step.description, status: "LOCKED", prerequisites: step.prerequisites ?? { mode: "AND", stepIds: [] }, optional: step.optional,
  }));
  if (difficulty === "EASY") {
    const item = steps.find((step) => step.type === "FIND_ITEM");
    const door = steps.find((step) => step.type === "OPEN_DOOR");
    const goal = steps.find((step) => step.type === "REACH_GOAL");
    steps = [item, door, goal].filter((step): step is MissionStep => Boolean(step));
    steps.forEach((step, index) => { step.prerequisites = { mode: "AND", stepIds: index ? [steps[index - 1].id] : [] }; });
    return steps;
  }
  const baseLength = steps.length;
  const initialSteps = steps.filter((step) => !step.prerequisites.stepIds.length);
  if (difficulty === "NORMAL" && baseLength < 4 || difficulty === "HARD" && baseLength <= 5) {
    const briefing: MissionStep = { id: "mission_briefing", type: "VISIT", targetIds: targets.$BUILDING_A, targetType: "CHECKPOINT", description: "Mission開始地点を確認する", status: "LOCKED", prerequisites: { mode: "AND", stepIds: [] } };
    initialSteps.forEach((step) => { step.prerequisites = { mode: "AND", stepIds: [briefing.id] }; });
    steps.unshift(briefing);
  }
  if (difficulty === "HARD" && baseLength <= 6) {
    const briefingId = steps.some((step) => step.id === "mission_briefing") ? "mission_briefing" : undefined;
    const routePrerequisites = { mode: "AND" as const, stepIds: briefingId ? [briefingId] : [] };
    const routeA: MissionStep = { id: "approach_route_a", type: "VISIT", targetIds: targets.$BUILDING_A, targetType: "CHECKPOINT", description: "進入経路Aを確認する", status: "LOCKED", prerequisites: routePrerequisites, optional: true };
    const routeB: MissionStep = { id: "approach_route_b", type: "VISIT", targetIds: targets.$BUILDING_B, targetType: "CHECKPOINT", description: "進入経路Bを確認する", status: "LOCKED", prerequisites: routePrerequisites, optional: true };
    initialSteps.forEach((step) => { step.prerequisites = { mode: "OR", stepIds: [routeA.id, routeB.id] }; });
    steps.splice(briefingId ? 1 : 0, 0, routeA, routeB);
  }
  if (difficulty === "HARD" && template.requiredSwitches.length) {
    const goal = steps.find((step) => step.type === "REACH_GOAL");
    const switchA = steps.find((step) => step.id === "activate_switch_a" || step.id === "restore_power");
    if (goal && switchA) {
      const switchB: MissionStep = { id: "activate_switch_b", type: "ACTIVATE_SWITCH", targetIds: targets.$SWITCH_B, targetType: "SWITCH", description: "補助スイッチを起動する", status: "LOCKED", prerequisites: { mode: "AND", stepIds: [...switchA.prerequisites.stepIds] } };
      steps.splice(steps.indexOf(goal), 0, switchB); goal.prerequisites = { mode: "AND", stepIds: [switchA.id, switchB.id] };
    }
  }
  steps.push({ id: "optional_cache", type: "FIND_ITEM", targetIds: targets.$OPTIONAL, targetType: "ITEM", description: "OPTIONAL：補給コインを回収する", status: "LOCKED", prerequisites: { mode: "AND", stepIds: [] }, optional: true });
  if (difficulty === "HARD" && baseLength <= 3) {
    const goal = steps.find((step) => step.type === "REACH_GOAL");
    if (goal) {
      const checkpoint: MissionStep = { id: "final_checkpoint", type: "VISIT", targetIds: targets.$BUILDING_B, targetType: "CHECKPOINT", description: "最終ルートを確認する", status: "LOCKED", prerequisites: goal.prerequisites };
      goal.prerequisites = { mode: "AND", stepIds: [checkpoint.id] };
      steps.splice(steps.indexOf(goal), 0, checkpoint);
    }
  }
  return steps;
}
