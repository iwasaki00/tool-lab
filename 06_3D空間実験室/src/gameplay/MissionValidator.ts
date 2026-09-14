import type { WorldRegistry } from "../world/WorldRegistry";
import type { MissionPlan, MissionStep } from "./MissionTypes";
import { WorldGraph } from "../navigation/WorldGraph";

export interface MissionValidation { valid: boolean; errors: string[] }

export function validateMission(plan: MissionPlan, registry: WorldRegistry): MissionValidation {
  const errors: string[] = [];
  const lazyTargets = new Set([plan.entranceId, `${plan.missionBuildingId}_door_2_4`, `${plan.missionBuildingId}_corridor_2`, ...plan.interior.itemIds, ...plan.interior.switchIds]);
  const itemIds = new Set(plan.items.map((item) => item.id));
  if (!registry.get(plan.goal.id)) errors.push("Goalが存在しません");
  plan.steps.forEach((step) => {
    if (!step.targetIds.length || step.targetIds.some((id) => !id)) errors.push(`${step.id}: Targetがありません`);
    step.targetIds.forEach((id) => { if (!registry.get(id) && !lazyTargets.has(id)) errors.push(`${step.id}: 必須Target ${id} が存在しません`); });
    step.prerequisites.stepIds.forEach((id) => { if (!plan.steps.some((candidate) => candidate.id === id)) errors.push(`${step.id}: 未知の依存Step ${id}`); });
  });
  plan.steps.filter((step) => step.type === "FIND_ITEM").flatMap((step) => step.targetIds).forEach((id) => {
    if (!itemIds.has(id) && !plan.interior.itemIds.includes(id)) errors.push(`必須アイテム ${id} が存在しません`);
  });
  if (hasCycle(plan.steps)) errors.push("Mission Dependencyに循環があります");
  if (!plan.steps.some((step) => step.type === "REACH_GOAL")) errors.push("Goal Stepが存在しません");
  if (plan.interior.itemIds.length && !plan.steps.some((step) => step.targetIds.includes(plan.entranceId))) errors.push("Card Keyが必要Doorの奥にあります");
  const missionBuilding = registry.get(plan.missionBuildingId);
  const requiresUpperFloor = plan.steps.some((step) => step.targetIds.some((id) => id.includes("corridor_2") || id.includes("door_2_")));
  if (requiresUpperFloor && Number(missionBuilding?.metadata?.floors ?? 0) < 2) errors.push("必要な階段または上階が存在しません");
  if (plan.steps.some((step) => step.targetType === "CONTROL ROOM") && !missionBuilding?.metadata?.hasInterior) errors.push("必須Control Roomを生成できません");
  plan.interior.switchIds.forEach((id) => { if (!plan.steps.some((step) => step.targetIds.includes(id))) errors.push(`Switch ${id} に対応するStepがありません`); });
  const graph = new WorldGraph(registry);
  for (const item of plan.items) if (!graph.isReachable(plan.start.areaId, item.placement.areaId)) errors.push(`STARTから${item.displayName}へ到達できません`);
  if (!graph.isReachable(plan.start.areaId, plan.goal.areaId)) errors.push("Goalへ到達可能なWorld経路がありません");
  return { valid: errors.length === 0, errors };
}

function hasCycle(steps: MissionStep[]): boolean {
  const visiting = new Set<string>(); const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true; if (visited.has(id)) return false;
    visiting.add(id);
    const step = steps.find((candidate) => candidate.id === id);
    if (step?.prerequisites.stepIds.some(visit)) return true;
    visiting.delete(id); visited.add(id); return false;
  };
  return steps.some((step) => visit(step.id));
}
