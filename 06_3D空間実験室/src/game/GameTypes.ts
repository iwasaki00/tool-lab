import type { MissionDifficulty } from "../gameplay/MissionTypes";

export type { DiscoverySnapshot } from "../gameplay/DiscoveryManager";

export type GameMode = "ESCAPE" | "STEALTH" | "EXPLORATION";
export type GameState = "TITLE" | "GENERATING" | "READY" | "PLAYING" | "PAUSED" | "COMPLETE" | "FAILED";

export interface GameConfig {
  mode: GameMode;
  difficulty: MissionDifficulty;
  citySeed: number;
  missionSeed: number;
  testMode: boolean;
  /** World Map System options. Omitted values use the framework defaults. */
  autoExpansion?: boolean;
  chunkUnload?: boolean;
}

export interface GameResult {
  mode: GameMode;
  difficulty: MissionDifficulty;
  citySeed: number;
  missionSeed: number;
  clearTimeSeconds: number;
  score: number;
  status: "COMPLETE" | "FAILED";
  reason?: string;
  detections: number;
  caughtCount: number;
  discovered: number;
  landmarkFound: boolean;
  completedAt: string;
}

const MODE_CODE: Record<GameMode, string> = { ESCAPE: "E", STEALTH: "S", EXPLORATION: "X" };
const DIFFICULTY_CODE: Record<MissionDifficulty, string> = { EASY: "E", NORMAL: "N", HARD: "H" };

export function encodeChallengeCode(config: GameConfig): string {
  return `${MODE_CODE[config.mode]}-${DIFFICULTY_CODE[config.difficulty]}-${config.citySeed >>> 0}-${config.missionSeed >>> 0}`;
}

export function decodeChallengeCode(value: string): GameConfig | undefined {
  const match = value.trim().toUpperCase().match(/^([ESX])-([ENH])-(\d+)-(\d+)$/);
  if (!match) return undefined;
  const mode = ({ E: "ESCAPE", S: "STEALTH", X: "EXPLORATION" } as const)[match[1] as "E" | "S" | "X"];
  const difficulty = ({ E: "EASY", N: "NORMAL", H: "HARD" } as const)[match[2] as "E" | "N" | "H"];
  const citySeed = Number(match[3]); const missionSeed = Number(match[4]);
  if (!Number.isSafeInteger(citySeed) || !Number.isSafeInteger(missionSeed) || citySeed < 1 || missionSeed < 1) return undefined;
  return { mode, difficulty, citySeed, missionSeed, testMode: false };
}
