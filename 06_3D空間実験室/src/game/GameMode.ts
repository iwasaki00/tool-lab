import type { MissionGuideMode } from "../gameplay/MissionGuideManager";
import type { MissionType } from "../gameplay/MissionTypes";
import type { DiscoverySnapshot, GameConfig, GameMode } from "./GameTypes";

export interface GameModeRules {
  missionType: MissionType;
  guide: MissionGuideMode;
  enemies: boolean;
  objective: string;
}

export interface GameScenarioPolicy {
  enemyCount: number;
  npcCount: number;
  discoveryEnabled: boolean;
}

export interface ScoreContext {
  seconds: number;
  detections: number;
  discovered: number;
  landmarkFound: boolean;
  complete: boolean;
}

export interface GameModeUiPolicy {
  showDetection: boolean;
  showDiscovery: boolean;
  tutorial: string;
}

export interface IGameMode {
  readonly id: GameMode;
  configure(config: GameConfig): GameModeRules;
  scenario(config: GameConfig, mobile: boolean): GameScenarioPolicy;
  readonly completeOnMission: boolean;
  readonly failOnCaught: boolean;
  readonly countDetections: boolean;
  readonly debugCompletion: "MISSION" | "DISCOVERY";
  readonly ui: GameModeUiPolicy;
  isDiscoveryComplete(snapshot: DiscoverySnapshot): boolean;
  calculateScore(context: ScoreContext): number;
}
