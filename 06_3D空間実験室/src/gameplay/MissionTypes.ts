import type { GuideTargetType } from "./ObjectiveManager";
import type { GamePlacement } from "./GamePlacementManager";

export type MissionType = "ESCAPE" | "ACCESS_CONTROL" | "POWER_RESTORE" | "MULTI_BUILDING" | "TOWER";
export type MissionDifficulty = "EASY" | "NORMAL" | "HARD";
export type MissionStepStatus = "LOCKED" | "ACTIVE" | "COMPLETED" | "FAILED";
export type MissionStepType = "START" | "FIND_ITEM" | "VISIT" | "OPEN_DOOR" | "ACTIVATE_SWITCH" | "REACH_GOAL";

export interface MissionPrerequisites { mode: "AND" | "OR"; stepIds: string[] }
export interface MissionStep {
  id: string;
  type: MissionStepType;
  targetIds: string[];
  targetType: GuideTargetType;
  description: string;
  status: MissionStepStatus;
  prerequisites: MissionPrerequisites;
  optional?: boolean;
}

export interface MissionItemSpec {
  id: string;
  itemId: string;
  displayName: string;
  kind: "KEY" | "CARD_KEY" | "ITEM";
  placement: GamePlacement;
}

export interface MissionInteriorSpec {
  itemIds: string[];
  switchIds: string[];
  controlDoorCredential?: string;
}

export interface MissionReward { score: number; timeBonus: boolean; itemReward?: string }
export interface MissionLogEntry { elapsedSeconds: number; message: string }
export interface MissionResult {
  type: MissionType;
  difficulty: MissionDifficulty;
  clearTimeSeconds: number;
  completedSteps: number;
  totalSteps: number;
  optionalCompleted: number;
  optionalTotal: number;
  seed: number;
}

export interface MissionPlan {
  seed: number;
  citySeed: number;
  type: MissionType;
  difficulty: MissionDifficulty;
  templateId: string;
  start: GamePlacement;
  goal: GamePlacement;
  missionBuildingId: string;
  entranceId: string;
  entranceCredential?: string;
  steps: MissionStep[];
  items: MissionItemSpec[];
  interior: MissionInteriorSpec;
  reward: MissionReward;
  retryCount: number;
}

export interface MissionRuntimeSnapshot {
  plan: MissionPlan;
  current?: MissionStep;
  completed: number;
  total: number;
  logs: MissionLogEntry[];
  elapsedSeconds: number;
  complete: boolean;
  result?: MissionResult;
}
