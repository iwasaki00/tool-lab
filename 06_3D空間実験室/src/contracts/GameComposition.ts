import type { GameplayCallbacks, ScenarioFactory, ScenarioPolicy } from "./ScenarioContracts";

export interface GameComposition<TConfig, TRules, TMode> {
  readonly id: string;
  getMode(config: TConfig): TMode;
  getRules(config: TConfig): TRules;
  getScenario(config: TConfig, mobile: boolean): { factory: ScenarioFactory; policy: ScenarioPolicy };
  createCallbacks(callbacks: GameplayCallbacks): GameplayCallbacks;
}
