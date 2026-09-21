import type { GameComposition } from "../../contracts/GameComposition";
import type { GameplayCallbacks } from "../../contracts/ScenarioContracts";
import { applyGameUiPolicy, type GameUiElements } from "../GameUiAdapter";
import type { GameModeRules, IGameMode } from "../GameMode";
import { getGameMode } from "../GameModeRegistry";
import type { GameConfig } from "../GameTypes";
import { createDemoScenario } from "./createDemoScenario";

export interface SampleGameComposition extends GameComposition<GameConfig, GameModeRules, IGameMode> {
  applyUi(config: GameConfig, elements: GameUiElements): void;
}

export function createSampleGameComposition(): SampleGameComposition {
  return {
    id: "3d-space-lab-sample-game",
    getMode: (config) => getGameMode(config.mode),
    getRules: (config) => getGameMode(config.mode).configure(config),
    getScenario: (config, mobile) => ({ factory: createDemoScenario, policy: getGameMode(config.mode).scenario(config, mobile) }),
    createCallbacks: (callbacks: GameplayCallbacks) => callbacks,
    applyUi: (config, elements) => applyGameUiPolicy(getGameMode(config.mode), elements),
  };
}
