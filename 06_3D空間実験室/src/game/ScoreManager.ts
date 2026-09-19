import type { GameMode, GameResult } from "./GameTypes";
import type { MissionDifficulty } from "../gameplay/MissionTypes";

const HISTORY_KEY = "3d-space-lab-game-history-v1";

export class ScoreManager {
  calculate(mode: GameMode, seconds: number, detections: number, discovered: number, landmark: boolean, complete: boolean): number {
    if (!complete) return Math.max(0, discovered * 150);
    const base = mode === "STEALTH" ? 12000 : mode === "EXPLORATION" ? 5000 : 10000;
    const timeBonus = Math.max(0, 6000 - Math.floor(seconds * 12));
    const stealthBonus = mode === "STEALTH" && detections === 0 ? 3000 : 0;
    const explorationBonus = discovered * 500 + (landmark ? 2000 : 0);
    return Math.max(0, base + timeBonus + stealthBonus + explorationBonus - detections * 750);
  }

  save(result: GameResult): void {
    const history = this.history(); history.unshift(result);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
    if (result.status === "COMPLETE") {
      const key = this.bestKey(result.mode, result.difficulty);
      const previous = this.best(result.mode, result.difficulty);
      if (!previous || result.score > previous.score || (result.score === previous.score && result.clearTimeSeconds < previous.clearTimeSeconds)) localStorage.setItem(key, JSON.stringify(result));
    }
  }

  history(): GameResult[] { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as GameResult[]; } catch { return []; } }
  best(mode: GameMode, difficulty: MissionDifficulty): GameResult | undefined { try { const value = localStorage.getItem(this.bestKey(mode, difficulty)); return value ? JSON.parse(value) as GameResult : undefined; } catch { return undefined; } }
  private bestKey(mode: GameMode, difficulty: MissionDifficulty): string { return `3d-space-lab-best-${mode}-${difficulty}`; }
}
