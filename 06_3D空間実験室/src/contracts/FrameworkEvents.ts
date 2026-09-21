import type { MissionStepStatus } from "./MissionContracts";

export const FRAMEWORK_EVENT = {
  ITEM_ACQUIRED: "ITEM_ACQUIRED",
  DOOR_STATE_CHANGED: "DOOR_STATE_CHANGED",
  SWITCH_STATE_CHANGED: "SWITCH_STATE_CHANGED",
  AREA_DISCOVERED: "AREA_DISCOVERED",
  MISSION_STEP_CHANGED: "MISSION_STEP_CHANGED",
  MISSION_COMPLETED: "MISSION_COMPLETED",
  MAP_STATUS_CHANGED: "MAP_STATUS_CHANGED",
  NAVIGATION_STATUS_CHANGED: "NAVIGATION_STATUS_CHANGED",
} as const;

export interface MapStatusEvent {
  state: "IDLE" | "LOADING" | "BOUNDARY" | "ERROR";
  message: string;
}

export interface NavigationStatusEvent {
  status: "BUILDING" | "READY" | "FALLBACK" | "ERROR";
  mode: "NAVMESH" | "WORLD_GRAPH" | "DIRECT_FALLBACK";
  message?: string;
}

export interface FrameworkEventMap {
  ITEM_ACQUIRED: { itemId: string; displayName: string; amount: number };
  DOOR_STATE_CHANGED: { doorId: string; open: boolean; locked: boolean };
  SWITCH_STATE_CHANGED: { switchId: string; active: boolean };
  AREA_DISCOVERED: { areaId: string; label?: string };
  MISSION_STEP_CHANGED: { stepId: string; status: MissionStepStatus };
  MISSION_COMPLETED: { missionType: string; difficulty: string; seed: number; clearTimeSeconds: number };
  MAP_STATUS_CHANGED: MapStatusEvent;
  NAVIGATION_STATUS_CHANGED: NavigationStatusEvent;
}

export type FrameworkEventName = keyof FrameworkEventMap;
