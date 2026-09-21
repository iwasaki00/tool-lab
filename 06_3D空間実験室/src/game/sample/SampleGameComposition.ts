import type { GameComposition } from "../../contracts/GameComposition";
import type { GameplayCallbacks } from "../../contracts/ScenarioContracts";
import { applyGameUiPolicy, type GameUiElements } from "../GameUiAdapter";
import type { GameModeRules, IGameMode } from "../GameMode";
import { getGameMode } from "../GameModeRegistry";
import type { GameConfig } from "../GameTypes";
import { createDemoScenario } from "./createDemoScenario";
import type { UiRegistry } from "../../ui/UiRegistry";

export interface SampleGameComposition extends GameComposition<GameConfig, GameModeRules, IGameMode> {
  applyUi(config: GameConfig, elements: GameUiElements): void;
  registerUi(registry: UiRegistry): void;
}

export function createSampleGameComposition(): SampleGameComposition {
  return {
    id: "3d-space-lab-sample-game",
    getMode: (config) => getGameMode(config.mode),
    getRules: (config) => getGameMode(config.mode).configure(config),
    getScenario: (config, mobile) => ({ factory: createDemoScenario, policy: getGameMode(config.mode).scenario(config, mobile) }),
    createCallbacks: (callbacks: GameplayCallbacks) => callbacks,
    applyUi: (config, elements) => applyGameUiPolicy(getGameMode(config.mode), elements),
    registerUi: (registry) => {
      registry
        .register({ id: "game-title", layer: "GAME", selector: "#game-title-screen" })
        .register({ id: "game-detection", layer: "GAME", selector: "#detection-meter" })
        .register({ id: "game-discovery", layer: "GAME", selector: "#discovery-progress" })
        .register({ id: "game-result", layer: "GAME", selector: "#result-screen" });
    },
  };
}
