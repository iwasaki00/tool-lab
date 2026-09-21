export type MissionStepStatus = "LOCKED" | "ACTIVE" | "COMPLETED" | "FAILED";

export interface MissionPrerequisites {
  mode: "AND" | "OR";
  stepIds: string[];
}

export interface MissionStepContract<TTargetType extends string = string> {
  id: string;
  type: string;
  targetIds: string[];
  targetType: TTargetType;
  description: string;
  status: MissionStepStatus;
  prerequisites: MissionPrerequisites;
  optional?: boolean;
}

export interface IMissionProgressService {
  completeByTarget(targetId: string, message?: string): boolean;
  isTargetActive(targetId: string): boolean;
}
