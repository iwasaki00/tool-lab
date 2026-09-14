import type { MissionPlan } from "./MissionGenerator";
import type { WorldRegistry } from "../world/WorldRegistry";
import { WorldGraph } from "../navigation/WorldGraph";

export interface MissionValidation { valid: boolean; errors: string[] }

export function validateMission(plan: MissionPlan, registry: WorldRegistry): MissionValidation {
  const errors: string[] = [];
  if (!registry.get(plan.key.areaId)) errors.push("鍵の配置Areaが存在しません");
  if (!registry.get(plan.goal.areaId)) errors.push("Goalの配置Areaが存在しません");
  if (plan.key.areaId === plan.lockedEntranceId) errors.push("鍵がロック扉の内側です");
  const known = new Set(["key", "card_key", plan.lockedEntranceId, `${plan.missionBuildingId}_switch_001`, "goal_001"]);
  plan.dependencies.forEach((dependency) => dependency.requires.forEach((required) => { if (!known.has(required)) errors.push(`未知の依存関係: ${required}`); }));
  if (!plan.dependencies.some((dependency) => dependency.id === "goal_001")) errors.push("Goal依存関係がありません");
  const graph = new WorldGraph(registry);
  if (!graph.isReachable(plan.start.areaId, plan.key.areaId)) errors.push("STARTから鍵へ到達できません");
  if (!graph.isReachable(plan.key.areaId, plan.lockedEntranceId)) errors.push("鍵からロック扉へ到達できません");
  return { valid: errors.length === 0, errors };
}
