import type { MissionGuideMode } from "../gameplay/MissionGuideManager";
import type { MissionType } from "../gameplay/MissionTypes";
import type { GameConfig } from "./GameTypes";

export interface GameModeRules { missionType: MissionType; guide: MissionGuideMode; enemies: boolean; objective: string }

export function resolveGameMode(config: GameConfig): GameModeRules {
  if (config.mode === "EXPLORATION") return { missionType: "ESCAPE", guide: "OFF", enemies: false, objective: "新しい場所を5か所発見し、ランドマークを訪れる" };
  if (config.mode === "STEALTH") return { missionType: config.difficulty === "HARD" ? "POWER_RESTORE" : "ACCESS_CONTROL", guide: config.difficulty === "EASY" ? "DEBUG" : "NORMAL", enemies: true, objective: "敵に捕まらずMissionを達成する" };
  return { missionType: config.difficulty === "EASY" ? "ESCAPE" : config.difficulty === "HARD" ? "MULTI_BUILDING" : "ACCESS_CONTROL", guide: config.difficulty === "EASY" ? "DEBUG" : "NORMAL", enemies: true, objective: "Missionを達成して脱出する" };
}
