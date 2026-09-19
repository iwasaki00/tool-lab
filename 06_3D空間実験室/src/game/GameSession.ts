import type { DiscoverySnapshot, GameConfig, GameResult, GameState } from "./GameTypes";
import { ScoreManager } from "./ScoreManager";

export interface GameSessionSnapshot {
  state: GameState;
  elapsedSeconds: number;
  detections: number;
  discovery: DiscoverySnapshot;
  result?: GameResult;
}

export class GameSession {
  private state: GameState = "TITLE";
  private startedAt = 0;
  private pausedAt = 0;
  private pausedTotal = 0;
  private detections = 0;
  private caughtCount = 0;
  private discovery: DiscoverySnapshot = { discovered: 0, target: 5, buildingsVisited: 0, buildingTarget: 3, landmarkFound: false };
  private result?: GameResult;
  private readonly scores = new ScoreManager();

  constructor(readonly config: GameConfig, private readonly onChange: (snapshot: GameSessionSnapshot) => void) {}

  setState(state: GameState): void { this.state = state; this.publish(); }
  start(): void { this.startedAt = performance.now(); this.pausedTotal = 0; this.state = "PLAYING"; this.publish(); }
  pause(): void { if (this.state !== "PLAYING") return; this.pausedAt = performance.now(); this.state = "PAUSED"; this.publish(); }
  resume(): void { if (this.state !== "PAUSED") return; this.pausedTotal += performance.now() - this.pausedAt; this.state = "PLAYING"; this.publish(); }
  addDetection(): void { if (this.state !== "PLAYING") return; this.detections += 1; this.publish(); }
  caught(): void { if (this.state !== "PLAYING") return; this.caughtCount += 1; if (this.config.mode === "STEALTH" && !this.config.testMode) this.fail("敵に捕まりました"); else this.publish(); }
  updateDiscovery(value: DiscoverySnapshot): void { this.discovery = value; if (this.config.mode === "EXPLORATION" && value.discovered >= value.target && value.buildingsVisited >= value.buildingTarget && value.landmarkFound) this.complete(); else this.publish(); }
  complete(): void { this.finish("COMPLETE"); }
  fail(reason: string): void { this.finish("FAILED", reason); }
  tick(): void { if (this.state === "PLAYING") this.publish(); }
  snapshot(): GameSessionSnapshot { return { state: this.state, elapsedSeconds: this.elapsed(), detections: this.detections, discovery: this.discovery, result: this.result }; }
  best(): GameResult | undefined { return this.scores.best(this.config.mode, this.config.difficulty); }
  history(): GameResult[] { return this.scores.history(); }

  private finish(status: "COMPLETE" | "FAILED", reason?: string): void {
    if (this.state === "COMPLETE" || this.state === "FAILED") return;
    const seconds = this.elapsed();
    this.result = {
      mode: this.config.mode, difficulty: this.config.difficulty, citySeed: this.config.citySeed, missionSeed: this.config.missionSeed,
      clearTimeSeconds: seconds, score: this.scores.calculate(this.config.mode, seconds, this.detections, this.discovery.discovered, this.discovery.landmarkFound, status === "COMPLETE"),
      status, reason, detections: this.detections, caughtCount: this.caughtCount, discovered: this.discovery.discovered, landmarkFound: this.discovery.landmarkFound, completedAt: new Date().toISOString(),
    };
    this.state = status; this.scores.save(this.result); this.publish();
  }

  private elapsed(): number {
    if (!this.startedAt) return 0;
    const end = this.state === "PAUSED" ? this.pausedAt : this.result ? this.startedAt + this.result.clearTimeSeconds * 1000 + this.pausedTotal : performance.now();
    return Math.max(0, (end - this.startedAt - this.pausedTotal) / 1000);
  }
  private publish(): void { this.onChange(this.snapshot()); }
}
