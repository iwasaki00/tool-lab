import type { MapStatusEvent, NavigationStatusEvent } from "../../contracts/FrameworkEvents";

export const FRAMEWORK_EVENT = {
  MAP_STATUS_CHANGED: "MAP_STATUS_CHANGED",
  NAVIGATION_STATUS_CHANGED: "NAVIGATION_STATUS_CHANGED",
} as const;

export interface FrameworkEventMap {
  MAP_STATUS_CHANGED: MapStatusEvent;
  NAVIGATION_STATUS_CHANGED: NavigationStatusEvent;
}

export type FrameworkEventName = keyof FrameworkEventMap;
