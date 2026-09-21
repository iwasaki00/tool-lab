import type { GameConfig } from "./GameTypes";
import { getGameMode } from "./GameModeRegistry";
import type { GameModeRules } from "./GameMode";

export type { GameModeRules } from "./GameMode";

export function resolveGameMode(config: GameConfig): GameModeRules {
  return getGameMode(config.mode).configure(config);
}
