import type { AreaTag, AreaType } from "../world/SemanticTypes";

/** Semantic vocabulary owned by the bundled sample game, not by the framework. */
export const GAME_AREA_TYPE = {
  SWITCH: "SWITCH",
  CONTROL_ROOM: "CONTROL_ROOM",
  GOAL: "GOAL_AREA",
  ITEM: "ITEM",
  ENEMY_SPAWN: "ENEMY_SPAWN",
  NPC_SPAWN: "NPC_SPAWN",
} as const satisfies Record<string, AreaType>;

export const GAME_AREA_TAG = {
  SAFE: "safe",
  DANGER: "danger",
  MISSION: "mission",
} as const satisfies Record<string, AreaTag>;

export type GameAreaType = typeof GAME_AREA_TYPE[keyof typeof GAME_AREA_TYPE];
export type GameAreaTag = typeof GAME_AREA_TAG[keyof typeof GAME_AREA_TAG];
